---
schema: code-review-report
schema_version: 2
change_id: runtime-coverage-per-criterion-capabilities
status: passed
updated: '2026-11-04'
source_binding:
  manifest_path: >-
    openspec/changes/runtime-coverage-per-criterion-capabilities/handoff-manifest-sdd-code-review-b3729519ef8570cf617358d48c53a211738bbe157b400f7e6df8a20a02987620.json
  manifest_hash: b3729519ef8570cf617358d48c53a211738bbe157b400f7e6df8a20a02987620
  governed_manifest_hash: 3a49f1a68690bc9a6053c85f3750c84a9835f351b2fedd236d9a02af2112f1fd
  repositories:
    - name: loom
      branch: runtime-coverage-per-criterion-capabilities
      commit_sha: 09da47cef366833b9845c0171e08a8cd545d7cba
      source_hash: c2b112de0d2165a662018e32a0a4ecc004ca6ebb6da858a63f067c17d44d4121
      tree_hash: 661a6724271e1af2d1c48eebab546994b1682744798b21e3e430d9ac7c4fb459
  proposal_hash: 60b794ec33e9273427b0a7fb5f6ef89a9114a9f548f2503826627536b1b977b1
  design_hash: unknown
  normative_tasks_hash: dae7c31f51ef3eba745f7b4e7d21b69d0f1cc214e6b59b798de4e97d2f58f5bc
  contract_hashes:
    - path: openspec/specs/contracts/openapi.yaml
      hash: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
  receipts:
    - repository: loom
      path: .specloom/runs/1793833678810-53030179-2hz88a/execution-receipt.json
      sha256: 614423d18121a97dff2de52ed38dc65825526efe0665c3bbae8f60559392e7f6
    - repository: loom
      path: .specloom/runs/1793833678029-700ae678-CAnYqP/execution-receipt.json
      sha256: 16689d6065b24ecf21329b2856f19d72656465125c8c64dc97679245dce37dac
  delivery_state: uncommitted
---
# Code Review Report — Cobertura de runtime por criterio con omisiones explícitas de capacidades

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- A criterion without passing evidence, a file changed outside scope, or a
  required quality gate not executed remains blocking regardless of finding
  classification.
- Do not suggest improvements outside spec scope.

## Alcance revisado

Diff de la rama `runtime-coverage-per-criterion-capabilities` contra `origin/main` (`09da47c`):
20 archivos más la carpeta del change. `playbook changed-files` usa una base anterior (no existe
`main` local en el worktree) y lista además el archivado de `bounded-review-loops` y dos docs
que ya están en `origin/main`; esos archivos no forman parte de este change y no se revisaron.
El `context-packet.md` coincide con `proposal.md` y `tasks.md` vigentes.

## Checklist

- [passed] AC-1 cubierto por `test/handoff-schema.test.js` (aceptación y rechazo en `tasks` y en el manifest).
- [passed] AC-2 cubierto por `test/handoff.test.js` (transporte, hash gobernado, lista ausente o vacía).
- [passed] AC-3, AC-4, AC-5 cubiertos por `test/runtime-coverage.test.js` y por los recibos antes/después de la tarea 2.3.
- [passed] AC-6 cubierto por `test/runtime-coverage.test.js` (mensaje con y sin indicación de partir la entrada).
- [passed] AC-7 cubierto por `test/skill-contract.test.js` y `npm run generate:check`.
- [passed] AC-8: dos ADR drafts en la carpeta del change, válidos para `playbook validate`; ADR-043 sin cambios.
- [passed] AC-9 cubierto por `test/readme.test.js`.
- [passed] AC-10: `npm test` verde (873 pruebas, 865 pasan, 8 `todo` preexistentes).
- [passed] EC-1 a EC-6 cubiertos por una prueba cada uno en `test/runtime-coverage.test.js`.
- [passed] EC-7: el validador reporta una lista mal formada sin lanzar excepción y `playbook packet` rechaza listas que no son arreglo, incluido `null` (Issue 1 corregido en la ronda 2; `test/handoff.test.js`).
- [passed] No hay cambios fuera de `## Constraints and non-goals`. `README.md` y las dos plantillas CI están en `Files` de la tarea 4.2 y en `unresolved_risks` (pins que `test/readme.test.js` exige iguales a la versión); la proposal no los excluye.
- [passed] Convenciones y capas: la lógica de validación vive en `src/lifecycle/` sin IO; la validación de forma y el transporte, en `src/tokens/`; los `SKILL.md` se regeneraron desde `canonical.md`.
- [passed] Quality gates de la tarea ejecutadas en `sdd-apply` (recibos en `tasks.md`) y pruebas focalizadas repetidas en esta revisión.

## Issues found

### Issue 1 — `playbook packet` acepta `runtime_not_applicable` con valor `null` (resuelto en la ronda 2)
- **File**: `src/tokens/handoff.js:191`
- **Problem**: EC-7 y SEC-4 exigen que `playbook packet` falle con un mensaje cuando
  `handoff.runtime_not_applicable` no es una lista. La expresión
  `handoff.runtime_not_applicable ?? []` convierte `null` en lista vacía, así que un
  `runtime_not_applicable:` sin valor, o una lista mal indentada que YAML lee como `null`, se
  acepta en silencio y el manifest se genera sin las omisiones que el autor quiso declarar.
  Escenario realista dentro del modelo de amenaza (error honesto al escribir `tasks.md`).
  Reproducido por el camino real: `writeHandoffManifest` sobre un `tasks.md` con
  `runtime_not_applicable:` vacío devuelve `{"packet":"accepted","manifest_has_field":false}`
  (recibo `1793829528892-0849bcb2-gH7ecF`). El efecto posterior sigue fallando cerrado (el
  validador reporta `enabled capability … not mapped` y el esquema de `tasks.md` rechaza `null`),
  pero el criterio EC-7 no se cumple en `playbook packet`.
- **Suggested fix**: tratar como ausente solo `undefined`
  (`handoff.runtime_not_applicable === undefined ? [] : handoff.runtime_not_applicable`) y agregar
  a `test/handoff.test.js` el caso `runtime_not_applicable:` sin valor, que debe fallar con
  `runtime_not_applicable must be a list`.
- **Resolución (ronda 2)**: aplicada la corrección sugerida en `src/tokens/handoff.js:191-192` y
  agregado el caso `runtime_not_applicable:` sin valor a la prueba de lista mal formada. La misma
  reproducción ahora devuelve `{"packet":"rejected","message":"tasks.md handoff.runtime_not_applicable must be a list"}`
  (recibo `1793833678029-700ae678-CAnYqP`). El diff del arreglo solo cambia el trato de `null`:
  la clave ausente sigue equivaliendo a lista vacía y cualquier otro valor que no sea arreglo ya
  fallaba; no introduce hallazgos nuevos.

## Follow-ups

| finding | unmet condition | owner | destination (new change, issue, accepted as-is) |
|---|---|---|---|
| `playbook changed-files` usa una base anterior a `origin/main` en un worktree sin `main` local y lista archivos ajenos al change | No cita un AC/EC/SEC ni un ítem del checklist de este change; afecta solo la lectura del revisor | maintainers | Issue nueva en `ai-sdd-playbooks` |
| La tarea 2.1 decía ajustar la prueba `repository-specific capability applicability excludes unrelated workspaces`; no fue necesario porque sin omisión la regla se conserva, y el caso con omisión se cubre con pruebas nuevas | No incumple un criterio: AC-4 queda cubierto; es una diferencia entre el texto del plan y lo ejecutado, ya anotada en el Execution Report | maintainers | Aceptado tal cual |

## Review rounds

| round | full or delta | date | commit reviewed | blocking findings | result |
|---|---|---|---|---|---|
| 1 | full | 2026-11-04 | `09da47c` + árbol de trabajo sin commitear | 1 (Issue 1, EC-7) | failed |
| 2 | delta | 2026-11-04 | `09da47c` + árbol de trabajo sin commitear, con la corrección de Issue 1 | 0 | passed |

## Recibos de esta revisión

| ID | Comando | Resultado |
|---|---|---|
| `1793829528892-0849bcb2-gH7ecF` | `node cr-null-repro.mjs <worktree>` (script fuera del repo) | Reproduce Issue 1: `packet` acepta `null` |
| `1793829529954-66a70dab-py4wWe` | `node test/helpers/run-tests.js test/runtime-coverage.test.js test/handoff.test.js test/handoff-schema.test.js test/skill-contract.test.js test/readme.test.js` | Verde, 112 pruebas (ronda 1) |
| `1793833678029-700ae678-CAnYqP` | `node cr-null-repro.mjs <worktree>` | Ronda 2: `packet` rechaza `null` con el mensaje de EC-7 |
| `1793833678810-53030179-2hz88a` | mismas pruebas focalizadas | Verde, 112 pruebas (ronda 2) |
| `1793833418879-3cad94a7-mPcvJj` | `npm test` (paso `apply`, tras la corrección) | Verde, 873 pruebas (865 pasan, 8 `todo` preexistentes) |
| `1793833646936-7dd10735-rFRp0y` | `npm run generate:check` (paso `apply`, tras la corrección) | Verde |
