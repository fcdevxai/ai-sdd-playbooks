---
schema: adr
status: accepted
date: "2026-07-24"
ticket: delivery-state-branch-independence
---

# ADR: The `cli` runtime adapter stays unimplemented, and its exclusion carries a stated criterion

## Context

`sdd-runtime-gate` selects adapters from `capabilities:` in `playbook.config.yaml`.
`playbook-ai` declares `cli: true` — it *is* a CLI — and the `cli` adapter is marked
**experimental**, meaning it `blocks` with `ADAPTER_NOT_IMPLEMENTED` whenever a change
declares it relevant. It never emits `passed`.

The escape hatch is `proposal.runtime_relevant_capabilities`: a capability enabled in
the project but excluded from that list is `not_applicable` /
`NOT_RELEVANT_TO_CHANGE` rather than `blocked` (`src/adapters/index.js`).

Four consecutive changes used it — `cli-detect-siblings`, `token-saving-parity`,
`contract-first-authoring`, `convention-drift-verify-commit` — each re-justifying the
exclusion from scratch in its own proposal. For those four the justification was
honest and easy: none of them touched `src/` at all, so there was genuinely no CLI
behavior to drive.

This change breaks that pattern. It modifies `src/github/index.js` and
`src/repos/delivery.js`, and what it changes is exactly what a CLI end-to-end harness
would exist to check: that `playbook status` returns the same delivery for a change
regardless of the checked-out branch. Declaring `runtime_relevant_capabilities: []`
here on the old grounds — "no CLI surface to exercise" — would be false. Declaring
`[cli]` blocks the gate, and nothing gets fixed.

The forces in tension:

- A gate that is always excluded is not a gate. Repeating an ad-hoc exclusion five
  times is how a control decays into a formality nobody reads.
- Implementing the harness is real work: designing how CLI invocations are driven,
  plus git fixtures with branch/PR states. It is several times the size of the
  few-line fix it would be gating, and it is not what this change is for.
- The verification is not actually absent. The pure functions are unit-testable — and
  a unit test that fails against the current code is a stronger gate than a content
  assertion — and a CLI invocation can simply be *run and recorded* as evidence
  without an adapter framework.

The failure mode to avoid is the one this line of work keeps closing: a control that
is documented but disconnected. An exclusion with no stated criterion is exactly that
— the rule exists, but what it demands instead is left to each agent's judgement per
run.

## Decision

The `cli` runtime adapter remains **unimplemented**, and its exclusion becomes a
stated rule instead of a per-change improvisation. Normative rules:

1. **In this repository, `cli` is excluded by default.** A change declares
   `runtime_relevant_capabilities: []` (or omits `cli` from the list), and the runtime
   gate records the adapter as `not_applicable` with the reason pointing at this
   decision — not as an unexplained omission.
2. **Exclusion is not exemption from evidence.** When a change modifies observable CLI
   behavior, its `runtime-gate-report.md` MUST still record real behavioral evidence:
   the actual invocation, its output before and after the change. The adapter is
   `not_applicable`; the evidence is not.
3. **Unit tests carry the correctness burden.** A change to CLI behavior must have at
   least one test that fails against the pre-change code. This is the substantive
   gate; the recorded invocation is corroboration, not a substitute.
4. **The exclusion is not permanent.** If a change ever needs coverage that unit tests
   plus a recorded invocation cannot give — driving an interactive flow, or asserting
   behavior across a real multi-repo topology — the harness gets implemented then,
   under its own change, rather than blocking that one.
5. **`worker` is unaffected.** `playbook-ai` declares `worker: false`, so its adapter
   is `not_applicable` for the ordinary reason (capability disabled) and needs no
   criterion.

## Consequences

### Positive
- The exclusion stops being an excuse. A reader of a `runtime-gate-report.md` sees
  *why* the adapter did not run and *what was required instead*, in one place, instead
  of reconstructing it from a proposal's prose.
- Changes touching CLI behavior now owe evidence they did not owe before: rule 2 makes
  the report carry the actual before/after invocation, which no content assertion or
  adapter status could have shown.
- It unblocks the highest-severity fix in the backlog without pretending the gap does
  not exist.
- Names the condition that would reverse the decision (rule 4), so the harness gets
  built when there is a concrete reason, not on principle.

### Negative
- Accepts, in writing, that this repository has no automated end-to-end coverage of
  its own CLI. That is the honest state today; writing it down makes it visible rather
  than creating it.
- Rule 2 puts a manual step in the runtime gate for CLI-affecting changes. Accepted: a
  recorded invocation is cheap, and the alternative was no evidence at all.

### Risks
- **Accepted risk:** a recorded manual invocation is not re-run on every future change,
  so a regression in CLI behavior is caught only by the unit tests, not by the gate.
  Mitigated by rule 3 — the unit test *is* re-run by `npm test` and CI on every change.
  The recorded invocation documents the observed behavior at a point in time; it is
  evidence, not a regression suite, and this ADR should not be read as claiming
  otherwise.
- Rule 2 depends on the author actually recording the invocation. It is prose in a
  methodology spec, with the same enforcement ceiling as the other conventions here:
  a content assertion can require the criterion to be *documented*, not that a given
  report *followed* it.

## Alternatives considered

### Implement the `cli` harness as part of this change
Rejected for proportionality, not for merit — it is the technically better answer. It
would triple or quadruple the scope of a few-line fix, and it would put the design of
a whole verification mechanism (invocation driving, git/PR fixtures) inside a change
whose subject is a dropped function parameter. Rule 4 keeps the door open with a
concrete trigger instead of an indefinite intention.

### Keep excluding `cli` ad hoc, one justification per proposal
Rejected. It is what happened four times, and it is why this ADR exists: the fifth
change could not reuse the previous justification honestly, and nobody would have
noticed if it had done so anyway. Repetition without a rule is how an exclusion stops
being reviewed.

### Flip `capabilities.cli` to `false` in `playbook.config.yaml`
Rejected as dishonest. The capability describes what the project *is*, and
`playbook-ai` is a CLI. Setting it to `false` would make the adapter `not_applicable`
for a reason that is simply untrue, and it would corrupt the same field
`sdd-bootstrap-project` detects and proposes for consumer projects.

## Impact

- backend: no impact — no `src/` change from this decision
- frontend: no impact
- security: no impact
- data: no impact
- deployment: no impact
- testing: documents that CLI behavior is covered by unit tests plus a recorded invocation, not by the runtime gate; a content assertion pins the criterion in the spec
