---
name: sdd-enrich-us
description: "Turn a rough task or idea into a decision-closed, senior-reviewable requirement by asking structured, code-grounded questions. Draft the final requirement only after all key decisions are closed and the user confirms. Activate when the user says 'sdd-enrich-us', describes a new feature idea, or wants to start the SDD cycle from scratch."
lifecycle_stage: null
produces: []
requires: {}
version: 2.0.0
---

## Purpose

Transform a vague task into a **decision-closed, technically clear requirement**
a senior engineer can act on. This is a **pre-process** (C-02): it runs *before*
the formal SDD change exists. It does not create the `openspec/changes/` folder —
that is `sdd-new`.

Optimize for **clarity, completeness, and closed decisions**, not wording.

## Context

Read `docs/architecture.md` (or the project's adopted architecture doc) before
asking questions. If you cannot read it, stop and tell the user.

## Behavior

1. **Understand the request** — what the user wants, the problem it solves, what is unclear.
2. **Ask clarifying questions** in the user's language. The goal is to *force
   decisions*, not to explore. Prefer trade-off questions (A vs B) with a
   suggested default grounded in the real codebase (existing endpoints, contracts,
   services, conventions). Ask as many as needed.
   Cover every dimension: solution shape, expected output, behavior (normal/edge/
   failure), actor & usage context, scope boundaries, success criteria.
3. **Iterate** until no decision is open.
4. **Confirm before writing**: "Everything looks clear. Draft the final requirement?"
5. **Draft only after explicit confirmation** — a decision-closed requirement
   (story, objective, scope in/out, closed decisions, expected behavior/output,
   success criteria). This text feeds `sdd-new`.

## Rules

- Do not write code. Do not assume missing decisions. Do not draft while decisions are open.
- Always respond in the user's language. Optimize for clarity, not verbosity.
- Do not create the change folder or any artifact file — hand the requirement to `sdd-new`.
