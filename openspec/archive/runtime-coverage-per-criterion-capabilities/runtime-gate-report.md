---
schema: runtime-gate-report
schema_version: 2
change_id: runtime-coverage-per-criterion-capabilities
status: not_applicable
updated: '2026-11-04'
adapters:
  cli:
    status: not_applicable
    reason_code: NOT_RELEVANT_TO_CHANGE
    exclusion:
      reason: >-
        The proposal declares runtime_relevant_capabilities: [] and keeps cli
        excluded under ADR-032 (the cli adapter remains unimplemented in this
        repository). The change modifies observable CLI behavior of playbook
        packet (it now transports or rejects handoff.runtime_not_applicable) and
        of the runtime-coverage validator used by validate and evidence seal. As
        ADR-032 requires, the substitutes are a recorded playbook packet
        invocation with the pre-change CLI (0.11.0) and with this change
        (0.12.0), a before/after invocation of the validator, and the unit
        tests, several of which failed against the pre-change code during
        sdd-apply.
      authority:
        repository: loom
        path: >-
          openspec/changes/runtime-coverage-per-criterion-capabilities/proposal.md
        hash: 60b794ec33e9273427b0a7fb5f6ef89a9114a9f548f2503826627536b1b977b1
      covered_criteria:
        - AC-2
        - AC-3
        - AC-4
        - AC-5
        - AC-6
        - EC-1
        - EC-2
        - EC-3
        - EC-4
        - EC-5
        - EC-6
        - EC-7
        - SEC-2
        - SEC-3
        - SEC-4
      substitute_receipts:
        - repository: loom
          path: .specloom/runs/1793836643529-fc6106b4-N4Gg9A/execution-receipt.json
          sha256: 53dbd5317602772b1dc7186f30fd7c8669851299c7b9cc62987ead8bedd9fc26
        - repository: loom
          path: .specloom/runs/1793836645313-f94d1785-w06wcg/execution-receipt.json
          sha256: ecc472c3090a528e7ea937b06c1642d724fcfd2ff7980e903b20e5950fa33836
        - repository: loom
          path: .specloom/runs/1793836659546-bd347d14-2xlUHc/execution-receipt.json
          sha256: b1449349c57a7413ce534ef5ee3ad3cbc44c96159e96866136e6ada25dd61177
        - repository: loom
          path: .specloom/runs/1793836660179-e98ecfcc-xxFe8H/execution-receipt.json
          sha256: f4b399857d596ffc376f51712175642a37dfcb724251ddfa076cfae0941627c3
        - repository: loom
          path: .specloom/runs/1793836660804-169860d6-B8Kv1C/execution-receipt.json
          sha256: d0fe50433aec367ba05dff6b14e643ef76b2dea7009a725bd9c1d2dc9e130e1f
coverage: []
source_binding:
  manifest_path: >-
    openspec/changes/runtime-coverage-per-criterion-capabilities/handoff-manifest-sdd-runtime-gate-734fcc62e5a8eb63a97f63a7f076edb8b515416d80f3c4c5a454e7f8b4ded97a.json
  manifest_hash: 734fcc62e5a8eb63a97f63a7f076edb8b515416d80f3c4c5a454e7f8b4ded97a
  governed_manifest_hash: 7ae1ff274f786d00f4e89095de14f2be4969b6634bbf1dd2744cd76431619fd4
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
      path: .specloom/runs/1793836643529-fc6106b4-N4Gg9A/execution-receipt.json
      sha256: 53dbd5317602772b1dc7186f30fd7c8669851299c7b9cc62987ead8bedd9fc26
    - repository: loom
      path: .specloom/runs/1793836645313-f94d1785-w06wcg/execution-receipt.json
      sha256: ecc472c3090a528e7ea937b06c1642d724fcfd2ff7980e903b20e5950fa33836
    - repository: loom
      path: .specloom/runs/1793836659546-bd347d14-2xlUHc/execution-receipt.json
      sha256: b1449349c57a7413ce534ef5ee3ad3cbc44c96159e96866136e6ada25dd61177
    - repository: loom
      path: .specloom/runs/1793836660179-e98ecfcc-xxFe8H/execution-receipt.json
      sha256: f4b399857d596ffc376f51712175642a37dfcb724251ddfa076cfae0941627c3
    - repository: loom
      path: .specloom/runs/1793836660804-169860d6-B8Kv1C/execution-receipt.json
      sha256: d0fe50433aec367ba05dff6b14e643ef76b2dea7009a725bd9c1d2dc9e130e1f
  delivery_state: uncommitted
---
# Runtime Gate Report — Cobertura de runtime por criterio con omisiones explícitas de capacidades

**Estado: `not_applicable`.** La única capacidad habilitada del repositorio es `cli`
(experimental). La proposal declara `runtime_relevant_capabilities: []` y ADR-032 la excluye.
Los demás adaptadores (`browser`, `http`, `worker`) están deshabilitados en
`playbook.config.yaml`. `handoff.runtime_coverage` está vacío: los 22 criterios figuran en
`handoff.non_runtime` con su motivo.

## cli — not_applicable (ADR-032)

ADR-032 regla 2 pide, aunque el adaptador quede excluido, la invocación real con su salida antes
y después del cambio. Se registró con el CLI del checkout principal (`691b031`, 0.11.0; difiere
de `origin/main` solo en un comentario del generador de skills) y con el del worktree (0.12.0),
sobre un hub de prueba con `http` y `worker` habilitados:

| Invocación | Antes (0.11.0) | Después (0.12.0) |
|---|---|---|
| `playbook packet` con una lista `runtime_not_applicable` válida | exit 0; el manifest no lleva la lista (`null`) | exit 0; el manifest lleva la omisión declarada |
| `playbook packet` con `runtime_not_applicable: nope` | exit 0; la lista mal formada se ignora en silencio | exit 1; `error: tasks.md handoff.runtime_not_applicable must be a list`; no escribe manifest |
| Validador de cobertura con una omisión declarada y el adaptador `worker` cubierto por otro criterio | `AC-1 service enabled capability worker not mapped` | Sin problemas |

ADR-032 regla 3, la carga sustantiva: las pruebas unitarias nuevas fallaron contra el código
anterior durante `sdd-apply` (recibos rojos `1793828684204-3c7c434c-sMYAfv`,
`1793828791976-6810d915-yEUqKy` y `1793833381367-abf9dab1-G7CNe6`, listados en `tasks.md`) y
pasan ahora (recibo `1793836660804-169860d6-B8Kv1C`, 40 pruebas).

- Evidence: recibos de `playbook run --step runtime` listados en `substitute_receipts`; las
  fixtures y los scripts viven fuera del repositorio, en el directorio temporal de la sesión.
- Findings: ninguno.

## Adaptadores deshabilitados

`browser`, `http` y `worker` están en `false` en `playbook.config.yaml`. Se omiten del
frontmatter, como indica la receta de exclusión.

## Review rounds

| round | full or delta | date | commit reviewed | blocking findings | result |
|---|---|---|---|---|---|
| 1 | full | 2026-11-04 | `09da47c` + árbol de trabajo sin commitear | 0 | not_applicable |
