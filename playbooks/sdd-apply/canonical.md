---
slug: sdd-apply
title_en: "SDD Apply — Implement the Spec"
title_es: "SDD Apply — Ejecutar el Contrato"
description: "Implement the active spec following TDD — write tests first, then code, run php artisan test, format with Pint, and generate testing-report.md. Activate when the user says \"sdd-apply\", \"implement spec\", \"execute tasks\", \"start coding from tasks.md\", or asks to implement the feature from the approved plan. Requires Copilot agent mode with terminal access."
description_es: "Ejecuta la spec activa sin improvisar. Implementa las tareas de tasks.md en orden, aplicando TDD, respetando el scope y bloqueando ante ambigüedades."
when_es: "Después de `/sdd-ff` y confirmación de tasks.md con `status: ready`."
output_file: "testing-report.md"
verdict_pass: ""
verdict_fail: ""
requires_terminal: true
---

## Purpose

Execute the approved `tasks.md` plan without improvising. Implement each task in order using TDD: write the test first, then the code that makes it pass.

> **Requires Copilot agent mode** — this skill runs terminal commands (`php artisan`, `pint`, `npm`).

Stop immediately if you encounter any ambiguity in the spec. Never guess outside scope.

---

## Context

Read completely before writing any code:

1. `openspec/changes/[ticket-slug]/proposal.md` — verify `status: pending`
2. `openspec/changes/[ticket-slug]/tasks.md` — verify `status: ready`
3. `openspec/changes/[ticket-slug]/design.md` — technical decisions (if it exists)
4. `openspec/specs/system.md` — layer rules and naming conventions
5. `openspec/specs/[affected-domain]/spec.md` — current module state
6. Sibling files in relevant directories — understand existing conventions before writing new code

---

## Behavior

### 1. Validate before starting

- Confirm `proposal.md` has `status: pending`. If not, stop.
- Confirm `tasks.md` has `status: ready`. If not, stop.

### 2. Activate relevant skills

Before writing code, activate the skills matching impacted layers:

| Layer | Skill to activate |
|---|---|
| PHP/Laravel backend | `laravel-best-practices` |
| React/Inertia pages | `inertia-react-development` |
| Auth/Fortify | `fortify-development` |
| OAuth/Socialite | `socialite-development` |
| Tailwind CSS | `tailwindcss-development` |
| Frontend routes | `wayfinder-development` |

### 3. Execute tasks in order

For each task in `tasks.md`:

1. **Write the test first** using `php artisan make:test --phpunit [TestName]`
2. **Write the code** that makes the test pass
3. **Verify scope** — confirm no files outside `## Constraints and non-goals` were touched
4. **Run the test**: `php artisan test --compact --filter=[test-name]`
5. **Mark task complete** with `[x]` in `tasks.md`

### 4. Closure (after all tasks complete)

```bash
vendor/bin/pint --dirty --format agent
php artisan wayfinder:generate    # only if routes changed
npm run types:check               # only if TypeScript changed
php artisan test --compact --filter=[feature]
```

### 5. Generate testing-report.md

```markdown
# Testing Report — [Feature name]

**Ticket**: [ticket-slug]
**Date**: [YYYY-MM-DD]

---

## Output

- Implemented code (all tasks in `tasks.md` marked `[x]`)
- `openspec/changes/[ticket-slug]/testing-report.md`

---

## Rules

- **STOP if you find ambiguity in the spec** → describe the problem → wait for instruction. Never guess.
- Never modify files outside the scope defined in `## Constraints and non-goals` of `proposal.md`.
- Never mark a task complete without its test passing.
- Use `#[Test]` attribute on all PHPUnit test methods — never the `test_` prefix.
- Use constructor property promotion in all new PHP classes.
- Use explicit return types and parameter types in all new PHP methods.

<!-- END_SKILL -->

---

## Objetivo

Ejecutar la spec activa sin improvisar. Implementar las tareas de `tasks.md` en orden, aplicando TDD, respetando el scope de la spec y bloqueando ante ambigüedades.

---

## Instrucciones

1. Lee completamente `openspec/changes/[ticket-slug]/proposal.md`. Verifica `status: pending`.
2. Lee `openspec/changes/[ticket-slug]/tasks.md`. Verifica `status: ready`.
3. Lee `openspec/changes/[ticket-slug]/design.md` para decisiones técnicas.
4. Lee `openspec/specs/system.md` y los specs del módulo afectado.
5. Lee los archivos de implementación existentes (sibling files) para entender convenciones actuales.
6. Activa los skills relevantes antes de escribir código (laravel-best-practices, inertia-react-development, etc.).
7. Ejecuta `search-docs` para documentación version-specific de los paquetes afectados.
8. Para cada tarea en orden: escribe el test primero → escribe el código → verifica scope → ejecuta el test → márcala `[x]`.
9. Al finalizar todas las tareas: Pint, wayfinder:generate (si aplica), types:check (si aplica), test suite.
10. Genera `openspec/changes/[ticket-slug]/testing-report.md`.

---

## Checklist

- [ ] `proposal.md` con `status: pending` leído completamente
- [ ] `tasks.md` con `status: ready` leído completamente
- [ ] Skills relevantes activados antes de escribir código
- [ ] `search-docs` ejecutado para paquetes afectados
- [ ] Cada tarea: test escrito primero, luego código
- [ ] Ningún archivo fuera del scope de "Restricciones y non-goals" modificado
- [ ] Todos los tests pasan antes de marcar tarea como `[x]`
- [ ] `vendor/bin/pint --dirty --format agent` ejecutado
- [ ] `php artisan wayfinder:generate` si hubo cambios de rutas
- [ ] `npm run types:check` si hubo cambios TypeScript
- [ ] `testing-report.md` generado con tabla de criterios

---

## Formato de reporte

`openspec/changes/[ticket-slug]/testing-report.md` con tabla de criterios de aceptación, tareas completadas, comandos ejecutados y veredicto final.

---

## Criterio de bloqueo

**Si encuentras ambigüedad en la spec → DETENTE → señala el problema → espera instrucción.**

NUNCA improvises fuera de la spec. NUNCA modifiques módulos no listados en "Restricciones y non-goals". NUNCA marques una tarea como `[x]` sin que su test pase.

---

## Qué NO reemplaza

- La revisión de código humana (el code review detecta problemas que los tests no cubren)
- Las decisiones de arquitectura (deben estar en `design.md` antes de ejecutar)
- El juicio sobre si la spec captura correctamente la necesidad de negocio
