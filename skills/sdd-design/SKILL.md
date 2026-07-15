---
name: sdd-design
description: "Produce the technical design (design.md) for a change where design is required — architecture decisions, contracts, and security controls — for human sign-off. Activate when the user says 'sdd-design' or when 'sdd next' routes here. Skipped automatically when design is not required."
lifecycle_stage: design
produces: [design.md]
requires:
  artifacts:
    proposal.md: { status: approved }
version: 2.0.0
---

## Purpose

Produce the technical contract (`design.md`) for a change whose proposal marks
design as **required** (any `impact.*` is true, or `design.always`). This is the
"how", reviewed by a tech lead before planning.

When design is **not** required, this skill is not run at all: the engine computes
`designed` directly with no `design.md` and no file mutation (C-03). Do not create
a `design.md` for a change that does not need one.

## Preconditions (self-check)

`proposal.status == approved`. If not, stop and say so.

## Context

Read fully: `proposal.md` (objective, impact, security, constraints),
`openspec/specs/system.md`, the affected domain spec, and `docs/doc_architecture.md`.

## Behavior

1. Design the solution: layer/module deltas, public contracts (endpoints,
   response shapes, events), data-model changes, and how it fits existing
   architecture.
2. **Security refinement (C-04)**: carry the proposal's `risk` forward, set
   `threat_model_required`, and list the concrete `controls` (`SEC-00x`). Include
   a threat-model section when `risk: elevated` or `threat_model_required: true`.
   You may **raise** risk if the design surfaces new exposure; never lower it.
3. Write `design.md` with `status: draft`:

```markdown
---
schema: design
schema_version: 1
change_id: <change-id>
status: draft
security:
  risk: <low|standard|elevated>
  threat_model_required: <bool>
  controls: [SEC-001, SEC-002]
updated: <YYYY-MM-DD>
---
# Technical design — <Feature name>
## Approach
## Public contracts / interfaces
## Data model changes
## Security controls (+ threat model when required)
## Testing strategy
```

4. Ask the tech lead to review. **A human sets `status: approved`** — this skill
   never self-approves. While it stays `draft`, `sdd next` reports "await human".

## Rules

- Never set `status: approved` yourself — design sign-off is a human action.
- Never lower an approved risk level; you may raise it with justification.
- Do not create `design.md` when design is not required.
