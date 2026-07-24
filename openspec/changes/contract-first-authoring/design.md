---
schema: design
schema_version: 1
change_id: contract-first-authoring
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
security:
  risk: standard              # heredado del proposal; no se baja (ni hay motivo para subirlo)
  threat_model_required: false
  controls: [SEC-001, SEC-002]
---
# Technical design — Authoring del contrato canónico en `sdd-design`

> Mapeo de IDs: el proposal usa `SEC-1`/`SEC-2` en el body; el frontmatter de
> `design.md` exige el patrón `^SEC-[0-9]{3}$`, así que `SEC-001` = proposal
> `SEC-1` (prohibición de secretos/PII en el contrato) y `SEC-002` = proposal
> `SEC-2` (superficie del change: cero cambios en `src/`).

## Approach

El change es **prosa normativa + su blindaje mecánico**: no hay código nuevo. El
diseño es, entonces, el texto exacto que se agrega y dónde, más las aserciones
que lo sostienen.

### 1. `skills/sdd-design/canonical.md` — nuevo paso en `## Behavior`

Se inserta como **paso 2**, entre "Design the solution" (1) y "Security
refinement" (hoy 2, pasa a 3). La ubicación no es cosmética: la refinación de
seguridad dice "you may **raise** risk if the design surfaces new exposure", y
para eso los endpoints tienen que estar concretos **antes**. Renumeración:
1 → sin cambios, **2 → nuevo**, 2 → 3, 3 → 4, 4 → 5.

Texto propuesto:

> 2. **Canonical contract authoring (conditional).** When the proposal declares
>    `impact.public_contract: true` **and** `playbook.config.yaml` declares
>    `contract.path_in_loom`, add or update this feature's endpoints in the file
>    that key points at — the hub-owned canonical contract, authored
>    **loom-first**, before the implementing repo builds it. Take the path from
>    `contract.path_in_loom`; never hardcode it. If that file does not exist,
>    create it with the minimal skeleton (`openapi`, `info`, `paths`) plus this
>    feature's endpoints — nothing else creates it, not `playbook init` and not
>    bootstrap. The endpoints in the contract and in `design.md`'s
>    `## Public contracts / interfaces` must describe the **same set**: a human
>    reviews both in one sign-off, so a mismatch is a design defect, not a
>    formatting detail. Never put secrets, real tokens, or PII in `example`,
>    `description`, or `servers` — the contract is a versioned artifact shared
>    with every consumer repo, so a leak there is effectively permanent. When
>    `contract.path_in_loom` is absent, **skip this step and say so
>    explicitly**: contract-first is opt-in and there is no default path.
>    `playbook contract-drift` checks an implementation against this contract in
>    the implementing repo's CI — it is a detector, never the authoring
>    mechanism.

Cobertura: AC-1 (el authoring condicionado a `public_contract`), AC-2
(`contract.path_in_loom` como fuente + omitir/reportar), AC-3 (coherencia con
`design.md`), AC-4 (SEC-001), EC-1 (omitir), EC-2 (crear con esqueleto).

### 2. `skills/sdd-design/canonical.md` — nueva regla en `## Rules`

> - Never write a canonical contract when `contract.path_in_loom` is absent, and
>   never hardcode a contract path — contract-first is opt-in per project.

### 3. `skills/sdd-design/canonical.md` — frontmatter `output_file`

`design.md` → `design.md (+ the canonical contract at contract.path_in_loom when impact.public_contract: true)`.
Se refleja en el body generado (`**Output file:** …`,
[generate-skills.js:58](src/generator/generate-skills.js:58)). `produces` **no**
se toca (ver Data model changes).

### 4. `npm run generate`

Regenera `skills/sdd-design/SKILL.md`. `npm run generate:check` debe quedar sin
drift (AC-6). Principio 1: `SKILL.md` nunca se edita a mano.

### 5. `README.md` (bloque `## Contract-first (optional)`, líneas 168-176)

`during \`sdd-plan\`` → `during \`sdd-design\`` , más una cláusula corta que
nombra el motivo (el contrato entra en la firma humana del diseño). Es el único
cambio del README: el resto del bloque —`paths: {}`, feature por feature,
`contract-drift` en el CI del backend— ya es correcto (AC-5).

### 6. `test/skill-contract.test.js` — 6 aserciones

Todas contra el `SKILL.md` generado vía el helper `body(name)` ya existente, que
es lo que realmente se instala; el `canonical.md` queda cubierto transitivamente
por `generate:check`.

| Test | Cubre |
|---|---|
| `sdd-design authors the canonical contract when the proposal declares public_contract (AC-1, AC-2)` | menciona `impact.public_contract`, `contract.path_in_loom`, y la instrucción de omitir + reportar |
| `sdd-design takes the contract path from config and never hardcodes it (AC-2)` | `doesNotMatch` del literal `openspec/specs/contracts/openapi.yaml` en el body |
| `sdd-design keeps the canonical contract and design.md's public contracts in sync (AC-3)` | menciona `Public contracts / interfaces` + "same set" |
| `sdd-design forbids secrets and PII in the canonical contract (SEC-001, AC-4)` | menciona secrets/PII + `example`/`servers` |
| `sdd-plan does not author the canonical contract — that is sdd-design's step (AC-1)` | `doesNotMatch /openapi/i` sobre `sdd-plan` |
| `the README names sdd-design as the contract authoring stage (AC-5)` | README matchea `sdd-design`, `doesNotMatch` la promesa vieja de `sdd-plan` |

La sexta es la razón por la que el literal `openspec/specs/contracts/openapi.yaml`
se mantiene **fuera** del texto de `sdd-design`: hace que la aserción de
"no hardcodear" sea limpia en vez de un regex frágil sobre la frase.

## Module impact

| Archivo | Delta | Capa |
|---|---|---|
| `skills/sdd-design/canonical.md` | paso 2 nuevo + renumeración 2→3/3→4/4→5, 1 regla, `output_file` | metodología (fuente) |
| `skills/sdd-design/SKILL.md` | regenerado | metodología (derivado) |
| `README.md` | 1 línea del bloque contract-first | docs |
| `test/skill-contract.test.js` | +6 tests | tests |
| `openspec/changes/contract-first-authoring/adr-*.md` | ya creado (draft) | decisión |

**Sin delta:** `src/` (ningún módulo), `schemas/`, `templates/`,
`src/repos/contract-drift.js`, `openspec/specs/contracts/openapi.yaml`,
`playbook.config.yaml`. No se cruza ningún límite de capa de
[doc_architecture.md](docs/doc_architecture.md): el change vive entero en la capa
de skills + docs + tests.

## Trade-offs

- **Paso 2 (antes de la refinación de seguridad) vs. último paso.** Elegido:
  paso 2. Ponerlo al final dejaría la clasificación de riesgo decidida sobre
  endpoints todavía difusos. Costo: renumerar tres pasos, lo que hace el diff
  más ruidoso de lo que es el cambio real.
- **Aserción del README en `test/skill-contract.test.js` vs `test/contract-first.test.js`.**
  El segundo es el hogar temático (ya assertea sobre un archivo que no es un
  skill: el CI template, [contract-first.test.js:90](test/contract-first.test.js:90)).
  Elegido el primero porque **AC-7 lo nombra explícitamente y está congelado**
  por la aprobación del proposal. Coherente igual: la aserción custodia *qué
  skill* es dueño del paso, que es un hecho del contrato de skills. Si algún día
  se reagrupa, es un change nuevo.
- **`produces` sin tocar.** Agregar el contrato ahí lo mezclaría con los
  artefactos del change folder, que es lo que ese campo enumera. El costo es que
  el efecto condicional sólo se ve en `output_file`; se acepta.
- **Instrucción replicada como prosa vs. comando CLI nuevo.** ADR-029 exige
  invocar *capacidades* vía comandos `playbook`. Acá no hay capacidad que
  invocar: escribir YAML es trabajo del agente, y `contract.path_in_loom` es una
  clave de un archivo de config, no una función de `src/` — leerla directamente
  es lo que ya hacen `sdd-commit` (base branch) y `sdd-runtime-gate`
  (capabilities). No se agrega comando.
- **Guarda doble (`public_contract` + `path_in_loom`) vs. sólo el impact.** La
  doble guarda deja un hueco conocido: un proyecto con API compartida que se
  olvidó de configurar `contract.path_in_loom` no autora nada. Se acepta y se
  hace ruidoso (el skill lo reporta) en vez de inventar una ruta por defecto que
  el CLI no reconocería ([repos.js:149](src/cli/repos.js:149)).

## Public contracts / interfaces

- **Contrato público de `playbook-ai`: sin cambios.** No se agrega ni modifica
  ningún comando del CLI, schema, ni clave de `playbook.config.yaml`. Lo que
  cambia es el **contrato de instrucciones** de `sdd-design` (su `SKILL.md`
  instalado): gana un paso condicional y una regla. Es aditivo — un change con
  `impact.public_contract: false`, o un proyecto sin `contract.path_in_loom`, ve
  el mismo comportamiento que hoy.
- **El contrato canónico de este repo no se toca.** Este change declara
  `impact.public_contract: false`, así que la regla que está introduciendo dice
  que no hay nada que autorar: `openspec/specs/contracts/openapi.yaml` queda en
  `paths: {}`. Es el camino de EC-3, ejercitado de verdad acá.
- **Nota de dogfooding, honesta:** el `sdd-design` que corrió para producir este
  archivo es la copia **instalada** (`~/.claude/skills/sdd-design`), que todavía
  no tiene el paso 2 — se instala recién al sincronizar tras el merge. Así que el
  paso no se autoejecutó; se cumplió su regla manualmente (contrato no tocado por
  `public_contract: false`). La verificación de AC-1..AC-5 es por test de
  contenido, no por ejecución.

## Data model changes

Ninguno. El "modelo de datos" del proyecto es el set de artefactos por change
([system.md](openspec/specs/system.md#main-data-model)) y no se agrega ni cambia
ninguno: `design.md` sigue siendo el único output de la etapa. El contrato
canónico vive en `openspec/specs/` — es un **spec permanente**, no un artefacto
de change, y por eso queda fuera de `produces` y de `schemas/`.

## Security controls (+ threat model when required)

`risk: standard` heredado del proposal, **no se baja**. Tampoco hay motivo para
subirlo: cero cambios en `src/`, sin input externo nuevo, sin permisos, sin
persistencia, sin auth. `threat_model_required: false`.

- **SEC-001 — prohibición de secretos/PII en el contrato canónico.** Se
  implementa *dentro* de la instrucción del paso 2 (no sólo en el proposal), con
  la razón incluida: el contrato es versionado y se comparte con el historial de
  git de todos los repos consumidores, así que una filtración es permanente.
  Blindaje: aserción de contenido (tabla de tests, fila 4). Control preventivo,
  no detectivo — no se agrega ningún escáner de secretos, que sería otro change.
- **SEC-002 — superficie del change.** Sólo prosa, su `SKILL.md` derivado,
  `README.md` y tests. `src/repos/contract-drift.js` y el CI template no se
  tocan: siguen read-only y CI-only.
- **Control implícito revisado: escritura en una ruta que sale de config.** El
  paso autoriza a *crear* un archivo en la ruta de `contract.path_in_loom`. No
  introduce un vector de path traversal: esa clave vive en el
  `playbook.config.yaml` commiteado del propio proyecto, no en input de runtime
  ni en argumentos de un comando, así que el nivel de confianza es el que el
  proyecto ya se otorga a sí mismo. Es la misma superficie que `contract-drift`
  ya lee hoy por esa misma clave.
- **Riesgo residual (registrado en el draft de ADR, no mitigado acá):** un change
  que toca una API pero declara `impact.public_contract: false` saltea el
  authoring en silencio. El trigger es un campo confirmado por un humano y
  declararlo mal ya hoy saltea toda la etapa de diseño — el riesgo se hereda, no
  se agrega.

## Testing strategy

- **Contenido (6 tests nuevos, `test/skill-contract.test.js`)** — cubren
  AC-1..AC-5 y EC-3, siguiendo el patrón de nombre `('… (AC-N, EC-N)')` que ya
  usan las aserciones de packet/spec-index. Son el gate mecánico: borrar el
  wiring en un merge futuro rompe `npm test`.
- **Drift (`npm run generate:check`)** — AC-6, ya en el pipeline.
- **Regresión (`npm test` completo)** — los 7 tests de
  `test/contract-first.test.js` deben seguir verdes sin tocarse: es la evidencia
  de que el lado de verificación no se rompió.
- **Sin runtime/E2E.** `runtime_relevant_capabilities: []`: la única capability
  habilitada es `cli`, cuyo adapter es un harness E2E experimental no
  implementado, y este change no toca `src/`. No hay comportamiento ejecutable
  nuevo que ejercitar — el artefacto es texto de instrucciones.
- **TDD (`sdd-apply`)** — las 6 aserciones se escriben **antes** de editar el
  `canonical.md`; deben fallar en rojo primero (5 por texto ausente; la de
  `sdd-plan` pasa desde el arranque y queda como guarda de no-regresión).

---

**Para el tech lead:** revisar sobre todo (a) el texto exacto del paso 2 —es el
entregable real del change— y (b) la ubicación como paso 2 en vez de último. Un
humano pone `status: approved`; este skill nunca se autoaprueba.
