---
schema: proposal
schema_version: 1
change_id: contract-first-authoring
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
impact:            # any true → sdd-design becomes required
  public_contract: false
  data_model: false
  architecture_boundary: true   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: []     # PROPUESTO — ver nota al reviewer en SEC-1
runtime_relevant_capabilities: []   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
---

# Authoring del contrato canónico en `sdd-design`

## Objective

`README.md:168-176` promete que el contrato de API que el hub posee se autora en
`openspec/specs/contracts/openapi.yaml` — "loom-first, durante `sdd-plan`, antes
de que el backend lo implemente", arrancando en `paths: {}` y llenándose feature
por feature. **Ningún skill implementa esa promesa**: `grep -i 'openapi|contract-drift'`
sobre `skills/*/canonical.md` no devuelve nada. El contrato de este repo existe
sólo porque se escribió a mano (commit `cb18657`), y `playbook init` no lo
scaffoldea (el bloque `contract:` viene comentado en
`templates/project/playbook.config.yaml:38`).

Es la misma clase de defecto que nombró ADR-029 — una capacidad alcanzable desde
el flujo sólo como prosa, o acá directamente inalcanzable — y el change previo
`restore-contract-first` la vuelve más filosa, no más suave: dejó operativo el
lado de **verificación** (`playbook contract-drift`, su bloque de config, el CI
template y 7 tests en `test/contract-first.test.js`), así que hoy el hub puede
detectar drift contra un contrato que nada en el ciclo escribe nunca. Sin el
authoring cableado, el contrato canónico se llena por ingeniería inversa de la
implementación — exactamente la inversión que "loom-first" existe para evitar.

Este change cablea el paso de authoring en `sdd-design` y corrige la promesa del
README.

## Guiding principle

**Las skills se regeneran, no se editan a mano** (Principio 1): toda edición va
en `skills/<slug>/canonical.md` + `npm run generate`; `SKILL.md` es derivado y
`generate:check` no debe reportar drift.

El paso va en **`sdd-design` y no en `sdd-plan`** porque un contrato público
compartido entre repos es difícil de revertir y merece un gate de revisión:
`design.md` es el único artefacto pre-implementación cuyo `status: approved` lo
mueve un **humano** (`sdd-design` nunca se auto-aprueba), mientras `tasks.md` no
tiene gate. Y la objeción estructural habitual a poner trabajo en `sdd-design`
—"puede saltarse"— no aplica a este trigger: `computeDesignRequired`
(`src/lifecycle/impact.js:11`) devuelve true si *cualquier* `impact.*` es true,
así que `impact.public_contract: true` **garantiza** que la etapa de diseño
existe. Enforcement: **wiring + test de contenido** (gate mecánico duro contra un
merge futuro que borre la instrucción), sin reglas nuevas en `playbook validate`
ni hooks.

## Impacted modules

- `skills/sdd-design/canonical.md`: paso condicional de authoring del contrato
  canónico (guarda `impact.public_contract: true` + `contract.path_in_loom`),
  regla de coherencia con `## Public contracts / interfaces`, y la regla SEC-1.
- `skills/sdd-design/SKILL.md`: regenerado vía `npm run generate`.
- `README.md` (líneas 168-176): corregir `sdd-plan` → `sdd-design` en la promesa
  de authoring.
- `test/skill-contract.test.js`: aserciones de contenido que blindan el wiring.
- `openspec/changes/contract-first-authoring/adr-contract-authoring-owned-by-design.md`:
  draft de ADR (lo numera y promueve `sdd-archive`).

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

No aplica: single-repo (`playbook-ai`).

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un change cuya proposal declara `impact.public_contract: true` y un
  proyecto que declara `contract.path_in_loom`, **When** corre `sdd-design`,
  **Then** el skill instruye agregar o actualizar los endpoints de esa feature en
  el archivo que apunta esa clave, con el mismo set de endpoints que
  `## Public contracts / interfaces` de `design.md`, para que el humano apruebe
  diseño y contrato en la misma firma.
- **Given** un proyecto sin API compartida (`contract.path_in_loom` ausente),
  **When** corre `sdd-design` sobre un change con `public_contract: true`,
  **Then** el skill omite el paso y lo reporta explícitamente — contract-first es
  opt-in y no hay ruta por defecto.
- **Given** el README, **When** alguien busca cuándo se autora el contrato,
  **Then** encuentra `sdd-design` y no `sdd-plan`.

### Edge cases

- **Given** `contract.path_in_loom` configurado pero el archivo inexistente,
  **When** corre el paso, **Then** el skill lo crea con el esqueleto mínimo
  (`openapi`, `info`, `paths`) más los endpoints de la feature. Nada más lo crea:
  ni `playbook init` ni `bootstrap`.
- **Given** `impact.public_contract: false` con `contract.path_in_loom`
  configurado, **When** corre `sdd-design`, **Then** el contrato no se toca.
- **Given** un change que sí toca una API pero declara `public_contract: false`,
  **When** corre el ciclo, **Then** el authoring se omite en silencio. El trigger
  es un campo de la proposal confirmado por un humano, y declararlo mal ya hoy
  saltea toda la etapa de diseño: este change no agrega ese riesgo, lo hereda.

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** `skills/sdd-design/canonical.md` instruye agregar/actualizar los
endpoints de la feature en el contrato canónico cuando la proposal declara
`impact.public_contract: true`.
**AC-2:** esa instrucción referencia `contract.path_in_loom` como fuente de la
ruta y no hardcodea `openspec/specs/contracts/openapi.yaml` como destino de
escritura; e instruye omitir el paso y reportarlo cuando la clave no está
configurada.
**AC-3:** la instrucción exige que el contrato canónico y
`## Public contracts / interfaces` de `design.md` describan el mismo set de
endpoints, revisados en la misma firma humana.
**AC-4:** la instrucción prohíbe secretos, tokens reales y PII en el contrato
(`example`/`description`/`servers`) — SEC-1.
**AC-5:** `README.md` describe el authoring del contrato en `sdd-design` y ya no
lo promete en `sdd-plan`.
**AC-6:** `npm run generate:check` no reporta drift entre
`skills/sdd-design/canonical.md` y `skills/sdd-design/SKILL.md`.
**AC-7:** `test/skill-contract.test.js` incluye aserciones que fallan si se borra
cualquiera de los wirings de AC-1..AC-4 o si el README vuelve a prometer
`sdd-plan`; `npm test` queda verde.

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1. -->

**EC-1:** `impact.public_contract: true` sin `contract.path_in_loom`: el skill
omite el authoring y lo dice. No inventa ruta, no crea el archivo, no bloquea el
diseño.
**EC-2:** `contract.path_in_loom` apunta a un archivo inexistente: el skill lo
crea con el esqueleto mínimo más los endpoints de la feature.
**EC-3:** si un merge futuro borra la instrucción de `canonical.md`,
`test/skill-contract.test.js` falla nombrando la aserción rota — en vez de volver
al estado actual (promesa en el README, nada en el flujo).
**EC-4:** si `canonical.md` y `SKILL.md` quedan desincronizados, `npm run
generate:check` falla reportando el drift.

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** El paso de authoring no debe introducir secretos, tokens reales ni PII
en `example`/`description`/`servers` del contrato canónico. Un contrato es un
artefacto versionado que se comparte con todos los repos consumidores: lo que
entra ahí queda en el historial de git de cada uno, así que una filtración es
efectivamente permanente. La regla se escribe **dentro** de la instrucción, no
sólo acá, y AC-4 la blinda con un test de contenido.
*Nota al reviewer sobre `security.triggers`:* se propone `[]`. Se consideró
`secrets`, pero el trigger describe lo que el change **toca**, y este change no
maneja secretos: agrega una prohibición sobre un artefacto que hoy nadie escribe.
Declararlo distorsionaría la clasificación del gate. Corregir si preferís el
criterio conservador.
**SEC-2:** Superficie del change: cero cambios en `src/`. Sólo prosa de
`canonical.md`, su `SKILL.md` derivado, `README.md` y tests. No agrega input
externo, permisos, persistencia ni lógica de autenticación/autorización.
`playbook contract-drift` no se toca: sigue siendo read-only y CI-only.

## Constraints and non-goals

- **No-goal:** cablear el authoring en `sdd-plan` — decidido y registrado en el
  draft de ADR (`adr-contract-authoring-owned-by-design.md`), con las dos
  alternativas descartadas y su razón.
- **No-goal:** tocar `playbook contract-drift`, su bloque de config o el CI
  template `templates/project/github/workflows/contract-drift-check.yml`. Es
  CI-only por diseño y ya está operativo y testeado (`test/contract-first.test.js`).
- **No-goal:** llenar el `openapi.yaml` de este repo — queda en `paths: {}`.
  `playbook-ai` no expone una API HTTP (`capabilities.http: false`); el contrato
  existe para que `contract-drift` y su suite tengan una config real que ejercitar.
- **No-goal:** scaffoldear el archivo canónico en `playbook init` — el authoring
  lo crea cuando hace falta (EC-2), y un proyecto sin API compartida no debe
  recibir un contrato vacío que nadie pidió.
- **No-goal:** enforcement en `playbook validate` o hooks. §3 del plan de
  wiring-gaps lo descartó explícitamente para esta clase de gap.
- **Constraint:** las skills se editan sólo en `canonical.md` + `npm run
  generate`; `SKILL.md` es derivado.
- **Constraint:** la ruta del contrato nunca se hardcodea en la instrucción —
  sale de `contract.path_in_loom`, misma convención que la detección de base
  branch en `sdd-commit` (`skills/sdd-commit/canonical.md:64`).
- *Nota al reviewer sobre `impact.architecture_boundary: true`:* se propone
  `true` porque el change **reasigna la propiedad de un artefacto entre dos
  etapas del ciclo** (del `sdd-plan` prometido al `sdd-design` decidido) y
  establece una convención transversal nueva, que es justamente lo que registra
  el draft de ADR. Contraste con el Ciclo A (`token-saving-parity`, todos los
  impacts en `false`, sin ADR): ahí se **restauraba** una convención ya decidida
  en ADR-010/ADR-012; acá se **crea** una. Consecuencia si lo confirmás:
  `design_required: true`, así que `playbook next` va a rutear a `sdd-design`
  antes de `sdd-plan`. Si lo corregís a `false`, se saltea el diseño y el resto
  del ciclo no cambia.
- *Nota al reviewer sobre `runtime_relevant_capabilities: []`:* mismo criterio y
  precedente que `cli-detect-siblings` y `token-saving-parity`. La única
  capability habilitada es `cli: true`, cuyo adapter de runtime-gate es sobre un
  harness E2E real (experimental, no implementado) y bloquearía
  (`ADAPTER_NOT_IMPLEMENTED`) cualquier change que lo declare relevante. Este
  change es más claro que los anteriores: no toca `src/` en absoluto, así que no
  hay superficie de runtime que ejercitar — la verificación es por tests de
  contenido y `generate:check`.

## Open technical decisions

<!-- Empty if none. -->

Ninguna. Las dos decisiones que el plan de wiring-gaps dejaba abiertas
(`sdd-plan` vs `sdd-design`, y si la convención amerita un ADR) se cerraron en
`sdd-enrich-us` y están registradas en el draft de ADR.

**Nota de dogfooding:** este change lleva `impact.public_contract: false` (no
cambia ninguna API), así que la instrucción nueva **no se ejercita sobre sí
misma** en el camino feliz. Si el reviewer confirma
`architecture_boundary: true`, `sdd-design` corre igual y ejercita el camino de
EC-3 (`public_contract: false` → el contrato no se toca). La verificación de
AC-1..AC-5 es por test de contenido, no por ejecución real del authoring.
