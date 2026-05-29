---
slug: sdd-new
title_en: "SDD New — Create Feature Artifacts"
title_es: "SDD New — Crear Artefactos de Feature"
description: "Create the SDD feature folder and initial artifacts (OWNER.md, proposal.md, tasks.md) in openspec/changes/ from a Refined User Story produced by enrich-us. Activate when the user says \"sdd-new\", \"create feature folder\", \"initialize feature artifacts\", or wants to scaffold openspec/changes/ after running enrich-us."
description_es: "Crea la carpeta y los artefactos iniciales para una nueva feature en openspec/changes/."
when_es: "Después de `/enrich-us` y aprobación del usuario del borrador de proposal.md. Antes de `/sdd-ff`."
output_file: "OWNER.md, proposal.md, tasks.md (placeholder)"
verdict_pass: ""
verdict_fail: ""
requires_terminal: false
---

## Purpose

Create `openspec/changes/[ticket-slug]/` and its initial artifacts from the draft produced by `enrich-us`. This is the first step after all decisions are closed.

Do not proceed if no `proposal.md` draft exists.
Do not set `status: pending` — only a human reviewer can approve the proposal.

---

## Context

Read before acting:

1. `openspec/specs/system.md` — global architecture, conventions, data model
2. `openspec/specs/[affected-domain]/spec.md` — current state of the impacted module

---

## Behavior

### 1. Validate input

- Confirm a `[ticket-slug]` was provided (kebab-case, matches the git branch name).
- Check whether `openspec/changes/[ticket-slug]/proposal.md` already exists from `enrich-us`. If it does not, stop and ask the user to run `enrich-us` first.

### 2. Create folder

Create `openspec/changes/[ticket-slug]/` if it does not exist.

### 3. Generate OWNER.md

```markdown
# Feature Owner

- **Ticket**: [ticket-slug]
- **Developer**: [name — or "pending" if unassigned]
- **Start date**: [YYYY-MM-DD]
- **Estimate**: [story points or days — or "pending"]
- **Branch**: `[ticket-slug]`
```

### 4. Complete proposal.md

Finalize the `enrich-us` draft so all sections are fully closed:

```markdown
---
status: draft
ticket: [ticket-slug]
owner: [developer]
date: [YYYY-MM-DD]
---

# [Feature name]

## Objective
## Guiding principle
## Impacted modules
## Expected behavior
### Happy path (Given/When/Then)
### Edge cases
## Acceptance criteria
## Error cases
## Constraints and non-goals
## Open technical decisions
```

`status` stays `draft` until a human reviewer changes it to `status: pending`.

### 5. Create tasks.md placeholder

```markdown
# Tasks — [Feature name]

**Ticket**: [ticket-slug]
**Spec**: openspec/changes/[ticket-slug]/proposal.md
**Status**: waiting (proposal not yet approved)

Run `sdd-ff [ticket-slug]` after the proposal is approved (status: pending).
```

---

## Output

Confirm files created: `OWNER.md`, `proposal.md`, `tasks.md`.

**Next step**: human review of `proposal.md` → change `status: draft` to `status: pending` → run `sdd-ff [ticket-slug]`.

---

## Rules

- Never set `status: pending` — only a human reviewer can approve the proposal.
- Never create artifacts outside `openspec/changes/[ticket-slug]/`.
- If the folder already exists, only create missing artifacts; do not overwrite existing content.

---

## Objetivo

Crear `openspec/changes/[ticket-slug]/` con sus artefactos iniciales a partir del borrador generado por `/enrich-us`. No avanzar sin un `proposal.md` existente.

---

## Instrucciones

1. Verifica que existe `openspec/changes/[ticket-slug]/proposal.md` con contenido de `/enrich-us`. Si no existe, detente.
2. Lee `openspec/specs/system.md` y el spec del módulo afectado.
3. Crea la carpeta si no existe.
4. Genera `OWNER.md` con ticket, developer, fecha y rama.
5. Completa todas las secciones de `proposal.md` (sin "si aplica", sin "o", sin "puede ser"). Deja `status: draft`.
6. Crea `design.md` con secciones: capa backend, capa frontend, impacto en specs existentes, decisiones de arquitectura tomadas.
7. Crea `tasks.md` placeholder con estado "waiting (proposal not yet approved)".
8. Confirma al usuario los archivos creados.

---

## Checklist

- [ ] `proposal.md` existe como borrador de `/enrich-us`
- [ ] Carpeta `openspec/changes/[ticket-slug]/` creada
- [ ] `OWNER.md` generado
- [ ] `proposal.md` con todas las secciones cerradas
- [ ] `design.md` con estructura inicial
- [ ] `tasks.md` placeholder creado
- [ ] `status: draft` (NO cambiar a `pending`)

---

## Formato de reporte

No genera reporte. Confirma los archivos creados y el siguiente paso para el usuario.

---

## Criterio de bloqueo

No avanzar a `/sdd-ff` sin que el usuario apruebe `proposal.md` (cambie `status: draft` a `status: pending`).

---

## Qué NO reemplaza

- La aprobación humana del proposal (solo el revisor puede cambiar `status: pending`)
- El diseño técnico detallado (se completa durante `/sdd-ff` y `/sdd-apply`)
