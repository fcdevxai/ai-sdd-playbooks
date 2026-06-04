---
slug: sdd-verify
title_en: "SDD Verify - Post-Merge Acceptance Verification"
title_es: "SDD Verify - Verificar Criterios de Aceptacion post-PR"
description: "Verify that all acceptance criteria in the spec have passing tests/checks after the PR is merged. Run feature verification commands, map each criterion to evidence, check regressions, and generate verification-report.md. Activate when the user says \"sdd-verify\", \"verify acceptance criteria\", \"post-merge verification\", or asks to verify a merged feature before archiving. Requires agent mode with terminal access."
description_es: "Verifica que todos los criterios de aceptacion de la spec se cumplen en el estado actual del codigo, post-merge. Genera verification-report.md."
when_es: "Despues de que el PR fue aprobado y mergeado en main. Antes de `/sdd-archive`."
output_file: "verification-report.md"
verdict_pass: "FEATURE VERIFIED"
verdict_fail: "GAPS DETECTED"
requires_terminal: true
---

## Purpose

After PR merge, confirm every acceptance criterion in `proposal.md` has passing evidence (tests/checks) in the current codebase. Detect regressions. Generate a `verification-report.md` that gates `sdd-archive`.

Run this after merge and before `sdd-archive`.

---

## Context

Read before verifying:

1. `openspec/changes/[ticket-slug]/proposal.md` - full list of acceptance criteria and error cases
2. `openspec/changes/[ticket-slug]/testing-report.md` - tests/checks generated during `sdd-apply`
3. `docs/doc_verification_guide.md` - project-specific verification commands

---

## Behavior

### 1. Run feature-level verification

Run the project command(s) that validate the affected feature/domain (from `docs/doc_verification_guide.md`).

### 2. Map criteria to evidence

For each acceptance criterion in `proposal.md`:

- Identify the test/check covering it.
- Confirm the test/check passes in current code.
- If no evidence covers a criterion -> mark as gap.

### 3. Verify error cases

For each error case in `proposal.md`, confirm there is passing evidence for the failure path.

### 4. Regression check

Run the required regression command(s) from `docs/doc_verification_guide.md` and confirm no blocking failures.

### 5. Generate verification-report.md

````markdown
# Verification Report - [Feature name]

**Ticket**: [ticket-slug]
**Verification date**: [YYYY-MM-DD]
**Merged branch**: [branch-name]

## Acceptance criteria

| # | Criterion | Test/Check | Result |
|---|---|---|---|
| 1 | [criterion from proposal.md] | `[test/check reference]` | PASS |

## Error cases verified

| # | Error case | Test/Check | Result |
|---|---|---|---|
| 1 | [error case from proposal.md] | `[test/check reference]` | PASS |

## Regression status

**Result**: `[summary of regression command output]`

---

## Verdict

FEATURE VERIFIED / GAPS DETECTED

[If GAPS DETECTED: list criteria or checks missing/pending]
````

---

## Output

`openspec/changes/[ticket-slug]/verification-report.md` with verdict `FEATURE VERIFIED` or `GAPS DETECTED`.

---

## Rules

- Any acceptance criterion without passing evidence -> verdict must be `GAPS DETECTED`.
- Any blocking regression -> verdict must be `GAPS DETECTED`.
- Never proceed to `sdd-archive` if verdict is `GAPS DETECTED`.

<!-- END_SKILL -->

---

## Objetivo

Verificar que todos los criterios de aceptacion de la spec se cumplen en el estado actual del codigo, post-merge. Genera un reporte de verificacion final.

---

## Instrucciones

1. Lee `openspec/changes/[ticket-slug]/proposal.md`.
2. Lee `openspec/changes/[ticket-slug]/testing-report.md`.
3. Ejecuta los comandos de verificacion de feature/dominio definidos en `docs/doc_verification_guide.md`.
4. Para cada criterio de aceptacion: identifica evidencia passing; si no existe, marcar gap.
5. Verifica casos de error con evidencia passing.
6. Ejecuta regresion segun guia del proyecto.
7. Genera `openspec/changes/[ticket-slug]/verification-report.md`.

---

## Checklist

- [ ] `proposal.md` leido - criterios de aceptacion listados
- [ ] `testing-report.md` leido - evidencia inicial identificada
- [ ] Verificacion de feature/dominio ejecutada
- [ ] Cada criterio de aceptacion mapeado a evidencia
- [ ] Criterios sin evidencia marcados como gaps
- [ ] Regresion ejecutada segun guia del proyecto
- [ ] `verification-report.md` generado con veredicto
