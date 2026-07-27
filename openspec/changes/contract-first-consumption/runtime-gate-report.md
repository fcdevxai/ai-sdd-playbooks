---
schema: runtime-gate-report
schema_version: 1
change_id: contract-first-consumption
status: not_applicable
updated: 2026-07-27
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Cerrar el circuito de contract-first: autoría → consumo → multi-repo

## browser — not_applicable

`capabilities.browser: false` in `playbook.config.yaml` — no web UI in this project.

## http — not_applicable

`capabilities.http: false` in `playbook.config.yaml` — no HTTP surface in this project.
(Note: `contract.path_in_loom` is declared anyway — `playbook validate` already
surfaces this as an advisory notice, see below; it does not make `http`
applicable.)

## cli — not_applicable (`NOT_RELEVANT_TO_CHANGE`)

`capabilities.cli: true`, but `proposal.md` declares
`runtime_relevant_capabilities: []` — an explicit empty list, which excludes
every capability from this change, `cli` included. Per the gate's own rule
("a capability the proposal explicitly marks irrelevant to this change is
`not_applicable`, not `blocked` — even if experimental"), this is
`not_applicable`, not the usual `blocked (ADAPTER_NOT_IMPLEMENTED)` an
experimental adapter would otherwise get.

**Manual evidence collected anyway.** The proposal's own constraint (citing
ADR-032, the decision that formally excludes the `cli` adapter) requires that
any change altering CLI-observable behavior bring evidence of real invocation
before/after regardless of the adapter's formal status — because the harness
that would normally gather it doesn't exist. This change alters `playbook
validate`'s observable output (the new advisory notice and the new blocking
cross-check), so that evidence was gathered and independently re-verified
here, not just taken from `tasks.md`'s Execution Report:

- **Before**: confirmed via `git diff` (not by reverting and re-running) that
  `configNotices()` and `contractRoleErrors()` in
  [validate.js](src/cli/validate.js) are wholly new — the prior `validate`
  had no notices channel and no `provided_by`/`consumed_by` cross-check at
  all, so neither the notice nor the blocking error could have appeared
  before this change.
- **After, advisory notice** (`playbook validate` in this repo, real config —
  `contract.path_in_loom` set, `capabilities.http: false`):
  ```
  All 10 artifact(s) valid.
    note: playbook.config.yaml declares contract.path_in_loom but capabilities.http is false — contract-first authoring will not trigger
  ```
  Exit code 0, all artifacts still valid — the notice is advisory only, confirming AC-4.
- **After, blocking cross-check** (`playbook validate --cwd <tmp>` against a
  throwaway config with `contract.provided_by: noexiste` and a `repos:` block
  that does not declare `noexiste`):
  ```
  ✗ playbook.config.yaml
      Unknown repo "noexiste" (not found in playbook.config.yaml repos)
  1 invalid artifact(s).
  ```
  Exit code 1 — the error names the offending repo, confirming AC-5/SEC-002,
  and did not exist before this change.

## worker — not_applicable

`capabilities.worker: false` in `playbook.config.yaml` — no background workers/queues in this project.
