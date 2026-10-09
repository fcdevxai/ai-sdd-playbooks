# Bounded closure review — methodology `harness-trust-restoration`

You are the single closure reviewer of this change. This is **not** an open-ended
`sdd-code-review` and not an adversarial audit. Your only job is to verify the closed
acceptance checklist of design Amendment R7 and classify findings by its blocking rule.

## Read first

1. `proposal.md` — the acceptance criteria (AC-1–AC-11), error cases (EC-1–EC-6) and
   security considerations (SEC-1–SEC-6). They are unchanged.
2. `design.md`, **Amendment R7** — threat model (rule 1), checklist C1–C12 (rule 2),
   blocking rule (rule 3), disposition (rule 4), delivery (rule 5), version (rule 6),
   release coherence (rule 7). R7 supersedes R5 rule 8 and the Blocking/Scope paragraphs
   of R6.
3. `closure-report.md` — the checklist evidence produced by the closure apply session, with
   commands, exit codes and private result paths.

Earlier reports, handoffs and amendments are history. Use them only to locate evidence.

## What you do

For each checklist item C1–C12:

- Verify it from the recorded evidence. You may re-run the exact recorded command when
  the evidence is unclear, with `TMPDIR` set to the closure scratch directory named in
  `closure-report.md` (the root filesystem is nearly full).
- For C4 and C5, open the cited tests and confirm they assert the mapped behavior.
- Record `verified` or `not verified`, with the evidence you used.

## What you do not do

- Do not write new adversarial probes, variants or fuzzing. Do not reuse probes outside
  those named in C6.
- Do not review against rules other than R1–R7 and the proposal criteria.
- Do not run `playbook packet`, `seal`, `bind`, `retain`, lifecycle gates, staging,
  commits, pushes or installs. Do not edit any file except your report.

## Classifying findings (R7 rule 3)

A finding is **blocking** only if it states all three:

1. the checklist item or AC/EC/SEC it violates;
2. a realistic scenario inside the honest-error threat model (R7 rule 1);
3. a reproduction in the real flow: real repositories and the real lifecycle order, not
   only a synthetic adversarial fixture.

Anything else goes under **Follow-ups**, with a suggested owner. Out-of-scope classes in
R7 rule 1 and the accepted limits of R2–R5 are not findings.

## Output

Write `closure-review-report.md` in this directory, then stop:

```markdown
# Closure review — harness-trust-restoration (methodology)

Result: approved | blocked
Reviewer: <agent, provider, model as declared>
Date: <YYYY-MM-DD>

## Checklist
| ID | Result | Evidence |
|---|---|---|
| C1 | verified / not verified | <command, exit code, counts, path> |
...

## Blocking findings
### B1 — <title>
- Checklist item / criterion:
- Scenario (threat model):
- Real-flow reproduction:
- Suggested fix:

## Follow-ups
- <finding> — owner: <owner>
```

`Result: approved` requires every item verified and no blocking finding. This review has
one round. If it is `blocked`, the apply session fixes only the blocking findings, and a
delta review checks only those. Nothing else is reopened, and any open point after the
delta review is decided by the user.
