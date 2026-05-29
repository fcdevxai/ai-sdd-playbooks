---
slug: sdd-ff
title_en: "SDD FF — Granularize Tasks"
title_es: "SDD FF — Granularizar Tareas"
description: "Granularize an approved proposal.md (status: pending) into an executable phase-based tasks.md plan. Activate when the user says \"sdd-ff\", \"granularize tasks\", \"plan tasks\", \"create tasks.md\", or wants to generate the execution plan after proposal approval."
description_es: "Lee una proposal.md aprobada y genera un tasks.md ejecutable, organizado por fases. Cada tarea debe ser atómica con criterio de éxito verificable."
when_es: "Después de que el usuario aprueba `proposal.md` (status: pending). Antes de `/sdd-apply`."
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

## Phase 1 — Backend

### Task 1.1 — [Atomic name]
- **Files to create/modify**: `app/...`
- **Creation command**: `php artisan make:...` (if applicable)
- **Success criterion**: test `tests/Feature/.../TestName.php` passes
- **Linked acceptance criterion**: #N from proposal.md

## Phase 2 — Frontend

### Task 2.1 — [Atomic name]
- **Files to create/modify**: `resources/js/...`
- **Success criterion**: [verifiable expected behavior]
- **Linked acceptance criterion**: #N from proposal.md

## Phase 3 — Tests

### Task 3.1 — Feature tests
- `php artisan make:test --phpunit [TestName]`
- Covers acceptance criteria: #1, #2, #N
- Validation command: `php artisan test --compact tests/Feature/...`

## Phase 4 — Closure

### Task 4.1 — Format and regenerate
- `vendor/bin/pint --dirty --format agent`
- `php artisan wayfinder:generate` (if routes changed)
- `npm run types:check` (if TypeScript changed)
- `php artisan test --compact --filter=[feature]`
```

### 4. Confirm

Report the total number of tasks and ask the user whether to proceed with `sdd-apply [ticket-slug]`.

---

## Output

`openspec/changes/[ticket-slug]/tasks.md` with `status: ready`.

---

## Rules

- Never mix backend and frontend in a single task — each task must be independently executable.
- Every task must have a verifiable success criterion (a passing test or an observable behavior).
- Do not plan tasks for files outside `## Constraints and non-goals` in `proposal.md`.
- If a task depends on another, state the dependency explicitly.

---

## Objetivo

Leer `proposal.md` aprobada y generar las tareas granularizadas en `tasks.md`, listas para ejecutar con `/sdd-apply`. Cada tarea debe ser atómica con criterio de éxito verificable.

---

## Instrucciones

1. Lee `openspec/changes/[ticket-slug]/proposal.md`. Verifica `status: pending`. Si es `draft`, detente.
2. Lee `openspec/changes/[ticket-slug]/design.md` para decisiones técnicas.
3. Lee `openspec/specs/system.md` para convenciones globales.
4. Lee los archivos de implementación existentes relacionados para entender el estado actual del código.
5. Para cada criterio de aceptación, identifica las capas que toca (backend, frontend, tests).
6. Genera `tasks.md` con `status: ready`, organizado en fases (Backend → Frontend → Tests → Closure).
7. Cada tarea: nombre atómico, archivos a crear/modificar, comando artisan si aplica, criterio de éxito, criterio de aceptación vinculado.
8. Reporta el total de tareas y pregunta si procede con `/sdd-apply [ticket-slug]`.

---

## Checklist

- [ ] `proposal.md` tiene `status: pending`
- [ ] Cada criterio de aceptación mapeado a tareas concretas
- [ ] Tareas separadas por capa (sin mezclar backend y frontend)
- [ ] Cada tarea tiene criterio de éxito verificable (test o comportamiento observable)
- [ ] Ninguna tarea fuera del scope de "Restricciones y non-goals"
- [ ] Dependencias entre tareas documentadas explícitamente
- [ ] `tasks.md` guardado con `status: ready`

---

## Formato de reporte

No genera reporte. Presenta el `tasks.md` generado al usuario y pide confirmación para proceder con `/sdd-apply`.

---

## Criterio de bloqueo

No generar tareas si `proposal.md` tiene `status: draft`. El usuario debe aprobar primero.

---

## Qué NO reemplaza

- El diseño técnico detallado (se discute en `design.md` antes de `/sdd-ff`)
- La estimación de esfuerzo (responsabilidad del equipo)
