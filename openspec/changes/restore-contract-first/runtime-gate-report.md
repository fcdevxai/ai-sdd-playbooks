---
schema: runtime-gate-report
schema_version: 1
change_id: restore-contract-first
status: not_applicable
updated: 2026-07-23
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Contract-first operativo

## browser — not_applicable
- Evidence: `capabilities.browser: false` in `playbook.config.yaml` — playbook-ai has no web UI.

## http — not_applicable
- Evidence: `capabilities.http: false` in `playbook.config.yaml` — playbook-ai has no HTTP/REST surface.

## cli — not_applicable (NOT_RELEVANT_TO_CHANGE)
- Evidence: `capabilities.cli: true` (playbook-ai does have a CLI surface, `bin/playbook.js`), but `proposal.md` declares `runtime_relevant_capabilities: []` — this change adds no new CLI command and modifies no existing command's observable behavior (the `contract-drift` command it exercises already existed). Verified programmatically: `planRuntimeAdapters({browser:false,http:false,cli:true,worker:false}, [])` resolves `cli` to `not_applicable`/`NOT_RELEVANT_TO_CHANGE`, not `blocked`. Per addendum in `security-report.md` "Notes".

## worker — not_applicable
- Evidence: `capabilities.worker: false` in `playbook.config.yaml` — playbook-ai has no background workers/queues.

## Gate status

`not_applicable` — no adapter is applicable (all four resolve to `not_applicable`; `gateStatusFromAdapters` returns `not_applicable` when the applicable set is empty). Correctly distinct from `blocked`: had `cli` remained relevant (no narrowing), it would have resolved to `blocked`/`ADAPTER_NOT_IMPLEMENTED`, since `cli` is an experimental adapter that never emits `passed`.
