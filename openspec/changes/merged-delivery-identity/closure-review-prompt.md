# Bounded closure review — methodology `merged-delivery-identity`

You are the single closure reviewer of this change. This is not an open-ended
`sdd-code-review` and not an adversarial audit. Verify the closed checklist of the
`design.md` closure contract and classify findings by its blocking rule.

## Read first

1. `proposal.md` — AC-1–AC-6, EC-1–EC-5, SEC-1–SEC-4.
2. `design.md` — approach, security controls, threat model and the closure contract
   (checklist C1–C10, blocking rule, delivery, version).
3. `closure-report.md` — checklist evidence with commands, exit codes and result paths.

## What you do

For each checklist item C1–C10, verify it from the recorded evidence. You may re-run the
exact recorded command when the evidence is unclear, with `TMPDIR` set to the scratch
directory named in `closure-report.md`. For C4 and C5, open the cited tests and confirm they
assert the mapped behavior. Record `verified`, `not verified` or `N/A` with the evidence used.

## What you do not do

Do not write new adversarial probes or variants. Do not review against rules outside the
proposal and the closure contract. Do not run `playbook packet`, `seal`, `bind`, `retain`,
lifecycle gates, staging, commits, pushes or installs. Do not edit any file except your report.

## Classifying findings

A finding is blocking only if it states all three: (1) the checklist item or AC/EC/SEC it
violates; (2) a realistic scenario inside the honest-error threat model; (3) a reproduction in
the real flow, not only a synthetic fixture. Anything else goes under Follow-ups with an owner.

## Output

Write `closure-review-report.md` in this directory, then stop:

```markdown
# Closure review — merged-delivery-identity (methodology)

Result: approved | blocked
Reviewer: <agent, provider, model as declared>
Date: <YYYY-MM-DD>

## Checklist
| ID | Result | Evidence |
|---|---|---|

## Blocking findings

## Follow-ups
```

`Result: approved` requires every item verified or `N/A` and no blocking finding. One round;
if blocked, only the blocking findings are fixed and a delta review checks only those.
