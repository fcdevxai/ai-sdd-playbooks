---
name: sdd-plan
description: "Granularize an approved proposal (and design, when required) into an executable, phase-based tasks.md with atomic tasks, each with a verifiable success criterion linked to an acceptance criterion. Activate when the user says 'sdd-plan', 'plan tasks', or when 'playbook next' routes here. Triggers: granulariza tareas, arma el plan."
description_es: "Granularizar una proposal aprobada (y el design, cuando es requerido) en un tasks.md ejecutable por fases, con tareas atómicas y un criterio de éxito verificable ligado a un criterio de aceptación."
title_en: "SDD Plan — Granularize Tasks"
title_es: "SDD Plan — Granularizar Tareas"
when: "After proposal.md is approved and design.md (if required) is approved. Before sdd-apply."
output_file: "tasks.md, context-packet.md"
requires_terminal: false
lifecycle_stage: plan
produces: [tasks.md, context-packet.md]
requires:
  artifacts:
    proposal.md: { status: approved }
    design.md: { status: [approved, not_applicable], when: design_required }
version: 0.1.0
---

## Purpose

Read an approved `proposal.md` (and `design.md` when design is required) and
generate an executable, phase-based `tasks.md`. Each task is atomic,
independently verifiable, and linked to a specific acceptance criterion.

## Preconditions (self-check)

Confirm — or run `playbook validate --precondition sdd-plan`:
`proposal.status == approved`, and **when design is required**,
`design.status ∈ {approved, not_applicable}`. If unmet, stop and name the
missing precondition (e.g. "design.md is required and must be approved first").

## Context

Read: `proposal.md` (acceptance criteria, constraints, error cases), `design.md`
(if present), `openspec/specs/system.md`, `docs/doc_architecture.md` /
`docs/doc_verification_guide.md`, `docs/security-checklist.md`,
`playbook.config.yaml` (for `contract.path_in_loom`, when the change touches
the API), and existing implementation files in the affected modules.

## Behavior

1. Map each acceptance criterion to impacted layers; identify files to create or
   modify; identify only truly-needed setup commands. All commands in `tasks.md`
   must be written to run from the repo root — never assume a task-specific `cd`.
   **Contract-first planning (conditional).** When `playbook.config.yaml`
   declares `contract.path_in_loom` and this change touches the API, plan the
   API tasks against the endpoints declared in the contract instead of
   inferring them from the proposal alone: read the contract by path from
   the hub — it is never copied, and it is never synced into this repo, only
   read where it lives. The resolved path must stay **inside the repo** — if
   it escapes the project root, stop and report it instead of reading. If
   `contract.path_in_loom` is declared but that file does not exist, report
   that and continue planning without inventing endpoints: the contract is
   created by `sdd-design`, never by this skill.
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
- **Linked acceptance criterion**: AC-N
...
## Phase N — Quality gates
- **Format**: `<command from docs/doc_verification_guide.md>`
- **Lint/type-check**: `<command>`
- **Feature tests**: `<command>`
- **Regression**: `<command>`
```

3. Generate the context packet: run `playbook packet <change-id>`. It derives
   `context-packet.md` from `proposal.md` + `tasks.md` (verbatim acceptance
   criteria, constraints, security considerations, files touched, verification
   commands) so later gates read one compact file instead of both sources in
   full. Deterministic — safe to re-run any time `tasks.md` changes.
4. Report the total task count and tell the user to run `playbook next` (it will
   route to `sdd-apply`).

## Rules

- Every task must have a verifiable success criterion; never mix unrelated layers
  in one task if it makes verification non-atomic.
- Do not plan changes to files outside `## Constraints and non-goals`.
- State inter-task dependencies explicitly.
- Any task implementing a `## Security considerations` entry (`SEC-N`) must name
  its negative test (e.g. "unauthorized access is rejected") as part of its
  success criterion, not only the happy path.
- The `Regression` entry in the quality-gates phase is mandatory, not
  conditional on risk: it is the exact line `playbook packet` extracts to
  carry the regression command to every gate that reads the packet. Omitting
  it does not skip regression — it silently drops the command before the
  gates ever see it.
