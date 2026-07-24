---
schema: adr
status: accepted
date: "2026-07-24"
ticket: convention-drift-verify-commit
---

# ADR: A retry loop may regenerate derived artifacts, never mutate human-signed ones

## Context

ADR-011 capped the retry loops that previously said "repeat until it works", and
its `## Decision` names `sdd-new` **and `sdd-commit`** as the two playbooks that
cap the fix→`playbook validate`→re-run loop at 3 iterations. That instruction
never reached `playbook-ai`'s `sdd-commit`: its step 1 reads "Run `playbook
validate` — stop on any violation", with no loop at all (`grep` for the cap in
`skills/sdd-commit/canonical.md` = 0). The change `convention-drift-verify-commit`
restores it.

Restoring the loop surfaces a question ADR-011 never answered: **what is the loop
allowed to fix?** The cap bounds *how many times*, not *what*. The two playbooks
that carry the loop are not symmetric:

- `sdd-new` validates artifacts **it just wrote itself** (`proposal.md` at
  `status: draft`, `tasks.md` placeholder, ADR drafts). Fixing its own
  frontmatter/section mistakes and re-running is exactly right.
- `sdd-commit` validates artifacts produced by **every earlier stage** —
  including `proposal.md` and `design.md`, whose `status: approved` a **human**
  set, and the three gate reports. A naive "cap at 3" invites the delivery skill
  to make up to three edits to a signed artifact so that `validate` stops
  complaining.

That failure mode is not hypothetical in shape: the most common real `validate`
failure at commit time is a **stale `context-packet.md`** (observed in change
`contract-first-authoring`, where editing `tasks.md` after the packet was
generated made `playbook validate` report `context-packet.md stale — re-run
playbook packet`). That one is safe to fix, because the packet is *derived*:
`playbook packet` regenerates it deterministically from `proposal.md` +
`tasks.md`. The distinction between "regenerate a derived artifact" and "edit a
signed one" is what makes the loop safe or unsafe, and nothing in ADR-011 draws it.

specloom's original text gestured at the concern without naming the mechanism:
"fix the reported issues and re-run it, **don't reason about the reports
yourself**" and "at the 4th failed attempt, stop and report … **without further
blind edits**". That is guard language about *style* (no blind edits), not a rule
about *which files* may change. This ADR supplies the missing rule.

## Decision

A capped fix→validate→re-run loop MUST distinguish derived artifacts from
human-signed ones:

1. **Regeneration is permitted.** A loop iteration may re-run a deterministic
   generator to refresh a derived artifact — `playbook packet <change-id>` for a
   stale `context-packet.md` being the canonical case — and then re-run
   `playbook validate`.
2. **Mutating a human-signed artifact is forbidden.** `sdd-commit` MUST NOT edit
   `proposal.md`, `design.md`, `tasks.md`, or any gate report
   (`code-review-report.md`, `security-report.md`, `runtime-gate-report.md`) in
   order to make `validate` pass. `proposal.md` and `design.md` carry a human
   `status: approved`; the gate reports carry a gate's verdict. Neither is the
   delivery stage's to rewrite.
3. **A forbidden fix stops immediately and does not consume an iteration.** When
   the only way past a `validate` failure is a change to a signed artifact, the
   skill stops and reports which artifact and which issue, so a human decides.
   Burning the 3-iteration budget on something it may not fix would only delay
   the same stop.
4. **The cap never weakens a security verdict.** A loop iteration MUST NOT make
   `validate` pass by lowering or flipping a gate report's `status` — in
   particular `security-report.md`. This is the delivery-stage analogue of
   ADR-011's rule that the TDD cap can never mark a task complete while its
   security negative test is red: a retry budget is never a reason to weaken a
   security rule. It reinforces `sdd-commit`'s existing "Do not commit around a
   blocking finding".
5. **`sdd-new` is unaffected.** It writes the artifacts it validates, so its loop
   already operates only on its own unsigned drafts. The rule constrains a loop
   that spans stages, which is what makes `sdd-commit` different.

This is **stricter than ADR-011** and does not supersede it: ADR-011's caps,
stop/report semantics, and counter-reset-on-human-continue all stand unchanged.
This ADR adds the missing scope dimension.

Enforcement is wiring plus content assertions in
`test/skill-contract.test.js` — the same mechanism used for the packet,
`spec-index`, `detect-siblings`, and contract-authoring wirings.

## Consequences

### Positive
- The restored loop cannot turn a delivery skill into an editor of approved
  artifacts, which is the one way "cap at 3" could have made things worse than
  the immediate stop it replaces.
- The realistic, high-frequency case (stale packet) is handled automatically
  instead of bouncing to a human for a deterministic regeneration.
- Names a rule that generalizes: any future playbook gaining a capped loop
  inherits the derived-vs-signed test instead of re-litigating it.
- Keeps a security verdict outside the reach of a retry budget, extending
  ADR-011's precedence principle to the delivery stage.

### Negative
- The instruction is longer than a bare "cap at 3": it must enumerate what is
  regenerable and what is off-limits. Accepted — the enumeration *is* the
  decision, and a rule the agent cannot apply is not a rule.
- A `validate` failure caused by a genuinely wrong signed artifact now always
  needs a human, even when the fix is obvious. Accepted: "obvious" edits to a
  signed artifact are exactly what should not happen unattended.

### Risks
- The derived/signed boundary is stated as an explicit list, so a future artifact
  type is unclassified until someone classifies it. Mitigation: the default is the
  strict side — anything not named as regenerable is treated as signed, so an
  unclassified artifact stops the loop rather than getting edited.
- The rule lives in prose in a prompt, so it holds only as long as the wiring
  does. That is what the content assertion is for; it is also why the enforcement
  level for this class was settled as wiring + content test.

## Alternatives considered

### Cap at 3 with no scope rule (literal ADR-011 / specloom)
Rejected. It restores the loop faithfully but leaves the delivery skill free to
edit an approved `proposal.md` or a gate report to make `validate` pass. The whole
point of a human `status: approved` is that a later stage does not quietly change
what was approved. Fidelity to the letter of ADR-011 is not worth reintroducing
that hole, and ADR-011's own spirit ("no blind edits") points the same way.

### Keep the immediate stop and drop `sdd-commit` from ADR-011 / `spec.md:57`
Rejected. It is the cheapest option and changes no behavior, but it throws away
the loop's real value: the stale-packet case is deterministic, safe, and common
enough that sending it to a human every time is pure friction. It would also mean
amending an accepted ADR to match an implementation gap — letting drift define the
decision instead of the reverse, which is the exact inversion this line of work
exists to correct.

### Allow editing signed artifacts but require explicit human confirmation per edit
Rejected. It collapses into option 1 in practice — the human is already in the
loop at that point — while adding a confirmation protocol to a skill that has no
other interactive step in its validate path. Stopping and reporting is the same
outcome with less machinery.

## Impact

- backend: no impact — no `src/` change; skill prose and tests only
- frontend: no impact
- security: strengthens — a retry budget can never weaken a gate verdict (rule 4)
- data: no impact
- deployment: no impact
- testing: new content assertions in `test/skill-contract.test.js`
