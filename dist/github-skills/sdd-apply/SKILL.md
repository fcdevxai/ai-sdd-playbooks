---
name: sdd-apply
description: Implement the active spec following TDD — write tests first, then code, run php artisan test, format with Pint, and generate testing-report.md. Activate when the user says "sdd-apply", "implement spec", "execute tasks", "start coding from tasks.md", or asks to implement the feature from the approved plan. Requires Copilot agent mode with terminal access.
---

# SDD Apply — Implement the Spec

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

````markdown
# Testing Report — [Feature name]

**Ticket**: [ticket-slug]
**Date**: [YYYY-MM-DD]

## Verified acceptance criteria

| # | Criterion | Test | Status |
|---|---|---|---|
| 1 | [criterion from proposal.md] | `tests/Feature/.../TestName::method` | ✅ |

## Completed tasks

- [x] Task 1.1 — [name]
- [x] Task 1.2 — [name]

## Commands run

```bash
php artisan test --compact --filter=[feature]
vendor/bin/pint --dirty --format agent
npm run types:check
```

## Final result

✅ All acceptance criteria have passing tests.
Ready for `sdd-code-review [ticket-slug]`.
````

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
