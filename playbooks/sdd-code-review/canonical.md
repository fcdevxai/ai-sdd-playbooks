---
slug: sdd-code-review
title_en: "SDD Code Review - Spec Compliance Review"
title_es: "SDD Code Review - Revision Automatizada Pre-PR"
description: "Review implemented code against the spec before opening a PR. Validate spec coverage, scope compliance, project conventions, and generate code-review-report.md with a READY FOR PR or REQUIRES FIXES verdict. Activate when the user says \"sdd-code-review\", \"review against spec\", \"pre-PR review\", or asks to validate the implementation against the proposal."
description_es: "Revisa el codigo implementado contra la spec, detecta inconsistencias y genera un code-review-report.md con veredicto final antes de abrir PR."
when_es: "Despues de `/sdd-apply` y antes de `/sdd-commit`, cuando `testing-report.md` esta generado."
output_file: "code-review-report.md"
verdict_pass: "READY FOR PR"
verdict_fail: "REQUIRES FIXES"
requires_terminal: false
---

## Purpose

Review implemented code against `proposal.md` before human review. Catch spec violations, scope creep, missing error handling, and convention issues early. Generate `code-review-report.md` with a binary verdict.

This review validates that code implements agreed criteria. It does not validate whether criteria themselves were correct (human review responsibility).

---

## Context

Read before reviewing:

1. `openspec/changes/[ticket-slug]/proposal.md` - acceptance criteria and constraints
2. `openspec/changes/[ticket-slug]/testing-report.md` - generated tests/checks
3. `openspec/changes/[ticket-slug]/tasks.md` - files created/modified
4. `openspec/specs/system.md` - architecture and naming rules
5. `docs/doc_architecture.md` and `docs/doc_verification_guide.md` - project conventions and quality commands
6. All files listed as created/modified in `tasks.md`

---

## Behavior

### 1. Run checklist

**Spec coverage**
- [ ] Every acceptance criterion in `proposal.md` has at least one passing test/check
- [ ] Every error case in `proposal.md` has explicit handling and evidence
- [ ] `testing-report.md` maps criteria to evidence

**Scope**
- [ ] No files modified outside modules allowed by `## Constraints and non-goals`
- [ ] No feature added outside spec scope
- [ ] Contract changes are intentional and documented

**Conventions and quality gates**
- [ ] Naming/structure follow `openspec/specs/system.md`
- [ ] Layer boundaries follow `docs/doc_architecture.md`
- [ ] Required project quality commands were executed (format/lint/type-check/tests) per `docs/doc_verification_guide.md`
- [ ] New tests/checks exist for changed behavior

### 2. Generate report

````markdown
# Code Review Report - [Feature name]

**Ticket**: [ticket-slug]
**Date**: [YYYY-MM-DD]
**Spec**: openspec/changes/[ticket-slug]/proposal.md

## Checklist

### Spec coverage
- [PASS/FAIL] Criterion #1 covered by `[test/check]`
- [PASS/FAIL] Error case #1 handled and verified

### Scope
- [PASS/FAIL] No changes outside allowed modules

### Conventions
- [PASS/FAIL] Architecture/layer conventions respected
- [PASS/FAIL] Required quality commands executed

## Issues found

### Issue 1 - [Title]
- **File**: `[path/to/file:line]`
- **Problem**: [why this violates spec/scope/convention]
- **Suggested fix**: [how to correct]

## Verdict

READY FOR PR / REQUIRES FIXES

[If REQUIRES FIXES: numbered list of blockers to resolve before PR]
````

---

## Output

`openspec/changes/[ticket-slug]/code-review-report.md` with verdict `READY FOR PR` or `REQUIRES FIXES`.

---

## Rules

- Any acceptance criterion without passing evidence -> verdict must be `REQUIRES FIXES`.
- Any file modified outside `## Constraints and non-goals` -> verdict must be `REQUIRES FIXES`.
- Any required project quality gate not executed -> verdict must be `REQUIRES FIXES`.
- Do not suggest improvements outside spec scope.

<!-- END_SKILL -->

---

## Objetivo

Hacer una primera revision del codigo generado contra la spec, detectar inconsistencias y resolverlas antes de revision humana. Genera `code-review-report.md` con veredicto final.

---

## Instrucciones

1. Lee `openspec/changes/[ticket-slug]/proposal.md`.
2. Lee `openspec/changes/[ticket-slug]/testing-report.md`.
3. Lee `tasks.md` y el codigo implementado.
4. Valida checklist de cobertura, scope, convenciones y calidad.
5. Guarda reporte en `openspec/changes/[ticket-slug]/code-review-report.md`.

---

## Checklist

### Cobertura de spec
- [ ] Cada criterio de aceptacion tiene evidencia passing
- [ ] Cada caso de error tiene manejo explicito y evidencia
- [ ] `testing-report.md` refleja todos los criterios

### Scope
- [ ] No hay cambios fuera de `proposal.md`
- [ ] No hay over-engineering fuera de spec
- [ ] Cambios de contrato justificados/documentados

### Convenciones y calidad
- [ ] Convenciones de `openspec/specs/system.md` respetadas
- [ ] Reglas de arquitectura de `docs/doc_architecture.md` respetadas
- [ ] Comandos de calidad definidos en `docs/doc_verification_guide.md` ejecutados
- [ ] Tests/checks nuevos cubren comportamiento modificado

---

## Criterio de bloqueo

El veredicto `REQUIRES FIXES` bloquea avance a `/sdd-commit`. No abrir PR hasta resolver todos los issues.
