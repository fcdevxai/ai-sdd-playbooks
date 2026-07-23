---
schema: proposal
schema_version: 1
change_id: restore-contract-first
status: approved
owner: pending
created: 2026-07-23
updated: 2026-07-23
impact:
  public_contract: false
  data_model: false
  architecture_boundary: false
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: []
runtime_relevant_capabilities: []   # cli:true is a project capability, not touched by this change (no CLI command added/modified) — added post-approval with human sign-off at sdd-runtime-gate; see security-report.md "Notes"
---

# Contract-first operativo

## Objective

Volver operativo el contract-first que la fusión dejó a medias: la lógica de diff estructural (`src/repos/contract-drift.js`) está portada y testeada, pero los tres artefactos que la vuelven usable fueron eliminados — el OpenAPI canónico, el template de CI del backend, y la sección `contract:` de la config. Restaurarlos para que `playbook contract-drift` funcione out-of-the-box y un backend pueda gatearse contra el contrato compartido.

## Guiding principle

Restaurar artefactos, no reescribir lógica: el diff estructural ya existe y pasa tests. Esta feature solo repone los datos/plantillas/config que lo activan; el contrato canónico arranca vacío (`paths: {}`) para que cada endpoint se autore feature por feature.

## Impacted modules

- `openspec/specs/contracts/openapi.yaml` (nuevo — contrato canónico, arranca en `paths: {}`)
- `templates/project/github/workflows/contract-drift-check.yml` (nuevo — template para el CI del backend, no para este repo)
- `templates/project/playbook.config.yaml` (nueva sección `contract:`)
- `schemas/playbook.config.schema.json` (confirmar que acepta `contract:` — ya lo hace)
- `README.md` (documentar el flujo loom-first + drift-check en el backend)
- `src/repos/contract-drift.js` (sin cambios — ya implementado)

## Impacted repos
<!-- Single-repo change (el propio framework). Vacío: sin cross-repo gate-check. -->

## Files touched
<!-- Vacío — single-repo. -->

## Expected behavior

### Happy path (Given/When/Then)
- Given un `openspec/specs/contracts/openapi.yaml` canónico (aunque sea `paths: {}`) y `contract.path_in_loom` declarado en la config, When se corre `playbook contract-drift <openapi-generado>`, Then compara estructuralmente contra el canónico y reporta endpoints/campos faltantes o extra.
- Given el template `contract-drift-check.yml`, When se instala en el CI del repo backend, Then el CI del backend puede correr el drift-check contra el contrato del hub.

### Edge cases
- Contrato canónico con `paths: {}`: `contract-drift` corre y reporta 0 diffs (aún no hay contrato que violar).
- Un endpoint no documentado en el OpenAPI generado: se reporta como `UNDOCUMENTED` y el comando sale con código ≠ 0.

## Acceptance criteria
**AC-1:** `playbook contract-drift openspec/specs/contracts/openapi.yaml` corre sin el error "no contract configured"; con `paths: {}` reporta 0 diffs y sale 0.
**AC-2:** Un OpenAPI de prueba con un endpoint extra respecto al canónico → `contract-drift` sale ≠ 0 y nombra el endpoint como `UNDOCUMENTED`.
**AC-3:** `playbook validate --ci` acepta un `playbook.config.yaml` que incluye la sección `contract:`.
**AC-4:** Existe `templates/project/github/workflows/contract-drift-check.yml`, con cabecera que documenta que se instala en el CI del backend (no en el repo hub).

## Error cases
**EC-1:** Si falta `contract.path_in_loom` en la config, `playbook contract-drift` termina con un mensaje de error claro y accionable (no un stacktrace).
**EC-2:** Si el OpenAPI canónico no existe en la ruta declarada, el comando reporta "archivo no encontrado" de forma clara.

## Security considerations
**SEC-1:** El template `contract-drift-check.yml` no incluye secretos ni credenciales: genera el OpenAPI del backend y corre un diff estructural sin acceso privilegiado. El drift-check solo lee estructura OpenAPI (endpoints, campos `required`), no datos.
Fuera de eso no aplica: la feature agrega artefactos de plantilla y una sección de config; no introduce autenticación, manejo de datos personales ni procesamiento de input en `playbook-ai` mismo.

## Constraints and non-goals
- No implementar la generación del OpenAPI del backend (es responsabilidad del stack del backend; el template deja ese paso como TODO documentado).
- No autorar endpoints reales en el contrato canónico (arranca `paths: {}`; se llenan feature por feature en `sdd-plan`).
- El drift-check sigue siendo **estructural** (no valida tipos, params query/path, responses ni enums) — fuera de alcance.

## Open technical decisions
<!-- Ninguna. -->
