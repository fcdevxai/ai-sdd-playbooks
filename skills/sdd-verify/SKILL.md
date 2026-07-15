---
name: sdd-verify
description: "After the PR is merged, verify every acceptance criterion in the proposal has passing tests/checks in the current codebase, check regressions, and write verification-report.md with a normalized passed/failed status. Activate when the user says 'sdd-verify', 'verify acceptance criteria', or 'post-merge verification'. Requires agent mode with terminal access."
lifecycle_stage: verify
produces: [verification-report.md]
requires:
  artifacts:
    runtime-gate-report.md: { status: [passed, not_applicable] }
version: 2.0.0
---

## Purpose

After merge, confirm every acceptance criterion in `proposal.md` has passing
evidence in the current codebase and detect regressions. Produce a schema-valid
`verification-report.md` that gates `sdd-archive`.

> Runs after the branch is **merged** (the CLI gates this on `delivery: merged`)
> and requires terminal access.

## Context

Read: `proposal.md` (all acceptance criteria + error cases), `tasks.md`
(Execution Report), and `docs/doc_verification_guide.md` (project verification commands).

## Behavior

1. Run the project's feature/domain verification command(s).
2. Map each acceptance criterion to a passing test/check; any uncovered criterion
   is a gap.
3. Confirm each error case has passing evidence for its failure path.
4. Run the required regression command(s); confirm no blocking failures.
5. Write `verification-report.md`:

```markdown
---
schema: verification-report
schema_version: 1
change_id: <change-id>
status: passed   # passed | failed
updated: <YYYY-MM-DD>
---
# Verification Report — <Feature name>

## Acceptance criteria
| # | Criterion | Test/Check | Result |
|---|---|---|---|
| AC-01 | <criterion> | `<reference>` | passed |

## Error cases
| # | Error case | Test/Check | Result |

## Regression
**Result**: <summary>
```

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any blocking regression → `status: failed`.
- Never proceed to `sdd-archive` while `status: failed`.
