---
schema: verification-report
schema_version: 2
change_id: runtime-coverage-per-criterion-capabilities
status: passed
updated: '2026-11-04'
source_binding:
  manifest_path: >-
    openspec/changes/runtime-coverage-per-criterion-capabilities/handoff-manifest-sdd-verify-6c3eed6386f8f8f1df2b479fbcd62c34c61f83b14d09a097c63088fb0b619d0f.json
  manifest_hash: 6c3eed6386f8f8f1df2b479fbcd62c34c61f83b14d09a097c63088fb0b619d0f
  governed_manifest_hash: 830306066681feeea51761dd4b9a29bfbe13c005a8960f183ee9c6c2f330acd8
  repositories:
    - name: loom
      branch: main
      commit_sha: 678a8f283ca39d668d05420029c793bd04eebcc9
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
      path: .specloom/runs/1793837245856-c4508cee-fPsOl2/execution-receipt.json
      sha256: bea4462d7484ac138337cfc34f635d4a849ea7f26a92f9c7cf9c0f851b0cf82a
    - repository: loom
      path: .specloom/runs/1793837264306-a1ad4c95-tyd4zN/execution-receipt.json
      sha256: 6aa34f441e6ea305849b3d0b247720f0ff8d87625f70c093922c4fa477da70c6
    - repository: loom
      path: .specloom/runs/1793837265823-e5a5b1b0-W7A6xQ/execution-receipt.json
      sha256: 5099aabb902f481efa7a164dcf8af1022cd8f91c47ef3978f45cd472b17951ac
    - repository: loom
      path: .specloom/runs/1793837274963-2d5cc586-LeOjj5/execution-receipt.json
      sha256: 9e05cead2d27ad86d9f1d397706fc60df450a6607f0e1f9052a6ccb749064758
    - repository: loom
      path: .specloom/runs/1793837507917-bc3fe70a-eve8Yd/execution-receipt.json
      sha256: 9493fa96efbbe220f214b9d838b809e5d2a557063ab0452a1aef36f24405c49c
    - repository: loom
      path: .specloom/runs/1793837508813-9fcf8e0d-gbpcXo/execution-receipt.json
      sha256: e4a102276594febf97aa2d0028cf4d15f14f688c4c2ab20a018b2e81bb36a2d7
  delivery_state: merged
---
# Verification Report — Cobertura de runtime por criterio con omisiones explícitas de capacidades

Verificado en la rama base `main`, en el merge commit `678a8f2` del PR #35 (merge commit con
padres `09da47c` y `603a088`). Se usó el worktree `~/ai-sdd-playbooks-wt/runtime-coverage-per-criterion-capabilities`
con `main` local avanzado por fast-forward a `origin/main`. El CLI global (`~/ai-sdd-playbooks`,
desacoplado en el tag local `v0.12.0` = `678a8f2`) es el código mergeado; el checkout principal no se modificó.
Todos los comandos corrieron con `playbook run --step verify --repo loom` después de comprobar `pwd`.

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any `SEC-N` without passing post-merge evidence → `status: failed`.
- Any blocking regression → `status: failed`.
- Never proceed to `sdd-archive` while `status: failed`.
- Before running any command from `tasks.md`/`context-packet.md`, verify `pwd`
  first — never assume the cwd inherited from a prior task or step.

## Acceptance criteria

| # | Criterion | Test/Check | Result |
|---|---|---|---|
| AC-1 | Esquema de `tasks.md` y del manifest para `runtime_not_applicable` | `test/handoff-schema.test.js` (dos pruebas); recibo `1793837245856-c4508cee-fPsOl2` | passed |
| AC-2 | `playbook packet` transporta la lista; ausente o vacía no cambia el manifest | `test/handoff.test.js`; invocación real del CLI mergeado (lista válida transportada), recibo `1793837264306-a1ad4c95-tyd4zN` | passed |
| AC-3 | Omisión válida sin `not mapped` ni fila de cobertura | `test/runtime-coverage.test.js`; validador mergeado sin problemas, recibo `1793837265823-e5a5b1b0-W7A6xQ` | passed |
| AC-4 | Sin omisión, el error `not mapped` se mantiene | `test/runtime-coverage.test.js` | passed |
| AC-5 | La exigencia por adaptador se mantiene | `test/runtime-coverage.test.js` | passed |
| AC-6 | El error multi-repo indica partir la entrada | `test/runtime-coverage.test.js` | passed |
| AC-7 | `sdd-plan` y `sdd-runtime-gate` documentan la regla; `generate` sin diferencias | `test/skill-contract.test.js`; `npm run generate:check`, recibo `1793837507917-bc3fe70a-eve8Yd` | passed |
| AC-8 | ADR que complementa ADR-043 sin editarlo | Dos ADR drafts en la carpeta del change, válidos para `playbook validate --ci`; ADR-043 sin cambios en el diff | passed |
| AC-9 | Versión `0.12.0` y CHANGELOG | `test/readme.test.js` (`release version, changelog and CI pins agree at 0.12.0`) | passed |
| AC-10 | `node --test` en verde | `npm test`: 873 pruebas, 865 pasan, 0 fallan, 8 `todo` preexistentes; recibo `1793837274963-2d5cc586-LeOjj5` | passed |

## Error cases

| # | Error case | Test/Check | Result |
|---|---|---|---|
| EC-1 | Motivo vacío o en blanco | `test/runtime-coverage.test.js` | passed |
| EC-2 | Par criterio/repositorio no mapeado | `test/runtime-coverage.test.js` | passed |
| EC-3 | Capacidad deshabilitada o desconocida | `test/runtime-coverage.test.js` | passed |
| EC-4 | Capacidad mapeada y omitida a la vez | `test/runtime-coverage.test.js` | passed |
| EC-5 | Criterio o repositorio desconocidos | `test/runtime-coverage.test.js` | passed |
| EC-6 | Omisiones duplicadas | `test/runtime-coverage.test.js` | passed |
| EC-7 | Lista mal formada en packet y en el validador | `test/handoff.test.js` y `test/runtime-coverage.test.js`; CLI mergeado: `runtime_not_applicable: nope` sale con exit 1 y `error: tasks.md handoff.runtime_not_applicable must be a list`, sin escribir manifest (recibo `1793837264306-a1ad4c95-tyd4zN`) | passed |

## Security considerations

| # | Control | Test/Check (negative, re-run post-merge) | Result |
|---|---|---|---|
| SEC-1 | Sin secretos ni datos personales | El diff mergeado contra `09da47c` es el revisado por el security gate (escaneo sin patrones de secretos); no hubo cambios después del merge | passed |
| SEC-2 | Omisiones explícitas y validadas, cubiertas por el hash del manifest | Pruebas negativas EC-1 a EC-6 y `runtime_not_applicable travels to the manifest and into the governed digest`, recibo `1793837245856-c4508cee-fPsOl2` | passed |
| SEC-3 | La exigencia por adaptador no cambia | `an omission never replaces the per-adapter evidence requirement (AC-5, SEC-3)`, mismo recibo | passed |
| SEC-4 | Entradas mal formadas fallan cerradas | Pruebas de EC-7 (incluido `null`) y el CLI mergeado rechazando la lista mal formada (recibo `1793837264306-a1ad4c95-tyd4zN`) | passed |
| SEC-5 | Riesgo aceptado registrado | `security checklist records the unverifiable rationale of runtime_not_applicable as an accepted risk (SEC-5)` | passed |

## Regression

**Result**: sin regresiones bloqueantes. `npm test` sobre `main` mergeado: 873 pruebas, 865
pasan, 0 fallan, 0 canceladas, 8 `todo` preexistentes (recibo `1793837274963-2d5cc586-LeOjj5`).
`npm run generate:check` sin diferencias (recibo `1793837507917-bc3fe70a-eve8Yd`).
`playbook validate --ci`: 14 artefactos, 0 fallos, 0 `local-only`; 6 comprobaciones figuran como
`after_delivery`, que corresponde a los gates previos juzgados ya entregados (recibo
`1793837508813-9fcf8e0d-gbpcXo`).

## Seguimiento pendiente (no bloquea)

- F-1 del security report: en `sdd-archive`, ajustar la redacción del ADR draft y de la fila del
  checklist (el control humano sobre `tasks.md` es la revisión del pull request).
- El tag `v0.12.0` existe solo en local; los workflows que instalan `semver:^0.12.0` necesitan
  que el tag esté publicado en `origin`.
