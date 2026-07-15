---
name: sdd-code-review
description: "Review implemented code against the proposal before opening a PR: validate spec coverage, scope compliance, and project conventions, then write code-review-report.md with a normalized passed/failed status. Activate when the user says 'sdd-code-review', 'review against spec', or 'pre-PR review'."
lifecycle_stage: code-review
produces: [code-review-report.md]
requires:
  artifacts:
    tasks.md: { status: passed }
version: 2.0.0
---

## Purpose

Review implemented code against `proposal.md` before human review. Catch spec
violations, scope creep, missing error handling, and convention issues. Produce a
schema-valid `code-review-report.md` with a **normalized status** (`passed` /
`failed`) — not a free-text verdict string.

This validates that the code implements the agreed criteria; it does not judge
whether the criteria themselves were correct (that is the human reviewer's job).

## Context

Read: `proposal.md` (acceptance criteria + constraints), `tasks.md` (Execution
Report, files changed), `openspec/specs/system.md`, `docs/architecture.md` /
`docs/verification.md`, and every file listed as changed.

## Behavior

### 1. Checklist

- **Spec coverage**: every acceptance criterion has ≥1 passing test/check; every
  error case has explicit handling + evidence.
- **Scope**: no files changed outside `## Constraints and non-goals`; no
  out-of-spec features; contract changes intentional and documented.
- **Conventions**: naming/structure per `system.md`; layer boundaries per
  `docs/architecture.md`; required quality commands were executed.

### 2. Write `code-review-report.md`

```markdown
---
schema: code-review-report
schema_version: 1
change_id: <change-id>
status: passed   # passed | failed
updated: <YYYY-MM-DD>
---
# Code Review Report — <Feature name>

## Checklist
- [passed/failed] AC-01 covered by `<test/check>`
- [passed/failed] No changes outside allowed modules
- [passed/failed] Conventions & quality gates respected

## Issues found
### Issue 1 — <title>
- **File**: `<path:line>`
- **Problem**: <why it violates spec/scope/convention>
- **Suggested fix**: <how to correct>
```

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- Do not suggest improvements outside spec scope.
