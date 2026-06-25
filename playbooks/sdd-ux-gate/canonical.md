---
lang: en
slug: sdd-ux-gate
title_en: "SDD UX Gate — UX/UI Functional Review"
title_es: "SDD UX Gate — Validación UX/UI pre-PR"
description: "Validate UX/UI behavior after implementation and before PR approval. Review end-to-end user flows, UI states, responsive behavior, accessibility basics, and evidence quality. Generate ux-gate-report.md with READY FOR PR UX or REQUIRES UX FIXES verdict. Activate when the user says \"sdd-ux-gate\", \"ux gate\", \"ux review\", \"ui review\", \"validate ux\", or asks to review the implemented feature from a UX/UI perspective."
description_es: "Valida que la implementación cumple el flujo UX/UI esperado antes del PR humano final. Complementa la revisión técnica de sdd-code-review."
when: "Después de `/sdd-code-review` y antes de `/sdd-commit`."
output_file: "ux-gate-report.md"
verdict_pass: "READY FOR PR UX"
verdict_fail: "REQUIRES UX FIXES"
requires_terminal: false
---

## Purpose

Run a dedicated UX/UI gate after implementation and technical review. This gate validates whether the implemented feature behaves as expected for real users, not just whether code matches the spec.

This review complements `sdd-code-review`:
- `sdd-code-review` checks technical/spec compliance.
- `sdd-ux-gate` checks user experience quality and interaction behavior.

---

## Context

Read before reviewing:

1. `openspec/changes/[ticket-slug]/proposal.md` — acceptance criteria and user intent
2. `openspec/changes/[ticket-slug]/tasks.md` — implemented scope and touched files
3. `openspec/changes/[ticket-slug]/testing-report.md` — technical test evidence
4. `openspec/specs/system.md` — product and architecture conventions
5. Relevant frontend pages/components modified for this ticket

If `code-review-report.md` exists, read it first and ensure the verdict is `READY FOR PR` or list known technical risks in the report assumptions.

---

## Behavior

### 1. Validate primary UX flow

- [ ] Primary user journey completes without blockers
- [ ] Navigation and next actions are clear at each step
- [ ] No dead ends, ambiguous CTAs, or hidden critical actions

### 2. Validate UI states

For each critical screen and action:

- [ ] Loading state exists and is understandable
- [ ] Empty state is informative and actionable
- [ ] Error state is explicit and recoverable
- [ ] Success feedback is visible when needed

### 3. Validate form and interaction quality

- [ ] Validation messages are clear and actionable
- [ ] Field errors are attached to correct controls
- [ ] Failed submit does not lose user input unexpectedly
- [ ] Disabled/loading buttons prevent duplicate actions

### 4. Validate responsive behavior

Check at minimum mobile and desktop breakpoints:

- [ ] Mobile (around 360px) works without clipped content or blocked actions
- [ ] Tablet (around 768px) preserves hierarchy and readability
- [ ] Desktop (1024px+) preserves hierarchy and efficient scanability

### 5. Validate accessibility basics

- [ ] Keyboard navigation works for critical flow
- [ ] Focus indicator is visible and predictable
- [ ] Labels/accessible names exist for interactive elements
- [ ] Contrast appears acceptable for key text and controls

### 6. Validate content and trust

- [ ] Copy is consistent with the feature intent and product tone
- [ ] Warnings and irreversible actions are clear
- [ ] No placeholder/internal technical text is exposed to users

### 7. Collect UX evidence

Attach evidence references in the report:

- [ ] Main flow recording (or step-by-step screenshots)
- [ ] Loading/empty/error state captures
- [ ] Mobile + desktop captures for key screens
- [ ] Noted issues with severity and proposed resolution

### 8. Produce verdict

Use one of:

- `READY FOR PR UX` — no blocking UX/UI issues
- `REQUIRES UX FIXES` — at least one blocking UX/UI issue

Blocking examples:
- User cannot complete the primary flow
- Required action is unclear or inaccessible
- Critical state (error/loading) is missing or misleading
- Severe responsive/accessibility break in the critical flow

---

## Output

`openspec/changes/[ticket-slug]/ux-gate-report.md` with verdict `READY FOR PR UX` or `REQUIRES UX FIXES`.

---

## Rules

- This gate does not replace product or design ownership decisions.
- If the primary flow fails for normal users, verdict must be `REQUIRES UX FIXES`.
- If critical UI state coverage is missing (loading/empty/error), verdict must be `REQUIRES UX FIXES`.
- Do not propose scope expansion beyond the approved feature; report only UX/UI issues for the implemented scope.
- Keep findings concrete and reproducible.

