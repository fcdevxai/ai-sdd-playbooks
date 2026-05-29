---
name: sdd-ff
description: Granularize an approved proposal.md (status: pending) into an executable phase-based tasks.md plan. Activate when the user says "sdd-ff", "granularize tasks", "plan tasks", "create tasks.md", or wants to generate the execution plan after proposal approval.
---

# SDD FF — Granularize Tasks

## Purpose

Read an approved `proposal.md` (`status: pending`) and generate an executable, phase-based `tasks.md`. Each task must be atomic, independently verifiable, and linked to a specific acceptance criterion.

Do not proceed if `proposal.md` has `status: draft`.

---

## Context

Read before generating tasks:

1. `openspec/changes/[ticket-slug]/proposal.md` — acceptance criteria, constraints, error cases. Verify `status: pending`.
2. `openspec/changes/[ticket-slug]/design.md` — technical architecture decisions (if it exists)
3. `openspec/specs/system.md` — global conventions, layer rules, naming
4. Existing implementation files relevant to affected modules (controllers, models, Inertia pages) — understand current conventions before planning

---

## Behavior

### 1. Validate proposal status

- If `status: draft` → stop. The proposal must be approved (`status: pending`) before task planning. Ask the user to review and approve it first.
- If `status: pending` → proceed.

### 2. Analyze scope

- Map each acceptance criterion to the layers it touches (backend, frontend, tests).
- Identify files to create or modify per layer.
- Identify `php artisan make:` commands needed for new classes.

### 3. Generate tasks.md

```markdown
# Tasks — [Feature name]

**Ticket**: [ticket-slug]
**Spec**: openspec/changes/[ticket-slug]/proposal.md
**Status**: ready

---

## Output

`openspec/changes/[ticket-slug]/tasks.md` with `status: ready`.

---

## Rules

- Never mix backend and frontend in a single task — each task must be independently executable.
- Every task must have a verifiable success criterion (a passing test or an observable behavior).
- Do not plan tasks for files outside `## Constraints and non-goals` in `proposal.md`.
- If a task depends on another, state the dependency explicitly.
