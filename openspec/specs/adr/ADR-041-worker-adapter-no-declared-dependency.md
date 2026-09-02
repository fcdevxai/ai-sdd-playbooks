---
schema: adr
status: accepted
date: "2026-09-01"
ticket: runtime-gate-worker-supported
---

# ADR: The `worker` runtime adapter drives evidence generically, with no declared per-project dependency

## Context

`sdd-runtime-gate` selects adapters from `capabilities:` in `playbook.config.yaml`.
Until this change, `worker` (like `cli`) was marked **experimental**: whenever a
project declared `worker: true` and a change declared it relevant, the adapter
`block`ed with `ADAPTER_NOT_IMPLEMENTED` unconditionally — it could never emit
`passed`, regardless of how much real evidence the change actually had. Combined
with `sdd-runtime-gate`'s aggregate rule ("blocked if any applicable adapter is
blocked"), any change in a project with a relevant `worker: true` was
structurally unable to reach `runtime-gate-report.md: status: passed`, even with
`browser`/`http` fully passed and real tests covering the worker. This was
reported from a real consumer project (`liacopilot/playbook-sdd`,
`lia-early-warning-detection`) hitting exactly that deadlock.

`playbook-ai` itself declares `capabilities.worker: false` — it has no
queues/background jobs — so it cannot dogfood this adapter against a real
worker of its own, unlike `cli` (`playbook-ai` *is* a CLI) or `http`/`browser`
(which the project also lacks, for the same honest reason).

The forces in tension:

- `browser` is supported via a standardized dependency (Playwright MCP) that
  works the same way across any web UI. `http` is supported with no dependency
  at all — the HTTP protocol itself is universal enough that "exercise routes,
  auth, contracts, persistence, failure paths" means the same thing in any
  stack.
- `worker` has no equivalent universal transport. Sidekiq, BullMQ, Celery, a
  cron job, and a Lambda consumer are driven in incompatible ways. Requiring a
  single named dependency (the way `browser` requires `playwright-mcp`) would
  either be meaningless across that many runtimes, or would require every
  consumer project to newly declare and maintain a project-specific
  "worker-driver" configuration that no other adapter demands today.
- Leaving `worker` permanently experimental is what caused the reported
  deadlock: a control that can never pass regardless of evidence quality is not
  a gate, it is a wall.
- Building a universal, protocol-level worker-driving mechanism (a "Playwright
  for queues") is real infrastructure work, and no such standard exists to
  build on, unlike the HTTP protocol or a browser's accessibility tree.

## Decision

The `worker` adapter is promoted from `experimental` to `supported`, using the
same **no declared dependency** model as `http`:

1. **No new project-side configuration.** `playbook.config.yaml` gains no new
   field for this. The agent running `sdd-runtime-gate` inspects the project's
   own code/tests to find how it actually enqueues and processes jobs, and
   drives that mechanism for real.
2. **Real evidence checklist**, analogous to `http`'s: a real trigger, real
   processing by the real consumer, an observed side effect matching intent, a
   verified retry/dead-letter path, and (only when the proposal marks it
   relevant) idempotency under duplicate delivery.
3. **`blocked` uses existing reason codes**, unchanged: `DEPENDENCY_UNAVAILABLE`
   when the project genuinely offers no way to trigger/observe the worker, and
   `INSUFFICIENT_EVIDENCE` otherwise. No new reason code is introduced.
4. **Safety rule (SEC-1):** evidence-gathering must never fire a real
   irreversible external effect (a real payment, a real email/SMS, a real
   third-party call). The project's own test/sandbox double for that specific
   effect must be used; if none exists, that finding is `blocked`, and a real
   effect is never fired to force a `passed`.
5. **`cli` is unaffected.** It keeps the criterion from ADR-032 exactly as
   written — this decision does not reopen it.

## Consequences

### Positive
- Closes the structural deadlock: a project with `worker: true` and real
  coverage can now reach a passing runtime gate, the same way `http`/`browser`
  projects already can.
- No new configuration surface for consumer projects — the adapter contract
  stays as simple as `http`'s.
- The checklist gives `worker` the same kind of explicit `failed` vs. `blocked`
  criteria that `browser`/`http` already have, instead of a binary
  block-or-nothing.

### Negative
- Evidence quality for `worker` will vary more across projects than for
  `browser`/`http`, since there is no standardized tool enforcing how the
  agent drives it — the checklist is a written protocol, not a mechanically
  enforced one.
- `playbook-ai` cannot dogfood this adapter end-to-end against a real worker of
  its own (`capabilities.worker: false`); this change is verified through unit
  tests of the pure planning functions and content checks on the skill text,
  not a live run of the new adapter.

### Risks
- **Accepted risk:** because there is no declared dependency to check, a weak
  or superficial "real evidence" run (e.g., invoking a handler function
  directly instead of the real queue) could pass the checklist's letter while
  missing its intent. Mitigated by requiring the *real* enqueue/consume path
  explicitly in the checklist and requiring the observed side effect to be
  cited against an `AC-N`, the same corroboration bar `http`/`browser` already
  use.
- **Accepted risk:** this repository's own test suite cannot exercise a real
  worker, so a defect specific to actually driving a live queue (as opposed to
  the planning/aggregation logic) would not be caught here — only in a
  consumer project's first real run. Mirrors the same gap ADR-032 accepted for
  `cli`'s lack of self-hosted E2E coverage.

## Alternatives considered

### Require a declared per-project worker-driver dependency (like `browser`/`playwright-mcp`)
Rejected: there is no single worker/queue technology broad enough to name as a
dependency the way Playwright covers browsers. Naming one would be arbitrary
and would exclude most real projects; naming none defeats the purpose of a
dependency check. Also rejected because no other adapter requires new
project-side config beyond the existing `capabilities:` flag — introducing one
here would be an inconsistent, one-off burden.

### Build a universal worker-driving protocol/tool before promoting the adapter
Rejected for proportionality, not for merit — same shape as ADR-032's
rejection of building the `cli` harness eagerly. No existing standard exists to
build on (unlike HTTP or a browser's accessibility tree), so this would be a
large, generic engineering investment disconnected from any concrete change
that needs it today. Left open as a future trigger: if the checklist-based
model above repeatedly proves too weak in practice, building real driving
tooling becomes its own change then, not a precondition now.

### Keep `worker` permanently experimental
Rejected: this is the status quo that caused the reported structural deadlock.
A gate that can never pass regardless of evidence is not a gate.

## Impact

- backend: `src/adapters/worker.js` support level changes; no change to
  `src/adapters/index.js` (the generic `supported` branch already handles it)
- frontend: no impact
- security: adds a written safety rule (SEC-1) for evidence-gathering against
  real external side effects; no change to authentication/authorization
- data: no impact
- deployment: no impact
- testing: existing tests that fixed "worker always blocks when relevant"
  (`test/adapters.test.js`, `test/validate.cli.test.js`, `test/schema.test.js`
  fixtures) are updated to the new contract
