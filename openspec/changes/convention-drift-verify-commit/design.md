---
schema: design
schema_version: 1
change_id: convention-drift-verify-commit
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
security:
  risk: standard              # heredado del proposal; no se baja (ni hay motivo para subirlo)
  threat_model_required: false
  controls: [SEC-001, SEC-002]
---
# Technical design — Restaurar `pwd` en `sdd-verify` y el retry cap en `sdd-commit`

> Mapeo de IDs: el proposal usa `SEC-1`/`SEC-2` en el body; el frontmatter de
> `design.md` exige `^SEC-[0-9]{3}$`, así que `SEC-001` = proposal `SEC-1` (el loop
> nunca debilita el status de un gate) y `SEC-002` = proposal `SEC-2` (superficie:
> cero cambios en `src/`).

## Approach

Como en el Ciclo C, el entregable **es prosa normativa**: no hay código nuevo. El
diseño es el texto exacto y su ubicación, más las aserciones que lo sostienen. La
diferencia con el Ciclo C es que acá el texto se **restaura de specloom** (la
referencia de intención original) en vez de escribirse desde cero — salvo la
restricción de alcance, que es nueva y es lo que registra el ADR draft.

### 1. `skills/sdd-verify/canonical.md` — `pwd` en 3 lugares

Se replica la distribución de specloom: versión corta en el primer punto donde se
corren comandos, versión larga (con la nota de los `tasks.md` viejos) en el
segundo, y la regla transversal en `## Rules`.

**Paso 1** (hoy: "Run the project's feature/domain verification command(s)."):

> 1. **Verify `pwd` first** — never assume the cwd inherited from a previous step.
>    Then run the project's feature/domain verification command(s).

**Paso 5** (hoy: "Run the required regression command(s); confirm no blocking failures."):

> 5. Verify `pwd` again before the regression command(s) — the cwd is not carried
>    over from step 1, and commands from an older `tasks.md`/`context-packet.md`
>    may assume a preceding `cd`. Then run them and confirm no blocking failures.

**`## Rules`** (línea nueva):

> - Before running any command from `tasks.md`/`context-packet.md`, verify `pwd`
>   first — never assume the cwd inherited from a prior task or step.

Cobertura: AC-1 (los tres puntos), AC-2 (`context-packet.md` nombrado en el paso 5
y en la regla).

### 2. `skills/sdd-commit/canonical.md` — loop acotado con alcance restringido

**Paso 1** reemplaza el actual "Run `playbook validate` — stop on any violation.":

> 1. Run `playbook validate` — it is the same check CI runs on the PR, so a failure
>    here means the PR would be rejected anyway. If it reports issues, fix only
>    what is safely fixable and re-run it — **don't reason about the reports
>    yourself**. **Only a derived artifact may be fixed:** regenerate a stale
>    `context-packet.md` with `playbook packet <change-id>`. **Never edit
>    `proposal.md`, `design.md`, `tasks.md`, or a gate report
>    (`code-review-report.md`, `security-report.md`, `runtime-gate-report.md`) to
>    make `validate` pass** — the first two carry a human `status: approved` and the
>    reports carry a gate's verdict; neither is this stage's to rewrite. Anything
>    not named regenerable counts as signed. When editing a signed artifact is the
>    only way past the failure, **stop and report which artifact and which issue,
>    without consuming an iteration**. This fix→re-run loop is capped at **3
>    iterations**; at the 4th failed attempt, stop and report the pending issues
>    exactly as `playbook validate` returns them, **without further blind edits**.

**`## Rules`** (dos líneas nuevas):

> - The fix→`playbook validate`→re-run loop is capped at 3 iterations; at the 4th
>   failed attempt, stop and report what `playbook validate` returns — never keep
>   iterating past the cap, and never make blind edits.
> - Never make `validate` pass by weakening a gate report's `status`, least of all
>   `security-report.md`. A retry budget never overrides a security rule — the same
>   precedence `sdd-apply`'s TDD cap has over its security condition, and the reason
>   for "Do not commit around a blocking finding" above.

Cobertura: AC-3 (cap + stop del 4º), AC-4 (guard), AC-5 (alcance), SEC-001.

El cap **nunca aborta**: es stop/report y espera instrucción humana; si el humano
decide continuar, resetea el contador conscientemente (ADR-011). Eso ya está
implícito en "stop and report", y la regla de `## Rules` lo hace explícito.

### 3. `npm run generate`

Regenera `skills/sdd-verify/SKILL.md` y `skills/sdd-commit/SKILL.md`.
`generate:check` sin drift (AC-6). `SKILL.md` nunca se edita a mano.

### 4. `test/skill-contract.test.js` — 7 aserciones

Contra el `SKILL.md` generado vía el helper `body(name)`.

| Test | Cubre |
|---|---|
| `sdd-verify verifies pwd before running feature and regression commands (AC-1)` | `Verify \`pwd\` first`, `pwd` antes de la regresión, y la regla de `## Rules` |
| `sdd-verify's pwd rule covers context-packet.md commands, not just tasks.md (AC-2)` | `context-packet.md` en el contexto del chequeo de `pwd` |
| `sdd-commit caps the fix→validate→re-run loop at 3 iterations (AC-3)` | `capped at 3 iterations` + el stop del 4º intento con la salida de `validate` |
| `sdd-commit forbids blind edits inside the retry loop (AC-4)` | `don't reason about the reports yourself` + `without further blind edits` |
| `sdd-commit's retry loop regenerates derived artifacts and never edits signed ones (AC-5)` | `playbook packet` permitido; `proposal.md`/`design.md`/`tasks.md`/gate reports prohibidos; `without consuming an iteration`; el default estricto |
| `sdd-commit never makes validate pass by weakening a gate status (SEC-001)` | **negativa primero** + positiva, ver Security controls |
| `sdd-apply and sdd-new keep the conventions this change replicates (AC-1, AC-3)` | guarda verde: `sdd-apply` sigue con `pwd`, `sdd-new` sigue con el cap |

La última es no-regresión: este change replica **desde** esos dos skills, así que
si la fuente se borra, la convención queda a medias otra vez.

## Module impact

| Archivo | Delta | Capa |
|---|---|---|
| `skills/sdd-verify/canonical.md` | `pwd` en paso 1, paso 5 y `## Rules` | metodología (fuente) |
| `skills/sdd-commit/canonical.md` | paso 1 reescrito + 2 reglas | metodología (fuente) |
| `skills/{sdd-verify,sdd-commit}/SKILL.md` | regenerados | metodología (derivado) |
| `test/skill-contract.test.js` | +7 tests | tests |
| `openspec/changes/.../adr-retry-loop-never-mutates-signed-artifacts.md` | ya creado (draft) | decisión |

**Sin delta:** `src/` (ningún módulo), `schemas/`, `templates/`, `README.md`,
`skills/sdd-apply/`, `skills/sdd-new/`. No se cruza ningún límite de capa de
[doc_architecture.md](docs/doc_architecture.md): el change vive entero en skills +
tests.

## Trade-offs

- **El paso 1 de `sdd-commit` queda largo.** Es el costo de que la restricción de
  alcance sea aplicable: la lista de qué es regenerable y qué está prohibido **es**
  la decisión, y una regla que el agente no puede aplicar no es una regla. Se
  consideró dejar sólo el principio general ("nunca edites un artefacto firmado") y
  descartó: sin la enumeración, cada ejecución re-interpreta qué cuenta como
  firmado. Mitigación del riesgo de lista incompleta: la frase de default estricto
  ("anything not named regenerable counts as signed").
- **Alcance inline en `## Behavior` vs sólo en `## Rules`.** Va inline, porque el
  agente lee el Behavior en el momento de actuar; `## Rules` queda como refuerzo.
  Duplica texto, y se acepta — es el mismo patrón que ya usan `sdd-apply` (pwd en
  paso 2d y en Rules) y `sdd-new` (cap en el paso 6).
- **`pwd` en dos puntos de ejecución, no uno.** El cwd no se arrastra entre el paso
  1 y el 5, y son los dos únicos lugares donde `sdd-verify` corre comandos. Un solo
  chequeo al inicio daría falsa seguridad. Misma distribución que specloom.
- **No se toca `README.md`.** A diferencia del Ciclo C, acá no hay promesa pública
  desalineada: el README no habla de caps ni de cwd.
- **El ADR complementa ADR-011, no lo supersede.** Se evaluó el supersede y se
  descartó: los caps, la semántica de stop/report y el reset del contador de
  ADR-011 quedan intactos y siguen siendo correctos. Lo único que ADR-011 no dice
  es el alcance, y agregar una dimensión no invalida las otras.

## Public contracts / interfaces

- **Contrato público de `playbook-ai`: sin cambios.** No se agrega ni modifica
  ningún comando del CLI, schema, ni clave de config. Lo que cambia es el
  **contrato de instrucciones** de `sdd-verify` y `sdd-commit`.
- **Aditivo para `sdd-verify`:** el chequeo de `pwd` no altera qué verifica ni qué
  reporta; sólo agrega una precondición defensiva antes de correr comandos.
- **NO aditivo para `sdd-commit`, y hay que decirlo:** su paso 1 pasa de "stop on
  any violation" a un fix acotado. Un `validate` que falla por packet stale, que
  hoy detiene el commit, ahora se regenera y continúa. Es el cambio de
  comportamiento del change, decidido en ADR-011 y acotado por el ADR draft.
- **Paso 2 de `sdd-design` (contrato canónico): no aplica, y se ejercitó de
  verdad.** Este change declara `impact.public_contract: false`, así que la
  instrucción que el Ciclo C cableó indica no tocar el contrato — y no se tocó:
  `openspec/specs/contracts/openapi.yaml` sigue en `paths: {}`.
  `contract.path_in_loom` **sí** está configurado en este repo, así que la guarda
  que decidió el resultado fue el flag del proposal, no la ausencia de config.
  **Es la primera ejecución real de ese wiring** con la skill instalada al día
  (`playbook install` corrido antes de arrancar este ciclo), a diferencia del
  Ciclo C, donde el paso todavía no estaba en la copia instalada.

## Data model changes

Ninguno. El set de artefactos por change
([system.md](openspec/specs/system.md#main-data-model)) no cambia: no se agrega ni
se quita ningún artefacto, y ningún schema se modifica. Lo que el change hace es
**clasificar** artefactos existentes en dos categorías —derivados (regenerables) y
firmados (no editables por la etapa de delivery)— pero esa clasificación vive en
prosa normativa y en el ADR, no en `schemas/`.

## Security controls (+ threat model when required)

`risk: standard` heredado del proposal, **no se baja**. Tampoco hay motivo para
subirlo: cero cambios en `src/`, sin input externo nuevo, sin permisos, sin
persistencia. `threat_model_required: false`.

- **SEC-001 — el loop nunca debilita el status de un gate.** Se implementa como
  regla explícita en `## Rules` de `sdd-commit` y como prohibición inline en el
  paso 1. Es el análogo, en delivery, del guard de ADR-011 (`## Decision`, línea
  22) sobre el cap de TDD: **un presupuesto de reintentos nunca es razón para
  debilitar una regla de seguridad.**
  **Test negativo (primero, según la regla de `sdd-apply` para tareas ligadas a un
  `SEC-N`):** el body de `sdd-commit` no debe contener ninguna instrucción de
  escribir/flipear un status de reporte —
  `doesNotMatch(/(set|change|update|edit|flip)[^.\n]{0,60}(security-report|gate report|report'?s? status)/i)`
  y `doesNotMatch(/status:\s*passed/i)`. **Mitad positiva:** el body contiene la
  prohibición y **sigue conteniendo** "Do not commit around a blocking finding" —
  la regla preexistente sobre la que SEC-001 se apoya. Si esa regla desaparece,
  SEC-001 queda huérfano, así que el test la custodia.
  *Nota de implementación para `sdd-apply`:* el regex de `status:\s*passed` hay que
  validarlo contra el body real antes de fijarlo — el paso 2 actual menciona
  `` `passed`/`not_applicable` ``, que no matchea, pero si el texto nuevo
  introdujera la forma `status: passed` habría que ajustar el regex en vez de
  ablandar la instrucción.
- **SEC-002 — superficie del change.** Sólo prosa, sus `SKILL.md` derivados y
  tests. Verificable con `git diff --stat`: nada bajo `src/`, `schemas/`,
  `templates/`.
- **Control que el change *agrega* al sistema, no sólo declara:** el chequeo de
  `pwd` es defensivo — reduce el riesgo de ejecutar un comando de verificación en
  el directorio equivocado, que es el modo de falla que ADR-011 quería cerrar. No
  es un control sobre un atacante; es un control sobre una ejecución errónea.
- **Riesgo residual (registrado en el ADR draft, no mitigado acá):** la frontera
  derivado/firmado es una lista explícita, así que un tipo de artefacto futuro
  queda sin clasificar hasta que alguien lo clasifique. Mitigación: el default es
  el lado estricto, así que un artefacto no clasificado **detiene** el loop en vez
  de ser editado.
- **Riesgo residual 2:** la regla vive en prosa dentro de un prompt, así que se
  sostiene mientras se sostenga el wiring. Para eso son las aserciones de
  contenido, y es también por qué el nivel de enforcement de esta clase se cerró
  como wiring + test de contenido (§3 del plan de wiring-gaps).

## Testing strategy

- **Contenido (7 tests nuevos, `test/skill-contract.test.js`)** — cubren AC-1..AC-5
  y SEC-001, más una guarda de no-regresión sobre `sdd-apply`/`sdd-new`.
  Nomenclatura `('… (AC-N)')`, consistente con las aserciones de
  packet/spec-index/contract-authoring ya presentes. Son el gate mecánico: borrar
  un wiring rompe `npm test`.
- **Drift (`npm run generate:check`)** — AC-6, ya en el pipeline y en CI.
- **Regresión (`npm test`)** — AC-7. Referencia: 345 tests verdes en `main`
  (`7054b9e`); con los 7 nuevos deberían quedar 352.
- **TDD (`sdd-apply`)** — las aserciones se escriben **antes** de tocar los
  `canonical.md`. Las de AC-1..AC-5 y la positiva de SEC-001 deben fallar en rojo;
  la negativa de SEC-001 y la guarda de `sdd-apply`/`sdd-new` pasan desde el
  arranque y deben seguir pasando. La tarea ligada a SEC-001 escribe **primero** su
  mitad negativa.
- **Sin runtime/E2E.** `runtime_relevant_capabilities: []`: el change no toca
  `src/`, así que no hay comportamiento ejecutable nuevo que un adapter pueda
  manejar. El artefacto es texto de instrucciones.
- **Límite honesto de esta estrategia:** los tests verifican que la instrucción
  **está**, no que un agente la **obedezca**. El comportamiento nuevo de
  `sdd-commit` (regenerar y reintentar, detenerse ante un artefacto firmado) no es
  ejercitable por `node --test` — se ejercitará recién cuando un ciclo futuro
  tropiece con un `validate` fallido, y con la skill reinstalada. Vale decirlo en
  vez de dar por verificado algo que no lo está.

---

**Para el tech lead:** revisar sobre todo (a) el texto del paso 1 de `sdd-commit`
—es el único cambio de *comportamiento* del ciclo— y (b) si la lista de artefactos
firmados debe incluir algo más. Un humano pone `status: approved`; este skill nunca
se autoaprueba.
