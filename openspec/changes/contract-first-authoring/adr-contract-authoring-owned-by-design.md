---
schema: adr
status: proposed
date: "2026-07-24"
ticket: contract-first-authoring
---

# ADR: The canonical API contract is authored during `sdd-design`, under human sign-off

## Context

`README.md` promises that a hub-owned API contract is authored in
`openspec/specs/contracts/openapi.yaml` — "loom-first, during `sdd-plan`, before
the backend implements it", starting at `paths: {}` and filled in feature by
feature. No skill implements that promise: `grep -i 'openapi\|contract-drift'`
over `skills/*/canonical.md` returns nothing. The contract in this repo exists
only because a human hand-wrote it (commit `cb18657`), and `playbook init` does
not scaffold it (the `contract:` block ships commented out in
`templates/project/playbook.config.yaml`).

This is the same class of defect ADR-029 named: a capability that is implemented
and tested but reachable from the workflow only as prose — or, here, not
reachable at all. The change `restore-contract-first` made the *verification*
side operational (`playbook contract-drift`, its config block, a CI template, and
7 tests in `test/contract-first.test.js`), which makes the missing authoring step
sharper, not softer: the hub can now detect drift against a contract that nothing
in the lifecycle ever writes. Left unwired, the canonical contract is populated
by reverse-engineering the implementation — the exact inversion "loom-first" was
adopted to prevent.

The forces in tension are *which lifecycle stage owns the authoring*:

- A public API contract shared across repositories is hard to reverse once
  consumers depend on it, so it wants a review gate.
- `design.md` is the only pre-implementation artifact whose status a **human**
  must move to `approved` (`sdd-design` never self-approves); `tasks.md` has no
  approval gate — the engine accepts `status: ready` written by the agent.
- `sdd-design` runs whenever a contract changes: `computeDesignRequired`
  (`src/lifecycle/impact.js:11`) returns true if *any* `proposal.impact.*` is
  true, so `impact.public_contract: true` guarantees the design stage exists.
  The usual objection to placing work in `sdd-design` — "design may be skipped" —
  does not apply to this trigger.
- `sdd-design`'s `design.md` template already carries a
  `## Public contracts / interfaces` section. Authoring the canonical YAML
  anywhere else splits one decision across two artifacts and two stages, which
  is how prose and contract drift apart.

`specloom`, the upstream this capability was ported from, never wired the
authoring either — it only defined the default contract path
(`specloom/openspec/specs/cli/spec.md:36`). So there is no upstream intent to
preserve; the "during `sdd-plan`" wording in the README is a playbook-ai
statement that was never implemented.

## Decision

When a change declares `impact.public_contract: true` and the project declares
`contract.path_in_loom`, **`sdd-design` MUST author the feature's endpoints in
the canonical contract that key points at**, as part of producing `design.md`.
Normative rules:

1. **Stage ownership.** Authoring the canonical contract belongs to the design
   stage, not the planning stage. `sdd-plan` MUST NOT author it; it plans tasks
   against the contract the design already fixed.
2. **Single sign-off.** The canonical contract and `design.md`'s
   `## Public contracts / interfaces` describe the same set of endpoints and are
   reviewed together in the human `status: approved` decision. Neither is a
   summary of the other; a mismatch is a design defect.
3. **Path from config, never hardcoded.** The write target is
   `contract.path_in_loom` from `playbook.config.yaml`. There is no default
   fallback: `playbook contract-drift` exits `EXIT.USAGE` when the key is absent
   (`src/cli/repos.js:149`).
4. **Contract-first stays opt-in.** With `impact.public_contract: true` but no
   `contract.path_in_loom`, the skill skips the step and says so explicitly. It
   never invents a path and never writes a contract the project did not ask for.
5. **Create when absent.** When the configured path does not exist, `sdd-design`
   creates it with the minimal skeleton (`openapi`, `info`, `paths`) plus this
   feature's endpoints. Nothing else creates it — not `playbook init`, not
   `bootstrap`.
6. **`contract-drift` does not substitute for authoring.** It runs in the
   implementing repo's CI and compares an implementation against the canonical
   contract; it is a detector, and detects nothing useful against an empty
   contract.

Enforcement is wiring plus a content assertion in
`test/skill-contract.test.js` — the same mechanism used for the packet and
`spec-index` wirings. No `playbook validate` rule and no hook: the contract is a
versioned artifact under human review, and the failure mode of a missing
authoring step is a design gap a reviewer sees, not a silent runtime break.

## Consequences

### Positive
- The README's loom-first promise becomes executable instead of aspirational, and
  `contract-drift` gains a contract worth diffing against.
- The public contract inherits the strongest gate the pre-implementation
  lifecycle has (human design sign-off) rather than the weakest (none).
- Endpoint shape is decided once, in the artifact that already reasons about
  contracts, so `design.md` prose and the canonical YAML cannot describe
  different APIs.
- The content assertion makes the wiring merge-proof: deleting the instruction
  fails `npm test`, which is what let this class of gap survive before.

### Negative
- `README.md` must be corrected ("during `sdd-plan`" → `sdd-design`), so a
  published statement about the workflow changes. Accepted: it documented an
  unimplemented behavior.
- Endpoints must be concrete at design time. For a change that genuinely cannot
  name them until planning, the design stage now blocks on information it
  previously deferred. Accepted: `sdd-design`'s template already asks for
  "endpoints, response shapes, events", so this demands nothing new of it.

### Risks
- A change that touches a public API but declares `impact.public_contract: false`
  skips the authoring silently. The trigger is a human-confirmed proposal field,
  and mis-declaring it already skips the whole design stage — this ADR does not
  add that risk, it inherits it.
- A contract is a versioned artifact shared across every consumer repo's git
  history. Authoring guidance therefore forbids secrets, real tokens, and PII in
  `example`/`description`/`servers` (SEC-1); an accidental leak there is
  effectively permanent.

## Alternatives considered

### Author in `sdd-plan` (what the README currently claims)
Rejected. It keeps the README untouched and matches the "feature by feature"
framing, but `tasks.md` has no human approval gate, so a public cross-repo
contract would land without review. It also separates the canonical YAML from the
`## Public contracts / interfaces` prose that describes the same endpoints,
inviting exactly the drift the contract exists to prevent. The saving — one
sentence of documentation — does not pay for losing the sign-off.

### Split: `design.md` fixes the endpoint shape in prose, `sdd-plan` writes the YAML
Rejected. Two wiring points and two content assertions for one outcome, and the
prose/YAML gap it introduces is the failure mode most worth avoiding. A design
approved against prose that a later stage transcribes is a design approved
against something other than the artifact that ships.

### Leave it unwired and rely on `playbook contract-drift`
Rejected. `contract-drift` compares an implementation to the canonical contract;
against `paths: {}` every implemented endpoint reports as `UNDOCUMENTED`
(`test/contract-first.test.js:57`). Using the detector as the authoring
mechanism means the implementation defines the contract — implementation-first,
which is what `source_of_truth: loom-first` rejects.

## Impact

- backend: no impact — no `src/` change; skill prose, docs, and tests only
- frontend: no impact
- security: adds a prohibition (no secrets/PII in the canonical contract); no new surface
- data: no impact
- deployment: no impact
- testing: new content assertions in `test/skill-contract.test.js`
