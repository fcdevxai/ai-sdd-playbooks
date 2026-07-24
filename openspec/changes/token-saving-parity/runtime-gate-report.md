---
schema: runtime-gate-report
schema_version: 1
change_id: token-saving-parity
status: not_applicable
updated: 2026-07-24
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Paridad de ahorro de tokens: cablear packet + spec-index

**Adapter selection**: `proposal.md` declares `runtime_relevant_capabilities: []`
(closed during this gate, with human confirmation — see proposal's "Open
technical decisions" and the frontmatter). Project capabilities
(`playbook.config.yaml`): `browser: false`, `http: false`, `cli: true`,
`worker: false`. With the empty list, every project capability is explicitly
excluded for this change.

Same precedent as `cli-detect-siblings` and `wire-token-and-security-policy`:
the `cli` runtime-gate adapter is an experimental, unimplemented end-to-end
harness — it answers "did we drive the real CLI through a full scenario
runner," not "does the diff touch `src/cli/`." The latter is already covered
by unit/integration tests (`node --test`), confirmed green for this change.
Without the exclusion, `cli` would be relevant (capability `true`) and
experimental → `blocked (ADAPTER_NOT_IMPLEMENTED)` for any change touching
`src/cli/`, which would make the CLI's own code permanently unshippable
through this gate — the same reasoning the two prior cycles already
established.

## browser — not_applicable

- Evidence: capability `browser: false`. No web UI in this repo.
- Findings: none.

## http — not_applicable

- Evidence: capability `http: false`. No HTTP/REST surface.
- Findings: none.

## cli — not_applicable (NOT_RELEVANT_TO_CHANGE)

- Evidence: capability `cli: true` (this repo ships `bin/playbook.js`), but
  `proposal.md` declares `runtime_relevant_capabilities: []`, excluding it.
  Supplementary evidence (not required by the exclusion, but confirms no
  regression): re-ran `node --test test/doctor.test.js test/skill-contract.test.js`
  (all green) and manually exercised the changed command in this working tree —
  `node bin/playbook.js doctor --json --cwd <this repo>` — which returns
  `healthy: true`, `warnings: []` (the local `.specloom/index/spec-index.json`
  already exists here from earlier work), matching the "index already built →
  no warning" branch covered by `test/doctor.test.js`.
- Findings: none.

## worker — not_applicable

- Evidence: capability `worker: false`. No background workers/queues.
- Findings: none.
