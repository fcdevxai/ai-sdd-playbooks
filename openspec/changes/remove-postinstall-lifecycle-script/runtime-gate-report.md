---
schema: runtime-gate-report
schema_version: 1
change_id: remove-postinstall-lifecycle-script
status: not_applicable
updated: 2026-07-27
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Eliminar el postinstall que puede romper `npm install` de consumers

## browser — not_applicable

- `playbook.config.yaml` declares `capabilities.browser: false` — the project has no web UI.

## http — not_applicable

- `playbook.config.yaml` declares `capabilities.http: false` — the project has no HTTP/REST surface.

## worker — not_applicable

- `playbook.config.yaml` declares `capabilities.worker: false` — no background workers/queues.

## cli — not_applicable (`NOT_RELEVANT_TO_CHANGE`)

- `playbook.config.yaml` declares `capabilities.cli: true` (experimental adapter — would normally
  `block` with `ADAPTER_NOT_IMPLEMENTED` if relevant), but `proposal.md`'s
  `runtime_relevant_capabilities: []` explicitly excludes it for this change — a
  human-confirmed field per the gate's adapter-selection rule ("a capability the
  proposal explicitly marks irrelevant to this change is `not_applicable`, not
  `blocked` — even if experimental"). Per `docs/security-checklist.md`'s
  accepted-risk table, the CLI's real end-to-end coverage for this repo comes
  from `npm test` (the CLI dispatch/notice/install-target unit tests already
  exercised in `sdd-code-review`) plus a manually captured invocation, not this
  adapter, which remains unimplemented (ADR-032).
- Manual invocation captured during implementation, for the record (not a
  substitute for the `cli` adapter, only a supplementary spot-check): running
  `playbook status` from a scratch directory with both skill targets unstamped
  printed `playbook-ai 0.9.0 — skills not installed for any target, run
  \`playbook install\`.` as the first line, confirming the notice behaves as
  specified outside the unit-test harness.
