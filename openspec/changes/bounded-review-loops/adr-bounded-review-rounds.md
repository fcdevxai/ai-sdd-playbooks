---
schema: adr
status: proposed
date: '2026-10-11'
ticket: bounded-review-loops
---

# ADR: Gate findings block only under a bounded rule, review rounds are capped, and sensitive designs declare a closed threat model

## Context

The LIA Hub change `harness-trust-restoration` (2026-10-06 to 2026-10-08) went through ten
review rounds and 34 issues without converging. Each round answered the previous findings with
broader, class-level fixes. Because no threat model bounded the class, every fix enlarged the
code surface and the next round found narrower variants: rounds 7 and 8 found 8 and 9 issues,
and the eleventh round moved on to filesystem races. The loop ended only when a design
amendment declared an honest-error threat model, a closed checklist and one bounded review
round, plus a delta round (stop rules RP-1, RP-2 and RP-3 of that closure).

The methodology already caps other loops. ADR-011 caps the TDD retries per task, the
fix→validate loop and the clarification rounds. ADR-031 limits what a loop iteration may
mutate. ADR-043 declares the honest-error threat model for lifecycle evidence. None of them
bounds the review↔apply cycle: `sdd-code-review`, `sdd-security-gate` and `sdd-runtime-gate`
can send a change back to `sdd-apply` any number of times, every finding blocks regardless of
how it was found, and `sdd-design` never requires a closed list of negative cases or limits
how often an approved design is amended.

## Decision

1. **Blocking rule.** In `sdd-code-review` and `sdd-security-gate`, a finding blocks only when
   it meets all three conditions:
   - it cites a checklist item or an `AC-N`, `EC-N` or `SEC-N`;
   - it describes a realistic scenario within the change's declared threat model (the
     `design.md` threat model when present, otherwise the proposal's `## Security
     considerations` and `docs/security-checklist.md`);
   - it reproduces in the change's real code path (a test, a command or a concrete trace
     through the implementation), not only in a synthetic fixture that bypasses the project's
     own invariants.

   Every other finding is a follow-up, recorded in the report with the condition it does not
   meet, an owner and a destination. Follow-ups never change the report status.
2. **Always-blocking classes stay blocking.** The security gate's always-blocking classes
   (missing, client-side-only or broader-than-specified authorization, cross-tenant data
   access, unsanitized input reaching a query, command or template, sensitive data exposed in
   a response, log or error, a committed secret) block whenever such a defect is present in
   the change's code, with its location and a reproduction or concrete trace. The blocking
   rule never demotes them. Only a human can accept such a risk, explicitly, as an accepted
   risk.
3. **Round cap for the review↔apply cycle.** `sdd-code-review`, `sdd-security-gate` and
   `sdd-runtime-gate` each run at most one full round and one delta round per change. The
   delta round re-checks only the previous round's blocking findings (for the runtime gate,
   its failed or blocked adapters and criteria) and the diff of their fixes. A new finding in
   the delta round blocks only when it meets the blocking rule and is caused by the fix diff;
   any other new finding is a follow-up.
4. **Stop and report, never a third automatic round.** When the delta round still has
   blocking findings, the gate stops. The report keeps its failing status, is not sealed, and
   adds a convergence analysis: for each round, the blocking count, the findings that
   persisted, the new findings, the findings introduced by fixes, and the suspected structural
   cause. The human chooses between authorizing one more fix-and-delta round (which resets the
   count consciously, as in ADR-011), accepting named findings as follow-ups (never an
   always-blocking security defect, see point 2), or re-scoping or splitting the change.
5. **Rounds are recorded in the report.** Each of the three reports carries a `## Review
   rounds` section (round, full or delta, date, commit reviewed, blocking findings, result),
   kept across rounds. A report written before this rule counts as one full round when its
   status is failing.
6. **Apply fixes stay inside the round.** When `sdd-apply` fixes a failed gate round, it
   fixes only that round's blocking findings, does not widen scope, and stops for a human
   decision when a fix needs a new decision (no design amendment in flight).
7. **Sensitive designs are bounded.** When the proposal declares `security.risk: elevated`,
   any `security.triggers`, or the design sets `threat_model_required: true`, `design.md`
   declares a threat model (actors in scope, what they can do, what is explicitly out of
   scope) and a closed list of negative cases (`NC-N`), each mapped to a `SEC-N`. The gates
   treat that list as the bound for adversarial variants: a variant outside it is a
   follow-up, unless it is an always-blocking defect present in the code, or it shows that the
   threat model itself is wrong, in which case the gate stops and asks the human.
8. **Amendments are counted.** An approved `design.md` changes only through a numbered
   `## Amendments` entry (`A-N`: date, reason, decision, human approver). A change admits at
   most two amendments; when a third would be needed, `sdd-design` stops and the new decision
   goes to a new change.

These rules live as text in the skills' `canonical.md`, enforced by content assertions in the
skill contract test. The CLI does not count rounds or amendments.

## Consequences

### Positive

- The review↔apply cycle is bounded: at most two rounds per gate before a human decides, with
  the evidence needed to decide.
- Findings that are real but outside the change's contract stay visible as follow-ups with an
  owner, instead of growing the change.
- Sensitive changes declare, before implementation, what the reviewers will hold them to.

### Negative

- A real defect that is hard to reproduce may be deferred as a follow-up (outside the
  always-blocking security classes).
- More human checkpoints: a gate that needs a third round now waits for a person.
- The rules are textual. An agent can ignore them, the same accepted risk as ADR-011.

### Risks

- Follow-ups could be used to avoid fixing real problems. Mitigated by the required owner and
  destination, and by point 2: always-blocking security defects can never become follow-ups.
- A convergence analysis could be vague. Mitigated by its fixed structure (counts per round,
  persisted, new, introduced by fixes, suspected cause).

## Alternatives considered

### CLI-enforced round counting

Deferred: counting rounds in the frontmatter and enforcing them in the validator changes gate
code, which ADR-042 delivers outside the gate with a closure contract. It can follow as its
own change once the textual rule has been exercised.

### Keep unlimited rounds and rely on better reviewers

Rejected: this is the condition under which the ten-round loop happened.

### Apply the blocking rule to the always-blocking security classes too

Rejected: a real security defect that is hard to reproduce could be demoted to a follow-up.
Security rules stay stronger than loop caps, as in ADR-011 and ADR-031.

### A single cap shared by all gates

Rejected: each gate measures something different, and a passed code review should not consume
the security gate's rounds.

## Impact

- backend: no impact (the CLI does not change for this decision)
- frontend: no impact
- security: the security gate gains a blocking rule and a round cap, but keeps its
  always-blocking classes and its never-lower-risk rule; sensitive designs must declare a
  threat model and closed negative cases
- data: no impact
- deployment: consumers receive it by upgrading to `0.11.0` and running `playbook install`
- testing: content assertions in `test/skill-contract.test.js`

This decision extends ADR-011 and ADR-031 to the review↔apply cycle without superseding them,
and complements ADR-043.
