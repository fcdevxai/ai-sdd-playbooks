---
schema: runtime-gate-report
schema_version: 1
change_id: multi-repo-delivery-aggregation
status: not_applicable
updated: 2026-07-23
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Delivery multi-repo agregado

## browser — not_applicable

- Reason: `capabilities.browser: false` in `playbook.config.yaml` — this project has no web UI.

## http — not_applicable

- Reason: `capabilities.http: false` in `playbook.config.yaml` — this project has no HTTP/REST surface.

## cli — not_applicable (`NOT_RELEVANT_TO_CHANGE`)

- Reason: `capabilities.cli: true`, but `proposal.md` declares
  `runtime_relevant_capabilities: []`, explicitly excluding `cli` for this
  change (see `## Constraints and non-goals`, "Nota al reviewer"). The
  proposal was approved with that exclusion in place: the `cli` adapter is
  experimental and never emits `passed`, so declaring it relevant would
  block this gate with `ADAPTER_NOT_IMPLEMENTED` without a real harness to
  satisfy. The rule "a capability the proposal explicitly marks irrelevant
  to this change is `not_applicable`, not `blocked`, even if experimental"
  applies directly.
- Behavior coverage substitute (per the proposal's own note): 100% covered
  by `test/delivery.test.js` (28 tests) + `test/lifecycle-cli.test.js`
  (2 new tests), and manual verification against a hub fixture with a
  sibling repo, documented in `tasks.md`'s Execution Report ("Verificación
  manual" section): `playbook status --json` showed
  `delivery.per_repo = [{repo: loom, state: unknown, blocked_reason:
  GIT_UNAVAILABLE}, {repo: backend, state: committed}]`, `playbook status`
  (text) printed the `Per-repo:` breakdown line, and `playbook next`
  routed correctly outside `runtime_cleared`.

## worker — not_applicable

- Reason: `capabilities.worker: false` in `playbook.config.yaml` — this project has no background workers/queues.
