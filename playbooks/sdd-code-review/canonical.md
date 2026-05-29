---
slug: sdd-code-review
title_en: "SDD Code Review — Automated Pre-PR Review"
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

Review implemented code against the approved spec. Validate spec coverage, scope compliance, Laravel/React conventions, and generate `code-review-report.md` with a clear verdict.

This is an automated first-pass review that catches spec violations, convention errors, and scope drift before a human reviewer sees the code.

---

## Context

Read before reviewing:

1. `openspec/changes/[ticket-slug]/proposal.md` — acceptance criteria are the only success criteria
2. `openspec/changes/[ticket-slug]/testing-report.md` — understand which tests were generated
3. `openspec/changes/[ticket-slug]/tasks.md` — which files were created or modified
4. `openspec/specs/system.md` — naming conventions and layer rules
5. All implementation files listed in `tasks.md`

---

## Behavior

### 1. Read everything first

Read all files in context before starting the checklist. Never review partially.

### 2. Validate spec coverage

For each acceptance criterion in `proposal.md`:
- Identify which test covers it
- Verify the test actually exercises the stated behavior
- Flag any criterion without a corresponding test

For each error case in `proposal.md`:
- Verify there is explicit handling in the implementation
- Verify there is a test for the error case

### 3. Validate scope compliance

- List all files modified in the implementation
- Cross-reference with `## Constraints and non-goals` in `proposal.md`
- Flag any file touched that is outside the declared scope

### 4. Validate conventions

Check every new or modified PHP file:
- No business logic in controllers (controllers only handle HTTP transport)
- No inline query building in controllers (use Eloquent in models or services)
- Form Requests used for all validation
- Policies used for authorization
- Constructor property promotion in all new classes
- Explicit return types and parameter types on all new methods
- `#[Test]` attribute on all test methods (never `test_` prefix)
- No hardcoded URLs in TypeScript (Wayfinder used)

### 5. Produce verdict

**READY FOR PR** — all checklist items pass, no open issues.
**REQUIRES FIXES** — one or more items fail; list each issue with file, line, problem, and suggested fix.

### 6. Generate code-review-report.md

```markdown
# Code Review Report — [Feature name]

**Ticket**: [ticket-slug]
**Date**: [YYYY-MM-DD]
**Spec**: openspec/changes/[ticket-slug]/proposal.md

---

## Output

`openspec/changes/[ticket-slug]/code-review-report.md` with verdict `READY FOR PR` or `REQUIRES FIXES`.

---

## Rules

- Never issue `READY FOR PR` if any acceptance criterion lacks a test.
- Never issue `READY FOR PR` if any file outside scope was modified without justification.
- Read all implementation files completely before issuing a verdict — never review from memory.
- Report issues with file and line number, not vague descriptions.

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
