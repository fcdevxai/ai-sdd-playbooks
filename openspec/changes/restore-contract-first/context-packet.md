---
sources:
  proposal: 3ab453ed12cc6e21de4ae3512a6a5ac7ae841e9bebfe52569fa4894aac843038
  tasks: 6ab2073f3f2ed654cb0902339378ddf06f07983461b54b34bc48b0e4cb984f7e
---
# Context Packet — Contract-first operativo

## Ticket

restore-contract-first

## Acceptance criteria

**AC-1:** `playbook contract-drift openspec/specs/contracts/openapi.yaml` corre sin el error "no contract configured"; con `paths: {}` reporta 0 diffs y sale 0.
**AC-2:** Un OpenAPI de prueba con un endpoint extra respecto al canónico → `contract-drift` sale ≠ 0 y nombra el endpoint como `UNDOCUMENTED`.
**AC-3:** `playbook validate --ci` acepta un `playbook.config.yaml` que incluye la sección `contract:`.
**AC-4:** Existe `templates/project/github/workflows/contract-drift-check.yml`, con cabecera que documenta que se instala en el CI del backend (no en el repo hub).

## Constraints and non-goals

- No implementar la generación del OpenAPI del backend (es responsabilidad del stack del backend; el template deja ese paso como TODO documentado).
- No autorar endpoints reales en el contrato canónico (arranca `paths: {}`; se llenan feature por feature en `sdd-plan`).
- El drift-check sigue siendo **estructural** (no valida tipos, params query/path, responses ni enums) — fuera de alcance.

## Security considerations

**SEC-1:** El template `contract-drift-check.yml` no incluye secretos ni credenciales: genera el OpenAPI del backend y corre un diff estructural sin acceso privilegiado. El drift-check solo lee estructura OpenAPI (endpoints, campos `required`), no datos.
Fuera de eso no aplica: la feature agrega artefactos de plantilla y una sección de config; no introduce autenticación, manejo de datos personales ni procesamiento de input en `playbook-ai` mismo.

## Files touched

- `openspec/specs/contracts/openapi.yaml`
- `templates/project/playbook.config.yaml`
- `playbook.config.yaml`
- `templates/project/github/workflows/contract-drift-check.yml`
- `README.md`
- `test/contract-first.test.js`

## Verification commands

- `n/a (el repo no tiene formateador configurado)`
- `n/a (el repo no tiene linter configurado)`
- `npm test`
- `playbook run --change restore-contract-first --step apply`

## Full sources

- openspec/changes/restore-contract-first/proposal.md
- openspec/changes/restore-contract-first/tasks.md
