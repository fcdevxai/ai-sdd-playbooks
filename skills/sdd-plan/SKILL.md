---
name: sdd-plan
description: "Granularize an approved proposal (and design, when required) into an executable, phase-based tasks.md with atomic tasks, each with a verifiable success criterion linked to an acceptance criterion. Activate when the user says 'sdd-plan', 'plan tasks', or when 'sdd next' routes here."
lifecycle_stage: plan
produces: [tasks.md]
requires:
  artifacts:
    proposal.md: { status: approved }
    design.md: { status: [approved, not_applicable], when: design_required }
version: 2.0.0
---

## Purpose

Read an approved `proposal.md` (and `design.md` when design is required) and
generate an executable, phase-based `tasks.md`. Each task is atomic,
independently verifiable, and linked to a specific acceptance criterion.

## Preconditions (self-check)

Confirm — or run `sdd validate --precondition sdd-plan`:
`proposal.status == approved`, and **when design is required**,
`design.status ∈ {approved, not_applicable}`. If unmet, stop and name the
missing precondition (e.g. "design.md is required and must be approved first").

## Context

Read: `proposal.md` (acceptance criteria, constraints, error cases), `design.md`
(if present), `openspec/specs/system.md`, `docs/doc_architecture.md` /
`docs/doc_verification_guide.md`, and existing implementation files in the affected modules.

## Behavior

1. Map each acceptance criterion to impacted layers; identify files to create or
   modify; identify only truly-needed setup commands.
2. Write `tasks.md` with `status: ready`, organized into phases of atomic tasks:

```markdown
---
schema: tasks
schema_version: 1
change_id: <change-id>
status: ready
updated: <YYYY-MM-DD>
---
# Tasks — <Feature name>

## Phase 1 — Core implementation
### Task 1.1 — <atomic name>
- **Files**: `<path/a>`, `<path/b>`
- **Success criterion**: `<verifiable result: passing test/check or behavior>`
- **Linked acceptance criterion**: AC-0N
...
## Phase N — Quality gates
- format, lint/type-check, feature tests, regression (per docs/doc_verification_guide.md)
```

3. Report the total task count and tell the user to run `sdd next` (it will route
   to `sdd-apply`).

## Rules

- Every task must have a verifiable success criterion; never mix unrelated layers
  in one task if it makes verification non-atomic.
- Do not plan changes to files outside `## Constraints and non-goals`.
- State inter-task dependencies explicitly.
