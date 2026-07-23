---
schema: tasks
schema_version: 1
change_id: restore-contract-first
status: passed
updated: 2026-07-23
---
# Tasks — Contract-first operativo

## Phase 1 — Artefactos de contrato + config

### Task 1.1 — Contrato canónico OpenAPI [x]
- **Files**: `openspec/specs/contracts/openapi.yaml`
- **Success criterion**: existe un OpenAPI 3.x válido con `info` y `paths: {}`; `playbook contract-drift openspec/specs/contracts/openapi.yaml` corre sin "no contract configured" y reporta 0 diffs (sale 0).
- **Linked acceptance criterion**: AC-1

### Task 1.2 — Sección `contract:` en la config (template + root) [x]
- **Files**: `templates/project/playbook.config.yaml`, `playbook.config.yaml`
- **Success criterion**: ambas configs declaran `contract.source_of_truth: loom-first`, `contract.path_in_loom: openspec/specs/contracts/openapi.yaml` y `contract.drift_check.ci_template`; `playbook validate --ci` sigue aceptando la config.
- **Linked acceptance criterion**: AC-3

### Task 1.3 — Template de CI del backend [x]
- **Files**: `templates/project/github/workflows/contract-drift-check.yml`
- **Success criterion**: existe el workflow (YAML válido) con cabecera que documenta "instalar en el CI del backend, no en el hub"; corre `npx --yes playbook-ai contract-drift <generado>`; el paso de generación del OpenAPI queda como TODO documentado. **Negativo (SEC-1)**: el template no contiene secretos/credenciales.
- **Linked acceptance criterion**: AC-4

### Task 1.4 — Documentar el flujo contract-first [x]
- **Files**: `README.md`
- **Success criterion**: el README tiene una sección "Contract-first" que describe loom-first + drift-check en el CI del backend, y remite al template.
- **Linked acceptance criterion**: AC-4

## Phase 2 — Tests

### Task 2.1 — Comportamiento de contract-drift (happy + UNDOCUMENTED) [x]
- **Files**: `test/contract-first.test.js`
- **Success criterion**: test AC-1 (canónico `paths:{}` → 0 diffs, exit 0) y test AC-2 (OpenAPI con endpoint extra → exit ≠0, lo marca `UNDOCUMENTED`) pasan.
- **Linked acceptance criterion**: AC-1, AC-2

### Task 2.2 — Config `contract:` + errores accionables [x]
- **Files**: `test/contract-first.test.js`
- **Success criterion**: test AC-3 (`validate --ci` acepta config con `contract:`); test EC-1 (falta `contract.path_in_loom` → error claro, no stacktrace); test EC-2 (canónico inexistente → "file not found" claro).
- **Linked acceptance criterion**: AC-3, EC-1, EC-2

### Task 2.3 — SEC-1: sin secretos en el template [x]
- **Files**: `test/contract-first.test.js`
- **Success criterion**: test que afirma que `contract-drift-check.yml` **no** contiene patrones de secreto/credencial (`secret`, `password`, `token:`, `${{ secrets.` fuera de uso legítimo nulo) — negativo de SEC-1.
- **Linked acceptance criterion**: SEC-1

## Phase 3 — Quality gates [x]
- **Format**: n/a (el repo no tiene formateador configurado)
- **Lint/type-check**: n/a (el repo no tiene linter configurado)
- **Feature tests**: `npm test` — passed (298/298), vía `playbook run --change restore-contract-first --step apply`
- **Skills en sync**: `npm run generate:check` — sin drift, vía `playbook run`
- **Regression**: `npm test` (suite completa) — passed

## Execution Report

**Status: passed.** Todas las tareas completadas; ningún STOP por ambigüedad.

### Acceptance criteria → evidence

| AC | Criterion | Test/Evidence | Result |
|---|---|---|---|
| AC-1 | `contract-drift` con canónico `paths:{}` corre sin "no contract configured", 0 diffs, exit 0 | `test/contract-first.test.js` ("AC-1: ..."); dogfoodeado en vivo: `playbook contract-drift openspec/specs/contracts/openapi.yaml` → `✅ No contract drift detected.` (exit 0) contra el propio repo | passed |
| AC-2 | Endpoint extra en el generado → `UNDOCUMENTED`, exit ≠0 | `test/contract-first.test.js` ("AC-2: ...") | passed |
| AC-3 | `playbook validate --ci` acepta config con `contract:` | `test/contract-first.test.js` ("AC-3: ..."); dogfoodeado en vivo: `playbook validate --ci` sobre el propio `playbook.config.yaml` (con `contract:` real) → todos los artefactos `valid: true` | passed |
| AC-4 | Existe `contract-drift-check.yml`, YAML válido, documenta instalación en backend | `test/contract-first.test.js` ("AC-4: ...") | passed |

### Error cases → evidence

| EC | Case | Test/Evidence | Result |
|---|---|---|---|
| EC-1 | Config sin `contract.path_in_loom` → error claro, no stacktrace | `test/contract-first.test.js` ("EC-1: ...") | passed |
| EC-2 | Contrato canónico inexistente → "File not found" claro | `test/contract-first.test.js` ("EC-2: ...") | passed |

### Security considerations → evidence

| SEC | Consideration | Test/Evidence | Result |
|---|---|---|---|
| SEC-1 | El template de CI no lleva secretos/credenciales | `test/contract-first.test.js` ("SEC-1: ...") — niega `${{ secrets. }}`, `password:`, bloques `PRIVATE KEY` | passed |

### Commands run

- `npm test` → 298/298 pass (vía `playbook run --change restore-contract-first --step apply -- npm test`; log completo en `.specloom/runs/`).
- `npm run generate:check` → sin drift (13 skills) (vía `playbook run`).
- `playbook contract-drift openspec/specs/contracts/openapi.yaml` → `✅ No contract drift detected.` (dogfood contra el propio repo, no solo fixture de test).
- `playbook validate --ci` → todos los artefactos válidos (dogfood contra el propio `playbook.config.yaml`).

### Notes

- No se creó ningún ADR: ninguna decisión tomada durante `sdd-apply` fue difícil de revertir o arquitectónicamente significativa (es restauración de artefactos ya diseñados en la proposal).
- `contract.path_in_loom` se apunta al propio `openspec/specs/contracts/openapi.yaml` del framework — correcto para dogfoodear la feature; un proyecto consumidor real apunta al contrato de su propio backend.
