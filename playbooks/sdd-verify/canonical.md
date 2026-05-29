---
slug: sdd-verify
title_en: "SDD Verify — Post-Merge Acceptance Verification"
title_es: "SDD Verify — Verificar Criterios de Aceptación post-PR"
description: "Verify that all acceptance criteria in the spec have passing tests after the PR is merged. Run the feature test suite, map each criterion to its test, check for regressions, and generate verification-report.md. Activate when the user says \"sdd-verify\", \"verify acceptance criteria\", \"post-merge verification\", or asks to verify a merged feature before archiving. Requires Copilot agent mode with terminal access."
description_es: "Verifica que todos los criterios de aceptación de la spec se cumplen en el estado actual del código, post-merge. Genera verification-report.md."
when_es: "Después de que el PR fue aprobado y mergeado en main. Antes de `/sdd-archive`."
output_file: "verification-report.md"
verdict_pass: "✅ FEATURE VERIFIED"
verdict_fail: "❌ GAPS DETECTED"
requires_terminal: true
---

## Purpose

Verify all acceptance criteria have passing tests in the merged state. Map each criterion to its test, run the full test suite, and confirm no regressions were introduced.

> **Requires Copilot agent mode** — this skill runs `php artisan test`.

Do not archive without a `✅ FEATURE VERIFIED` verdict.

---

## Context

Read before verifying:

1. `openspec/changes/[ticket-slug]/proposal.md` — full list of acceptance criteria
2. `openspec/changes/[ticket-slug]/testing-report.md` — tests from the `/apply` cycle
3. The current state of the merged codebase

---

## Behavior

### 1. Read the acceptance criteria

List all criteria from `proposal.md` §Acceptance criteria and §Error cases.

### 2. Map criteria to tests

For each criterion:
- Identify the test file and method that covers it
- If no test covers a criterion, flag it as a gap

### 3. Run the feature test suite

```bash
php artisan test --compact tests/Feature/[Domain]/
```

Confirm all mapped tests pass.

### 4. Check for regressions

```bash
php artisan test --compact
```

Confirm the full suite passes. Report any new failures not present before this feature.

### 5. Generate verification-report.md

```markdown
# Verification Report — [Feature name]

**Ticket**: [ticket-slug]
**Verification date**: [YYYY-MM-DD]
**Merged branch**: [branch]

## Acceptance criteria

| # | Criterion | Test | Result |
|---|---|---|---|
| 1 | [criterion from proposal.md] | `tests/Feature/.../Test::method` | ✅ PASS |

## Error cases verified

| # | Error case | Test | Result |
|---|---|---|---|
| 1 | [error case from proposal.md] | `tests/Feature/.../Test::method` | ✅ PASS |

## Full suite

Result: [X tests, 0 failures, 0 errors]

## Verdict

✅ FEATURE VERIFIED — all acceptance criteria have passing tests.
Proceed with `sdd-archive [ticket-slug]`.

---

❌ GAPS DETECTED — the following criteria have no test coverage:
- Criterion #N: [description]
Resolve before proceeding with `sdd-archive`.
```

---

## Output

`openspec/changes/[ticket-slug]/verification-report.md` with verdict `✅ FEATURE VERIFIED` or `❌ GAPS DETECTED`.

---

## Rules

- Always run the full test suite — do not skip the regression check.
- A criterion with a failing or missing test must produce verdict `❌ GAPS DETECTED`.
- Do not archive without `✅ FEATURE VERIFIED`.

---

## Objetivo

Verificar que todos los criterios de aceptación de la spec se cumplen en el estado actual del código, post-merge del PR. Genera un reporte de verificación final.

---

## Instrucciones

1. Lee `openspec/changes/[ticket-slug]/proposal.md` — lista completa de criterios de aceptación.
2. Lee `openspec/changes/[ticket-slug]/testing-report.md` para los tests del ciclo `/sdd-apply`.
3. Ejecuta los tests de la feature: `php artisan test --compact tests/Feature/[Domain]/`
4. Para cada criterio de aceptación:
   - Identifica el test que lo cubre
   - Confirma que el test pasa en el estado actual del código
   - Si no tiene test → señalar como gap
5. Verifica que no hay regresiones: `php artisan test --compact`
6. Genera `openspec/changes/[ticket-slug]/verification-report.md`

---

## Checklist

- [ ] `proposal.md` leído — todos los criterios de aceptación listados
- [ ] `testing-report.md` leído — tests del ciclo apply identificados
- [ ] Tests de la feature ejecutados y pasan
- [ ] Cada criterio de aceptación mapeado a un test
- [ ] Criterios sin test marcados como gaps
- [ ] Suite completa ejecutada — sin regresiones
- [ ] `verification-report.md` generado con veredicto

---

## Formato de reporte

`openspec/changes/[ticket-slug]/verification-report.md` con tabla de criterios vs tests, resultado de suite completa y veredicto final.

---

## Criterio de bloqueo

El veredicto debe ser `❌ GAPS DETECTADOS` si algún criterio de aceptación no tiene test que pase. No proceder con `/sdd-archive` sin veredicto `✅ FEATURE VERIFICADA`.

---

## Qué NO reemplaza

- La aprobación del PR por el revisor humano
- El análisis de si los criterios de aceptación capturan correctamente la necesidad de negocio
- La validación UX/UI (cubierta por `/sdd-ux-gate`)
