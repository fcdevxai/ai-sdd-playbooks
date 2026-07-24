---
name: sdd-design
description: "Produce the technical design (design.md) for a change where design is required — architecture decisions, contracts, and security controls — for human sign-off. Activate when the user says 'sdd-design' or when 'playbook next' routes here. Skipped automatically when design is not required."
description_es: "Producir el diseño técnico (design.md) de un change que lo requiere — decisiones de arquitectura, contratos y controles de seguridad — para aprobación humana. Se omite automáticamente cuando el diseño no es requerido."
title_en: "SDD Design — Technical Design"
title_es: "SDD Design — Diseño Técnico"
when: "After proposal.md is approved, when design is required (any impact.* true, or design.always)."
output_file: "design.md (+ the canonical contract at contract.path_in_loom when impact.public_contract: true)"
requires_terminal: false
lifecycle_stage: design
produces: [design.md]
requires:
  artifacts:
    proposal.md: { status: approved }
version: 0.1.0
---

## Purpose

Produce the technical contract (`design.md`) for a change whose proposal marks
design as **required** (any `impact.*` is true, or `design.always`). This is the
"how", reviewed by a tech lead before planning.

When design is **not** required, this skill is not run at all: the engine computes
`designed` directly with no `design.md` and no file mutation. Do not create
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
2. **Canonical contract authoring (conditional).** When the proposal declares
   `impact.public_contract: true` **and** `playbook.config.yaml` declares
   `contract.path_in_loom`, add or update this feature's endpoints in the file
   that key points at — the hub-owned canonical contract, authored
   **loom-first**, before the implementing repo builds it. Take the path from
   `contract.path_in_loom`; never hardcode it. The resolved path must stay
   **inside the repo** — if it escapes the project root, stop and report it
   instead of writing. If that file does not exist,
   create it with the minimal skeleton (`openapi`, `info`, `paths`) plus this
   feature's endpoints — nothing else creates it, not `playbook init` and not
   bootstrap. The endpoints in the contract and in `design.md`'s
   `## Public contracts / interfaces` must describe the **same set**: a human
   reviews both in one sign-off, so a mismatch is a design defect, not a
   formatting detail. Never put secrets, real tokens, or PII in `example`,
   `description`, or `servers` — the contract is a versioned artifact shared with
   every consumer repo, so a leak there is effectively permanent. When
   `contract.path_in_loom` is absent, **skip this step and say so explicitly**:
   contract-first is opt-in and there is no default path. `playbook
   contract-drift` checks an implementation against this contract in the
   implementing repo's CI — it is a detector, never the authoring mechanism.
3. **Security refinement**: carry the proposal's `risk` forward, set
   `threat_model_required`, and list the concrete `controls` (`SEC-00x`). Include
   a threat-model section when `risk: elevated` or `threat_model_required: true`.
   You may **raise** risk if the design surfaces new exposure; never lower it.
4. Write `design.md` with `status: draft`:

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
## Module impact
## Trade-offs
## Public contracts / interfaces
## Data model changes
## Security controls (+ threat model when required)
## Testing strategy
```

5. Ask the tech lead to review. **A human sets `status: approved`** — this skill
   never self-approves. While it stays `draft`, `playbook next` reports "await human".

## Rules

- Never set `status: approved` yourself — design sign-off is a human action.
- Never lower an approved risk level; you may raise it with justification.
- Do not create `design.md` when design is not required.
- Never write a canonical contract when `contract.path_in_loom` is absent, and
  never hardcode a contract path — contract-first is opt-in per project.
