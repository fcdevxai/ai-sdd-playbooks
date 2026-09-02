---
schema: security-report
schema_version: 1
change_id: runtime-gate-worker-supported
status: passed
risk: standard
threat_model_required: false
updated: 2026-09-01
---
# Security Report — Adapter `worker` de sdd-runtime-gate: de experimental a supported

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: Full review. The repository does not gain a live worker,
authentication surface, user-owned data, secrets, or a third-party integration
(SEC-2 / SEC-002). The distributed instruction contract does, however, newly
authorize agents to trigger and observe real workers in consumer projects,
including workers whose side effects may be irreversible. SEC-1 / SEC-001 is
therefore a security-sensitive control and requires evidence across the final
generated skill, not only the source descriptor.

## Review basis

- `code-review-report.md` satisfies the required precondition with
  `status: passed`.
- `context-packet.md` source hashes match the live `proposal.md` and `tasks.md`.
  Its `## Files touched` list omits
  `skills/sdd-bootstrap-project/canonical.md`, although the live proposal and
  design include that file. The live artifacts and changed-file diff were used
  for scope where the packet was incomplete.
- The review covered the implementation diff, the full security-sensitive
  `sdd-runtime-gate` instruction surface, the generated skill, focused tests,
  the project security checklist, and the relevant permanent system-spec
  sections.

## Checklist

- [n-a] Authorization and access control — Proposal impact declares
  `authentication: false` and `authorization: false`; no endpoint, privileged
  action, role check, or authorization module changes.
- [n-a] Ownership boundaries (IDOR) — No user/tenant object references, queries,
  list operations, or data-model changes are introduced.
- [pass] Input handling — The changed executable code is a static adapter
  descriptor. No new external input reaches a query, shell command, `eval`, or
  template renderer in this repository.
- [pass] Data exposure — The diff adds no response fields, application logging,
  error serialization, or credential-shaped values. The focused secret scan
  found no high-confidence private-key or provider-token pattern in changed
  implementation files.
- [pass] Secrets and credentials — No secret/config field or credential storage
  path is added, and no committed secret was detected in the reviewed diff.
- [pass] Dependencies and integrations — No dependency manifest or live
  integration changes. The distributed worker instructions govern safe use of
  real/sandbox integrations, and SEC-001 is now referenced both from the
  top-level `## Rules` section and the detailed `worker` section (F-1 fixed).

## Risk rationale

- Declared risk: `standard`; triggers: `[]`.
- Detected risk: `standard`. The change affects an instruction contract that can
  drive external worker effects, so a full review applies, but this repository
  adds no live external integration, regulated data path, credential handling,
  or worker runtime.
- Reconciled risk: `standard` (`max(standard, standard)`). The approved level is
  not lowered. F-1 was blocking because it left an explicitly required safety
  control less reachable in the generated instruction, not because the change
  introduces an elevated-risk runtime in this repository. It is now fixed.

## Control checklist (control → evidence)

| control | status | evidence |
|---|---|---|
| SEC-001 (proposal SEC-1) | pass | The prohibition against real irreversible effects exists in `skills/sdd-runtime-gate/canonical.md:116` and generated `SKILL.md:138`. It is now also referenced from `## Rules` at `canonical.md:189` / generated `SKILL.md:64`, matching the design requirement (`design.md:147-155`). `test/skill-contract.test.js` adds a dedicated assertion that the top-level `## Rules` section itself carries the `SEC-001` reference, in addition to the existing `worker`-section check (`:190-200`), so this reachability requirement is now covered even if the detailed section is trimmed. |
| SEC-002 (proposal SEC-2) | pass | `playbook.config.yaml:12` keeps `worker: false`; changed files do not include `src/config/`, `src/cli/validate.js`, schemas, dependency manifests, secrets, or endpoints. `src/adapters/worker.js` remains a static descriptor with `dependency: null`. |

## Threat model (when required)

Not required. The proposal declares no security triggers, the design sets
`threat_model_required: false`, and this review found no signal that raises the
reconciled risk to `elevated`.

## Findings

| id | severity | blocking | location | remediation | status |
|---|---|---|---|---|---|
| F-1 | high | yes | `openspec/changes/runtime-gate-worker-supported/design.md:147-155`; `skills/sdd-runtime-gate/canonical.md:181-189`; generated `skills/sdd-runtime-gate/SKILL.md:56-64`; `test/skill-contract.test.js` | Added a concise SEC-001 worker-safety rule/reference to `## Rules` in `canonical.md` (`- **SEC-001**: never obtain \`worker\` evidence by triggering an external irreversible real effect — see the \`worker\` adapter section below.`), regenerated `SKILL.md`, and extended `test/skill-contract.test.js` with a new test (`sdd-runtime-gate references SEC-001 from the top-level Rules section`) that asserts the generated `## Rules` section itself carries the reference. | fixed |

## Verification evidence

- `playbook changed-files runtime-gate-worker-supported --diff` completed and
  scoped the review.
- `npm run generate:check`: passed; 13 generated skills are in sync (after
  regenerating `SKILL.md` from the fixed `canonical.md`).
- Focused adapter/skill/propagation tests: 73 passed, 0 failed (72 prior +
  1 new SEC-001 reachability test).
- Full `npm test`: 443 passed, 0 failed.
- `git diff --check`: passed.
- No dependency manifest changed.
