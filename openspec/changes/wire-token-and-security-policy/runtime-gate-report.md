---
schema: runtime-gate-report
schema_version: 1
change_id: wire-token-and-security-policy
status: not_applicable
updated: 2026-07-23
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Cablear la política de tokens y seguridad en los playbooks

**Adapter selection**: `proposal.md` declares `runtime_relevant_capabilities: []`
(present and empty) — every project capability is explicitly marked irrelevant to
this change. Project capabilities (`playbook.config.yaml`): `browser: false`,
`http: false`, `cli: true`, `worker: false`.

This change edits playbook prose (`canonical.md` → generated `SKILL.md`) and adds
a **pure** validation helper (`validateVerificationBody`) with CLI wiring. It
exercises no runtime behavior — no UI, no HTTP surface, no worker. Its behavior is
covered by `test/schema.test.js`, `test/skill-contract.test.js`, and the new CLI
tests in `test/validate.cli.test.js`.

## browser — not_applicable

- Evidence: project capability `browser: false`. No web UI exists in this repo.
- Findings: none.

## http — not_applicable

- Evidence: project capability `http: false`. No HTTP/REST surface.
- Findings: none.

## cli — not_applicable (NOT_RELEVANT_TO_CHANGE)

- Evidence: project capability `cli: true`, but the proposal's
  `runtime_relevant_capabilities: []` excludes it. Per the gate rules, a
  capability the proposal explicitly marks irrelevant is `not_applicable`, **not
  blocked** — even though the `cli` adapter is experimental. Declaring `cli`
  relevant would block the gate (`ADAPTER_NOT_IMPLEMENTED`) with no real harness,
  for a change that adds no runtime CLI behavior — only a validation rule and
  playbook text, both verified by the unit/CLI test suites above.
- Findings: none.

## worker — not_applicable

- Evidence: project capability `worker: false`. No background workers/queues.
- Findings: none.

## Gate status

`not_applicable` — every adapter is `not_applicable`, so the aggregate
(`gateStatusFromAdapters`) is `not_applicable`. Nothing was fabricated as
`passed`; no applicable runtime surface exists for this change.
