---
sources:
  proposal: 60b794ec33e9273427b0a7fb5f6ef89a9114a9f548f2503826627536b1b977b1
  tasks: fcfdd1b833a23091e1b215769f9b4efd7b56ce5f318372b68295a01323110768
  contract: 2260109d99574a48c6b6a511d5963f4425e30b430daa082a75e3a115f9aaf70c
  contract_content: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
---
# Context Packet — Cobertura de runtime por criterio con omisiones explícitas de capacidades

## Ticket

runtime-coverage-per-criterion-capabilities

## Acceptance criteria

- **AC-1:** `tasks.md` acepta la lista opcional `handoff.runtime_not_applicable` con entradas `{criterion, repository, capability, rationale}`; el esquema rechaza entradas sin alguno de esos campos o con propiedades adicionales.
- **AC-2:** `playbook packet` copia la lista al handoff manifest como `runtime_not_applicable`; si la lista falta o está vacía, el manifest no incluye el campo y no cambia respecto de la versión 0.11.0.
- **AC-3:** Un par criterio/repositorio mapeado que omite una capacidad habilitada mediante una entrada válida no produce `enabled capability … not mapped` y no exige fila de cobertura para esa capacidad.
- **AC-4:** Sin entrada de omisión, una capacidad habilitada sin mapear sigue produciendo `enabled capability … not mapped`.
- **AC-5:** Toda capacidad habilitada de todo repositorio impactado sigue exigiendo un adaptador `passed` con recibos ligados a su cobertura o `not_applicable` con exclusión válida, aunque esté omitida en todos los criterios.
- **AC-6:** El error de mapeo contradictorio de una entrada multi-repo nombra el criterio, el repositorio y la capacidad, e indica partir la entrada por repositorio.
- **AC-7:** `skills/sdd-plan/canonical.md` explica cómo escribir `runtime_coverage` multi-repo y `runtime_not_applicable`; `skills/sdd-runtime-gate/canonical.md` explica que las omisiones no requieren fila de cobertura y que `--repo` de `playbook run` es el sistema probado aunque el comando corra en el contenedor de otro repositorio; `npm run generate` no deja diferencias.
- **AC-8:** Un ADR complementa ADR-043 §5 con la regla por criterio, sin editar ADR-043.
- **AC-9:** `package.json` y `package-lock.json` declaran `0.12.0` y `CHANGELOG.md` describe el cambio y su compatibilidad.
- **AC-10:** `node --test` termina en verde.

## Constraints and non-goals

- Sin cambios a la regla `receipt.repository === row.repository`.
- Sin aceptar combinaciones repositorio × capacidad deshabilitadas.
- Sin salida adicional en `playbook validate` ni en `playbook status`.
- Sin cambios al adaptador `cli`, que sigue experimental; `runtime_relevant_capabilities: []`
  lo deja excluido según ADR-032, con pruebas unitarias que fallan contra el código anterior.
- Sin editar ADR-043 ni la spec permanente `openspec/specs/cli/spec.md`: la spec cambia en
  `sdd-archive`.
- Sin corregir el mapa de `lia-institutional-token-validation`: se hace en el Hub LIA cuando este
  change esté mergeado y el `playbook` global actualizado.
- Sin tocar el checkout principal de `~/ai-sdd-playbooks`: el trabajo vive en el worktree
  `~/ai-sdd-playbooks-wt/runtime-coverage-per-criterion-capabilities`.
- Sin push ni pull request sin aprobación explícita.

## Security considerations

- **SEC-1:** No se manejan secretos, credenciales ni datos personales: el único dato nuevo es el texto de motivo en `tasks.md`, versionado y aprobado por una persona.
- **SEC-2:** La relajación no admite omisiones silenciosas: toda omisión es explícita, se valida contra el mapa de cobertura y las capacidades del repositorio, y queda cubierta por el hash del handoff manifest (modelo de amenaza de ADR-043: errores honestos de agentes o personas).
- **SEC-3:** La exigencia por adaptador no cambia: ninguna capacidad habilitada de un repositorio impactado queda sin evidencia relacionada ni exclusión validada.
- **SEC-4:** Entradas malformadas fallan cerradas: producen problemas reportados, nunca una aceptación ni una excepción no controlada.
- **SEC-5:** La veracidad del motivo de una omisión no es verificable por máquina, igual que el de `non_runtime`; se registra como riesgo aceptado en `docs/security-checklist.md`.

## Files touched

- `test/handoff-schema.test.js`
- `test/handoff.test.js`
- `schemas/tasks.schema.json`
- `schemas/handoff-manifest.schema.json`
- `src/tokens/handoff.js`
- `test/runtime-coverage.test.js`
- `src/lifecycle/runtime-coverage.js`
- `node bin/playbook.js run`
- `.specloom/runs/`
- `test/skill-contract.test.js`
- `test/readme.test.js`
- `skills/sdd-plan/canonical.md`
- `skills/sdd-runtime-gate/canonical.md`
- `docs/security-checklist.md`
- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `README.md`
- `templates/project/github/workflows/playbook-validation.yml`
- `templates/project/github/workflows/contract-drift-check.yml`

## Verification commands

- `N/A (no formatter configured)`
- `node --check src/lifecycle/runtime-coverage.js && node --check src/tokens/handoff.js && node --check test/runtime-coverage.test.js && node --check test/handoff.test.js && node --check test/handoff-schema.test.js && node --check test/skill-contract.test.js && node --check test/readme.test.js`
- `node test/helpers/run-tests.js test/runtime-coverage.test.js test/handoff.test.js test/handoff-schema.test.js test/skill-contract.test.js test/readme.test.js`
- `npm test && npm run generate:check && node bin/playbook.js validate --ci`

## Contract

- Path: `openspec/specs/contracts/openapi.yaml`

## Handoff manifest

- openspec/changes/runtime-coverage-per-criterion-capabilities/handoff-manifest.json

## Full sources

- openspec/changes/runtime-coverage-per-criterion-capabilities/proposal.md
- openspec/changes/runtime-coverage-per-criterion-capabilities/tasks.md
