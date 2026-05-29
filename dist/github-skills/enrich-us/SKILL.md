---
name: enrich-us
description: Turn a rough task or idea into a decision-closed, senior-reviewable requirement by asking structured questions grounded in the existing codebase. Only draft the final artifact after all key decisions are resolved and the user confirms. Activate when the user says "enrich-us", describes a new feature idea, or wants to start the SDD cycle from scratch.
---

# SDD Enrich — Refine User Story

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
