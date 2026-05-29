---
slug: enrich-us
title_en: "SDD Enrich — Refine User Story"
title_es: "SDD Enrich — Refinar User Story"
description: "Turn a rough task or idea into a decision-closed, senior-reviewable requirement by asking structured questions grounded in the existing codebase. Only draft the final artifact after all key decisions are resolved and the user confirms. Activate when the user says \"enrich-us\", describes a new feature idea, or wants to start the SDD cycle from scratch."
description_es: "Convierte una idea o tarea en bruto en un requerimiento listo para revisión, haciendo preguntas estructuradas sobre el codebase. Solo genera el borrador cuando todas las decisiones están cerradas."
when_es: "Al inicio del ciclo SDD — antes de `/sdd-new`. Cuando el usuario tiene una idea o tarea y necesita formalizarla en un requerimiento."
output_file: "proposal.md (draft)"
verdict_pass: ""
verdict_fail: ""
requires_terminal: false
---

## Purpose

Turn a rough task or idea into a decision-closed, senior-reviewable requirement specification. Ask structured questions grounded in the existing codebase. Only draft the final artifact after all key decisions are resolved and the user confirms.

Do not write code. Do not assume missing decisions. Do not draft if any decision remains open.

---

## Context

Before asking questions, read:

1. `openspec/specs/system.md` — global architecture, conventions, data model
2. `openspec/specs/[most-likely-affected-domain]/spec.md` — current state of the impacted module
3. Relevant source files (controllers, models, pages) to understand what already exists

Ground all questions in what you find — never ask about things that are already defined.

---

## Behavior

### 1. Understand the idea

Ask the user to describe the feature or problem in plain language if they haven't already. Do not assume scope.

### 2. Read the codebase

Before asking any question, read the relevant parts of the codebase. Identify:

- What already exists that this feature interacts with
- What decisions are genuinely open (not answered by the codebase)
- What constraints come from the existing architecture

### 3. Ask structured questions

Group open questions into categories. Only ask questions whose answers are truly needed to write a complete spec. Never ask about things already defined in the codebase or specs.

Categories:
- **Scope**: What is in and out of scope?
- **Behavior**: What does the system do in the happy path? Edge cases? Failure cases?
- **Data**: What data is created, read, updated, or deleted?
- **Authorization**: Who can perform this action?
- **UI/UX**: What does the user see and when?
- **Constraints**: What must NOT change? What are the non-goals?

### 4. Wait for all answers

Do not draft until the user has answered all questions. If a question gets an ambiguous answer, clarify once.

### 5. Draft the proposal

Only after all decisions are closed, produce the draft:

```markdown
---
status: draft
ticket: [ticket-slug — ask user if not provided]
owner: [developer — or "pending"]
date: [YYYY-MM-DD]
---

# [Feature name]

---

## Output

A complete `proposal.md` draft with `status: draft`, ready for human review and approval before `sdd-new`.

---

## Rules

- Do not write code
- Do not assume missing decisions
- Do not draft if any decision remains open
- Always respond in the user's language
- Optimize for clarity, not verbosity
- Never skip the codebase reading step — questions must be grounded in what exists

<!-- END_SKILL -->

---

## Objetivo

Convertir una idea o tarea en bruto en un requerimiento cerrado, listo para revisión senior, haciendo preguntas estructuradas sobre el codebase existente. Solo genera el borrador final cuando todas las decisiones clave están resueltas y el usuario confirma.

---

## Instrucciones

1. Pide al usuario que describa la feature o problema en lenguaje llano si no lo ha hecho.
2. Lee las partes relevantes del codebase (`openspec/specs/system.md`, specs del módulo afectado, archivos de implementación existentes) antes de hacer cualquier pregunta.
3. Identifica las decisiones genuinamente abiertas — no preguntes sobre lo que ya está definido en el código o en los specs.
4. Agrupa las preguntas en categorías: Scope, Comportamiento, Datos, Autorización, UI/UX, Restricciones.
5. Espera a que todas las preguntas estén respondidas antes de redactar.
6. Genera el borrador de `proposal.md` con `status: draft`.
7. Presenta el borrador y pregunta: "¿Apruebas esta propuesta? Responde 'sí' para continuar con `/sdd-new [ticket-slug]`."

---

## Checklist

- [ ] Codebase leído antes de hacer preguntas
- [ ] Todas las decisiones de scope cerradas
- [ ] Happy path con Given/When/Then completo
- [ ] Edge cases identificados
- [ ] Criterios de aceptación testeables (verificables con código)
- [ ] Casos de error con respuesta esperada
- [ ] Restricciones y non-goals explícitos
- [ ] Usuario confirma la propuesta antes de continuar

---

## Formato de reporte

No genera reporte. El output es el borrador de `proposal.md` presentado al usuario para aprobación.

---

## Criterio de bloqueo

No continuar a `/sdd-new` sin confirmación explícita del usuario.

---

## Qué NO reemplaza

- La revisión humana del proposal (el usuario debe cambiar `status: draft` a `status: pending`)
- Decisiones de arquitectura que requieren contexto de negocio profundo
