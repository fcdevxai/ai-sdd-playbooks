---
lang: en
slug: sdd-apply
title_en: "SDD Apply - Implement the Spec"
title_es: "SDD Apply - Ejecutar el Contrato"
description: "Implement the active spec following TDD: write tests first, then code, run project test commands, run project quality checks, and generate testing-report.md. Activate when the user says \"sdd-apply\", \"implement spec\", \"execute tasks\", \"start coding from tasks.md\", or asks to implement the feature from the approved plan. Requires agent mode with terminal access."
description_es: "Ejecuta la spec activa sin improvisar. Implementa tasks.md en orden, aplicando TDD, respetando el scope y bloqueando ante ambiguedades."
when: "Despues de `/sdd-ff` y confirmacion de tasks.md con `status: ready`."
output_file: "testing-report.md"
verdict_pass: ""
verdict_fail: ""
requires_terminal: true
---

## Purpose

Execute the approved `tasks.md` plan without improvising. Implement each task in order using TDD: write the test first, then the code that makes it pass.

> Requires agent mode with terminal access. This skill runs project-specific terminal commands.

Stop immediately if you encounter ambiguity in the spec. Never guess outside scope.

---

## Context

Read completely before writing code:

1. `openspec/changes/[ticket-slug]/proposal.md` - verify `status: pending`
2. `openspec/changes/[ticket-slug]/tasks.md` - verify `status: ready`
3. `openspec/changes/[ticket-slug]/design.md` - technical decisions (if it exists)
4. `openspec/specs/system.md` - architecture and naming conventions
5. `openspec/specs/[affected-domain]/spec.md` - current module state
6. `docs/agent_architecture.md` and `docs/doc_verification_guide.md` - project-specific workflow and commands
7. Existing implementation files in impacted modules

---

## Behavior

### 1. Validate before starting

- Confirm `proposal.md` has `status: pending`. If not, stop.
- Confirm `tasks.md` has `status: ready`. If not, stop.

### 2. Activate relevant skills/guides

Before writing code, activate or consult resources matching impacted layers and tools. Use project-provided docs/skills instead of assuming framework-specific conventions.

### 3. Execute tasks in order

For each task in `tasks.md`:

1. Write the test first (or failing validation check first)
2. Write the code that makes the test/check pass
3. Verify scope - confirm no files outside `## Constraints and non-goals` were touched
4. Run task-level verification command(s) from `docs/doc_verification_guide.md`
5. Mark task complete with `[x]` in `tasks.md`

### 4. Closure (after all tasks complete)

Run project-level quality gates from `docs/doc_verification_guide.md`, typically:

```bash
[project format command]
[project lint/type-check command(s)]
[feature/domain test command]
[full regression test command if required by risk]
```

### 5. Generate testing-report.md

````markdown
# Testing Report - [Feature name]

**Ticket**: [ticket-slug]
**Date**: [YYYY-MM-DD]

## Verified acceptance criteria

| # | Criterion | Test/Check | Status |
|---|---|---|---|
| 1 | [criterion from proposal.md] | `[test file or command]` | PASS |

## Completed tasks

- [x] Task 1.1 - [name]
- [x] Task 1.2 - [name]

## Commands run

```bash
[command 1]
[command 2]
[command 3]
```

## Final result

PASS - all acceptance criteria have passing tests/checks.
Ready for `sdd-code-review [ticket-slug]`.
````

---

## Output

- Implemented code (all tasks in `tasks.md` marked `[x]`)
- `openspec/changes/[ticket-slug]/testing-report.md`

---

## Rules

- STOP if you find ambiguity in the spec -> describe the problem -> wait for instruction. Never guess.
- Never modify files outside the scope defined in `## Constraints and non-goals` of `proposal.md`.
- Never mark a task complete without its verification passing.
- Follow coding/testing conventions defined in `openspec/specs/system.md` and project docs.

