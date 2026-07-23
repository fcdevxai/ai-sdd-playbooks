---
schema: code-review-report
schema_version: 1
change_id: restore-contract-first
status: passed
updated: 2026-07-23
---
# Code Review Report — Contract-first operativo

## Checklist
- [passed] AC-1 covered by `test/contract-first.test.js` ("AC-1: contract-drift on an empty canonical contract reports no drift") + dogfood en vivo (`playbook contract-drift` contra el propio repo → exit 0)
- [passed] AC-2 covered by `test/contract-first.test.js` ("AC-2: an endpoint present in generated but not canonical is reported UNDOCUMENTED")
- [passed] AC-3 covered by `test/contract-first.test.js` ("AC-3: validate --ci accepts a playbook.config.yaml that declares contract:") + dogfood en vivo (`playbook validate --ci` sobre el propio config real)
- [passed] AC-4 covered by `test/contract-first.test.js` ("AC-4: the contract-drift-check.yml template exists, is valid YAML, and documents backend install") + `README.md` sección "Contract-first"
- [passed] EC-1 covered by `test/contract-first.test.js` ("EC-1: a config without contract.path_in_loom fails with a clear message, not a stack trace")
- [passed] EC-2 covered by `test/contract-first.test.js` ("EC-2: a missing canonical contract file fails with a clear 'not found' message")
- [passed] SEC-1 covered by `test/contract-first.test.js` ("SEC-1: the contract-drift-check.yml template contains no secrets or credential material")
- [passed] No changes outside `## Constraints and non-goals` — los 6 archivos tocados (`README.md`, `playbook.config.yaml`, `templates/project/playbook.config.yaml`, `openspec/specs/contracts/openapi.yaml`, `templates/project/github/workflows/contract-drift-check.yml`, `test/contract-first.test.js`) mapean 1:1 a tareas de `tasks.md`; `src/repos/contract-drift.js` no se modificó (ya estaba implementado, como declara la proposal)
- [passed] Conventions & quality gates respected — `npm test` (298/298) y `npm run generate:check` (sin drift) corridos vía `playbook run --change restore-contract-first --step apply` (ADR-009 compaction); sin formateador/linter configurado en el repo (n/a, no un gate saltado)

## Issues found

Ninguno. La implementación cubre los 4 AC, los 2 EC y el SEC-1 con evidencia de test, no toca nada fuera del scope declarado, y fue dogfoodeada en vivo contra el propio repo (no solo contra fixtures de test): `playbook contract-drift` reporta 0 diffs sobre el contrato canónico real, y `playbook validate --ci` acepta el `playbook.config.yaml` real con la sección `contract:` agregada.

### Nota de scope (no bloqueante)

`playbook.config.yaml` (root) no estaba listado en `## Impacted modules` original de la proposal, pero sí está declarado explícitamente en `tasks.md` (Task 1.2) — es consistente con el objetivo de la feature (dogfoodear contract-drift contra el propio repo) y no introduce alcance no planificado.
