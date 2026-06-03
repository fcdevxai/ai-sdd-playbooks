---
slug: sdd-enrich-us
title_en: "SDD Enrich — Enrich User Story"
title_es: "SDD Enrich — Refinar User Story"
description: "Turn a rough task or idea into a decision-closed, senior-reviewable requirement by asking structured questions grounded in the existing codebase. Only draft the final artifact after all key decisions are resolved and the user confirms. Activate when the user says \"sdd-enrich-us\", describes a new feature idea, or wants to start the SDD cycle from scratch."
description_es: "Convierte una idea o tarea en bruto en un requerimiento listo para revisión, haciendo preguntas estructuradas sobre el codebase. Solo genera el borrador cuando todas las decisiones están cerradas."
when_es: "Al inicio del ciclo SDD — antes de `/sdd-new`. Cuando el usuario tiene una idea o tarea y necesita formalizarla en un requerimiento."
output_file: "proposal.md (draft)"
verdict_pass: ""
verdict_fail: ""
requires_terminal: false
---

## Purpose

Help the user transform a vague task or idea into a **decision-closed, technically clear requirement**.

This artifact must be understandable by a senior engineer and serve as input for Spec-Driven Development (SDD) planning.

Do not optimize for wording.  
Optimize for **clarity, completeness, and closed decisions**.

---

## Context

You MUST read the following file before asking any questions:

docs/agent_architecture.md

If you cannot access or read this file, stop and inform the user.

---

## Behavior

### 1. Understand the request

Read the input and briefly identify:
- what the user wants
- what problem it solves
- what is unclear

---

### 2. Ask clarifying questions

Ask questions in the same language used by the user.

Your goal is NOT to explore — it is to **force decisions**.

Rules:
- tone: conversational
- ask as many questions as needed to fully close decisions (no artificial limit)
- each question must resolve a concrete decision
- avoid redundant or overlapping questions
- prefer trade-off questions (A vs B) over open-ended ones
- whenever possible, include a suggested default

---

### Mandatory decision dimensions

Your questions MUST collectively cover these dimensions:

1. Solution shape  
   (e.g. new endpoint vs extending existing behavior)

2. Expected output  
   (what must be returned and in what form)

3. Behavior  
   (normal flow, edge cases, and failure scenarios)

4. Actor and usage context  
   (who uses this and why)

5. Scope boundaries  
   (what is in scope vs out of scope)

6. Success criteria  
   (how we know this is correctly implemented)

If any of these is unclear, you MUST ask about it.

---

### Code-grounded suggestions (CRITICAL)

Before proposing any suggested default:

- inspect the existing codebase when relevant
- identify current patterns, endpoints, naming conventions, and data structures
- align with the architecture described in `docs/agent_architecture.md`

Suggested defaults must be grounded in:

- existing endpoints or API structure  
- current request/response contracts  
- existing services or flows  
- real constraints visible in the codebase  

Avoid generic suggestions if code-based evidence is available.

When suggesting defaults:

- explain briefly why the recommendation fits the current system
- when possible, reference specific files, routes, or components

---

### 3. Iterate until decisions are closed

- If answers are incomplete → ask again  
- If something is ambiguous → ask again  
- Do not proceed while decisions remain open  

---

### 4. Confirm before writing

When all key decisions are resolved, ask:

"Everything looks clear now. Do you want me to draft the final requirement?"

Do not write it yet.

---

### 5. Draft only after confirmation

Only if the user explicitly confirms, write the final artifact.

---

## Output

### If there are still open decisions

Respond in the same language as the user:

## Understanding

<what you believe the user wants>

## Questions

1. <question>

   Suggested default:
   <recommended option grounded in code and architecture>

2. <question>

   Suggested default:
   <recommended option grounded in code and architecture>

---

### If everything is clear but not confirmed

Respond in the same language as the user:

## Status

All key decisions are clear and no relevant ambiguity remains.

## Confirmation

Do you want me to draft the final requirement?

---

### If confirmed

Respond in the same language as the user:

# Requirement: <clear title>

## Story

As a <actor>,  
I want <capability>,  
so that <outcome>.

## Objective

<what this enables>

## Context

<problem and why it matters>

## Scope

### In scope

- <item>
- <item>

### Out of scope

- <item>
- <item>

## Closed decisions

- <decision>
- <decision>

## Expected behavior

- <normal behavior>
- <edge case behavior>
- <failure behavior>

## Expected output

- <what is returned and in what shape>

## Success criteria

- <observable condition>
- <validation outcome>

---

## Rules

- Do not write code  
- Do not assume missing decisions  
- Do not draft if decisions remain open  
- Always respond in the user's language  
- Optimize for clarity, not verbosity  
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
