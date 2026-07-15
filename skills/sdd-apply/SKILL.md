---
name: sdd-apply
description: "Implement the approved tasks.md following TDD: write tests first, then code, run the project's test and quality commands, mark tasks complete, and set tasks.md status. Activate when the user says 'sdd-apply', 'implement spec', or 'execute tasks'. Requires agent mode with terminal access."
lifecycle_stage: apply
produces: []
requires:
  artifacts:
    proposal.md: { status: approved }
    design.md: { status: [approved, not_applicable], when: design_required }
    tasks.md: { status: ready }
version: 2.0.0
---

## Purpose

Execute the approved `tasks.md` plan without improvising, using TDD: test first,
then the code that makes it pass. Stop immediately on any spec ambiguity — never
guess outside scope.

> Requires agent mode with terminal access (runs project-specific commands).

## Preconditions (self-check)

Before starting, confirm — or run `sdd validate --precondition sdd-apply`:
`proposal.status == approved`, `tasks.status == ready`, and, **only when design
is required**, `design.status ∈ {approved, not_applicable}`. If unmet, stop and
name the missing precondition.

## Context

Read fully before writing code: `proposal.md`, `tasks.md`, `design.md` (if
present), `openspec/specs/system.md`, the affected domain spec, and the project's
`docs/architecture.md` / `docs/verification.md`.

## Behavior

1. Set `tasks.md` `status: in_progress`.
2. For each task in order: write the test/failing check first → write code to
   pass it → verify no file outside `## Constraints and non-goals` was touched →
   run the task-level verification command → mark the task `[x]`.
3. Closure: run the project quality gates (format, lint/type-check, feature tests,
   regression if risk warrants) from `docs/verification.md`.
4. Append an **Execution Report** to `tasks.md` (verified ACs → test/evidence,
   commands run, result). When every task passes and gates are green, set
   `tasks.md` `status: passed`. If blocked, set `status: blocked` and record why.

## Output

- Implemented code (all tasks `[x]`).
- `tasks.md` updated: checkboxes, Execution Report, and `status: passed` (or `blocked`).

## Rules

- STOP on spec ambiguity → describe the problem → wait. Never guess.
- Never modify files outside `## Constraints and non-goals` of `proposal.md`.
- Never mark a task complete without its verification passing.
- Follow conventions in `openspec/specs/system.md` and project docs.
