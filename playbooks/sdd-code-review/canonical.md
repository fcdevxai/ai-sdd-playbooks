---
slug: sdd-code-review
title_en: "SDD Code Review — Spec Compliance Review"
title_es: "SDD Code Review — Revisión Automática Pre-PR"
description: "Review implemented code against the spec before opening a PR. Validate spec coverage, scope compliance, Laravel/React conventions, and generate code-review-report.md with a READY FOR PR or REQUIRES FIXES verdict. Activate when the user says \"sdd-code-review\", \"review against spec\", \"pre-PR review\", or asks to validate the implementation against the proposal."
description_es: "Revisa el código implementado contra la spec, detecta inconsistencias y genera un code-review-report.md con veredicto final antes de abrir PR."
when_es: "Después de `/sdd-apply` y antes de `/sdd-commit`. Cuando `testing-report.md` está generado."
output_file: "code-review-report.md"
verdict_pass: "READY FOR PR"
verdict_fail: "REQUIRES FIXES"
requires_terminal: false
---

## Purpose

Review implemented code against `proposal.md` before it reaches human review. Catch spec violations, scope creep, missing error handling, and convention issues early. Generate a `code-review-report.md` with a binary verdict.

This review validates *that the code implements what was agreed*. It does not validate *whether the agreed criteria were correct* — that is the human reviewer's job.

---

## Context

Read before reviewing:

1. `openspec/changes/[ticket-slug]/proposal.md` — acceptance criteria and constraints (the only success criteria)
2. `openspec/changes/[ticket-slug]/testing-report.md` — which tests were generated
3. `openspec/changes/[ticket-slug]/tasks.md` — which files were created or modified
4. `openspec/specs/system.md` — naming conventions and architecture rules
5. All files listed as created/modified in `tasks.md`

---

## Behavior

### 1. Run the checklist

**Spec coverage**
- [ ] Every acceptance criterion in `proposal.md` has at least one test covering it
- [ ] Every error case in `proposal.md` has explicit handling in the code
- [ ] `testing-report.md` maps all acceptance criteria to their tests

**Scope**
- [ ] No files modified outside modules allowed by `## Constraints and non-goals`
- [ ] No features added that are not in the spec (no over-engineering)
- [ ] No hardcoded URLs in TypeScript — Wayfinder functions used everywhere

**Laravel conventions**
- [ ] Form Requests used for all validation (not inline validation in controllers)
- [ ] Policies used for authorization (not manual guard checks in controllers)
- [ ] No business logic in controllers
- [ ] No orchestration logic in Eloquent models
- [ ] Constructor property promotion in all new PHP classes
- [ ] Explicit return types and parameter types in all new PHP methods
- [ ] `#[Test]` attribute on all test methods (not `test_` prefix)
- [ ] Factories created for every new Eloquent model
- [ ] `vendor/bin/pint --dirty` passes with no remaining diff

**Frontend conventions**
- [ ] `npm run types:check` passes (if TypeScript was changed)
- [ ] Component and prop naming follows `openspec/specs/system.md`

### 2. Generate report

````markdown
# Code Review Report — [Feature name]

**Ticket**: [ticket-slug]
**Date**: [YYYY-MM-DD]
**Spec**: openspec/changes/[ticket-slug]/proposal.md

## Checklist

### Spec coverage
- [✅/❌] Criterion #1 covered by `TestName::method`
- [✅/❌] Error case X handled in `ControllerName@method`

### Scope
- [✅/❌] No changes outside allowed modules

### Conventions
- [✅/❌] Form Requests used for all validation
...

## Issues found

### Issue 1 — [Title]
- **File**: `app/Http/Controllers/NameController.php:42`
- **Problem**: [what is wrong and why it violates the spec or conventions]
- **Suggested fix**: [how to correct it]

## Verdict

**READY FOR PR** / **REQUIRES FIXES**

[If REQUIRES FIXES: numbered list of issues that must be resolved before opening a PR]
````

---

## Output

`openspec/changes/[ticket-slug]/code-review-report.md` with verdict `READY FOR PR` or `REQUIRES FIXES`.

---

## Rules

- Any acceptance criterion without a covering test → verdict must be `REQUIRES FIXES`.
- Any file modified outside `## Constraints and non-goals` → verdict must be `REQUIRES FIXES`.
- Pint diff present → verdict must be `REQUIRES FIXES`.
- `READY FOR PR` means the spec is correctly implemented, not that the spec itself was correct.
- Do not suggest features or improvements outside the spec scope.

<!-- END_SKILL -->

---

## Objetivo

Hacer una primera revisión del código generado contra la spec, detectar inconsistencias y resolverlas antes de que llegue al revisor humano. Genera un `code-review-report.md` con veredicto final.

---

## Instrucciones

1. Lee `openspec/changes/[ticket-slug]/proposal.md` — los criterios de aceptación son los únicos criterios de éxito.
2. Lee `openspec/changes/[ticket-slug]/testing-report.md` para entender qué tests se generaron.
3. Lee el código implementado (archivos modificados según `tasks.md`).
4. Valida cada punto del checklist a continuación.
5. Guarda el reporte en `openspec/changes/[ticket-slug]/code-review-report.md`.

---

## Checklist

### Cobertura de spec
- [ ] Cada criterio de aceptación de `proposal.md` tiene al menos un test que lo cubre
- [ ] Cada caso de error de `proposal.md` tiene manejo explícito en el código
- [ ] El `testing-report.md` refleja todos los criterios de aceptación

### Scope
- [ ] El código no modifica módulos marcados como non-goals en `proposal.md`
- [ ] No se agregaron features no mencionadas en la spec (over-engineering)
- [ ] No hay hardcoded URLs en TypeScript (se usa Wayfinder)

### Convenciones
- [ ] Nombres de clases, métodos y variables siguen las convenciones de `openspec/specs/system.md`
- [ ] Form Requests usados para toda validación (no validación en controllers)
- [ ] Policies usadas para autorización (no guards en controllers)
- [ ] Constructor property promotion en todas las clases PHP nuevas
- [ ] Tipos explícitos en todos los métodos PHP nuevos
- [ ] Atributo `#[Test]` en todos los métodos de test (no prefijo `test_`)

### Calidad
- [ ] No hay business logic en controllers
- [ ] No hay lógica de orquestación en modelos
- [ ] Factories creadas para cada nuevo modelo
- [ ] `vendor/bin/pint --dirty --format agent` ejecutado (sin diff pendiente)
- [ ] `npm run types:check` pasa (si hay TypeScript)

---

## Formato de reporte

`openspec/changes/[ticket-slug]/code-review-report.md` con tabla de cobertura de spec, checklist de convenciones, lista de issues con archivo/línea/problema/corrección, y veredicto final.

---

## Criterio de bloqueo

El veredicto `REQUIERE CORRECCIONES` bloquea el avance a `/sdd-commit`. No abrir PR hasta resolver todos los issues.

---

## Qué NO puede validar el agente (requiere revisión humana)

- Si el criterio de aceptación captura correctamente la necesidad de negocio
- Si la restricción técnica era la correcta en primer lugar
- Si la arquitectura elegida es la más adecuada a largo plazo
- Si existen casos de error que la spec no contemplaba pero deberían estar
