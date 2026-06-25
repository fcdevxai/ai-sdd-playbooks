---
lang: en
slug: sdd-ff
title_en: "SDD FF - Granularize Tasks"
title_es: "SDD FF - Granularizar Tareas"
description: "Granularize an approved proposal.md (status: pending) into an executable phase-based tasks.md plan. Activate when the user says \"sdd-ff\", \"granularize tasks\", \"plan tasks\", \"create tasks.md\", or wants to generate the execution plan after proposal approval."
description_es: "Lee una proposal.md aprobada y genera un tasks.md ejecutable, organizado por fases. Cada tarea debe ser atomica con criterio de exito verificable."
when: "Despues de que el usuario aprueba `proposal.md` (status: pending). Antes de `/sdd-apply`."
output_file: "tasks.md"
verdict_pass: ""
verdict_fail: ""
requires_terminal: false
---

## Purpose

Read an approved `proposal.md` (`status: pending`) and generate an executable, phase-based `tasks.md`. Each task must be atomic, independently verifiable, and linked to a specific acceptance criterion.

Do not proceed if `proposal.md` has `status: draft`.

---

## Context

Read before generating tasks:

1. `openspec/changes/[ticket-slug]/proposal.md` - acceptance criteria, constraints, error cases. Verify `status: pending`.
2. `openspec/changes/[ticket-slug]/design.md` - technical architecture decisions (if it exists)
3. `openspec/specs/system.md` - global conventions, layer rules, naming
4. `docs/doc_architecture.md` and `docs/doc_verification_guide.md` - project structure and verification commands
5. Existing implementation files relevant to affected modules

---

## Behavior

### 1. Validate proposal status

- If `status: draft` -> stop. Proposal must be approved (`status: pending`) before task planning.
- If `status: pending` -> proceed.

### 2. Analyze scope

- Map each acceptance criterion to impacted layers (API/domain/ui/data/tests, as applicable).
- Identify files to create or modify per layer.
- Identify task-level creation/setup commands only when truly needed (project-specific).

### 3. Generate tasks.md

````markdown
# Tasks - [Feature name]

**Ticket**: [ticket-slug]
**Spec**: openspec/changes/[ticket-slug]/proposal.md
**Status**: ready

---

## Phase 1 - Core implementation

### Task 1.1 - [Atomic name]
- **Files to create/modify**: `[path/a]`, `[path/b]`
- **Optional creation/setup command**: `[command]` (if applicable)
- **Success criterion**: `[verifiable result: passing test/check or observable behavior]`
- **Linked acceptance criterion**: #N from proposal.md

## Phase 2 - Interface or integration

### Task 2.1 - [Atomic name]
- **Files to create/modify**: `[path/c]`
- **Success criterion**: `[verifiable expected behavior]`
- **Linked acceptance criterion**: #N from proposal.md

## Phase 3 - Tests

### Task 3.1 - Feature/domain tests
- Covers acceptance criteria: #1, #2, #N
- Validation command(s): `[project test command for this area]`

## Phase 4 - Closure

### Task 4.1 - Quality gates
- `[project format command]`
- `[project lint/type-check command(s)]`
- `[project feature/domain test command]`
````

### 4. Confirm

Report total number of tasks and ask whether to proceed with `sdd-apply [ticket-slug]`.

---

## Output

`openspec/changes/[ticket-slug]/tasks.md` with `status: ready`.

---

## Rules

- Never mix unrelated layers in a single task if it makes verification non-atomic.
- Every task must have a verifiable success criterion.
- Do not plan tasks for files outside `## Constraints and non-goals` in `proposal.md`.
- If a task depends on another, state dependency explicitly.

