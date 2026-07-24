---
sources:
  proposal: 5bb031a6a39a9220f7622245eb0bdb9b138fae0e81f813c4e736b2494c03b2d7
  tasks: 0e4ad20bbcfa1d0bcad43726a8122829e3e15e630832658be09341df523e1341
---
# Context Packet — Authoring del contrato canónico en `sdd-design`

## Ticket

contract-first-authoring

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

## Files touched

- `test/skill-contract.test.js`
- `skills/sdd-design/canonical.md`
- `skills/sdd-design/SKILL.md`
- `README.md`

## Verification commands

- `(sin formatter configurado)`
- `node --check test/skill-contract.test.js`
- `node --test test/skill-contract.test.js`
- `npm test`
- `npm run generate:check`

## Full sources

- openspec/changes/contract-first-authoring/proposal.md
- openspec/changes/contract-first-authoring/tasks.md
