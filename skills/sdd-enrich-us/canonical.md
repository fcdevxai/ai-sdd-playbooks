---
name: sdd-enrich-us
description: "Turn a rough task or idea into a decision-closed, senior-reviewable requirement by asking structured, code-grounded questions. Draft the final requirement only after all key decisions are closed and the user confirms. Activate when the user says 'sdd-enrich-us', describes a new feature idea, or wants to start the SDD cycle from scratch. Triggers: enrich user story, refine idea, tengo una idea, armar proposal, refinar ticket."
description_es: "Convertir una idea, bug o pedido de feature en un requisito con decisiones cerradas, listo para un ingeniero senior, mediante preguntas estructuradas ancladas en el código real. Redactar el borrador final solo cuando ya no queda ninguna decisión abierta y el usuario confirma."
title_en: "SDD Enrich US — Close Requirement Decisions"
title_es: "SDD Enrich US — Cerrar Decisiones del Requisito"
when: "At the very start of the cycle, before `sdd-new` — whenever the user brings a rough idea, ticket, or bug report."
output_file: "N/A (feeds sdd-new; does not write to openspec/changes/)"
requires_terminal: false
lifecycle_stage: null
produces: []
requires: {}
version: 0.1.0
---

## Purpose

Transform a vague task into a **decision-closed, technically clear requirement**
a senior engineer can act on. This is a **pre-process**: it runs *before* the
formal SDD change exists. It does not create the `openspec/changes/` folder —
that is `sdd-new`.

Optimize for **clarity, completeness, and closed decisions**, not wording.

## Context

Read `docs/doc_architecture.md` (or the project's adopted architecture doc) and
`docs/security-checklist.md` (known sensitive surfaces) before asking
questions. If you cannot read them, stop and tell the user.

## Behavior

1. **Understand the request** — what the user wants, the problem it solves, what is unclear.
2. **Ask clarifying questions** in the user's language. The goal is to *force
   decisions*, not to explore. Prefer trade-off questions (A vs B) with a
   suggested default grounded in the real codebase (existing endpoints, contracts,
   services, conventions). Ask as many as needed.
   Cover every dimension: solution shape, expected output, behavior (normal/edge/
   failure), actor & usage context, scope boundaries, success criteria, and
   **security and data sensitivity**.
   **Security and data sensitivity is a mandatory dimension** — always close it
   before drafting: which data, permissions, or external input the feature
   touches and how each is protected. Its answers seed the proposal's `SEC-N`
   considerations, so never skip it — even when the closed answer is "no
   sensitive surface".
3. **Flag hard-to-reverse decisions as ADR candidates.** While closing a
   decision, if it concerns authentication/authorization, module/service
   structure, a public contract, adoption of a significant library, a
   persistence model, deployment topology, or a cross-cutting convention, mark
   it `[ADR candidate]` in the closed-decisions list. `sdd-new` turns each
   marked decision into an `adr-*.md` draft — this is the only place that list
   exists before `sdd-new` drops it, so mark it now or the reasoning is lost.
4. **Iterate** until no decision is open.
5. **Confirm before writing**: "Everything looks clear. Draft the final requirement?"
6. **Draft only after explicit confirmation** — a decision-closed requirement
   (story, objective, scope in/out, closed decisions with `[ADR candidate]`
   markers, expected behavior/output, success criteria). This text feeds `sdd-new`.

## Rules

- Do not write code. Do not assume missing decisions. Do not draft while decisions are open.
- Always respond in the user's language. Optimize for clarity, not verbosity.
- Do not create the change folder or any artifact file — hand the requirement to `sdd-new`.
- Cap clarification at 4 rounds of questions; if decisions are still open after
  round 4, draft with the remaining gaps explicitly listed as open technical
  decisions rather than looping indefinitely.
