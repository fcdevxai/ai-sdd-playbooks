---
name: sdd-apply
description: >-
  Implement the approved tasks.md following TDD: write tests first, then code,
  run the project's test and quality commands, mark tasks complete, and append
  an Execution Report. Activate when the user says 'sdd-apply', 'implement
  spec', or 'execute tasks'. Requires agent mode with terminal access. Triggers:
  aplica el plan, implementa la spec, ejecuta tasks.md.
description_es: >-
  Implementar un tasks.md aprobado siguiendo TDD: escribir tests primero, luego
  el código, correr los comandos de verificación del proyecto, marcar tareas
  completas y anexar un reporte de ejecución. Requiere modo agente con acceso a
  terminal.
title_es: SDD Apply — Ejecutar el Contrato
version: 0.1.0
lifecycle_stage: apply
produces: []
requires:
  artifacts:
    proposal.md:
      status: approved
    design.md:
      status:
        - approved
        - not_applicable
      when: design_required
    tasks.md:
      status: ready
---
# SDD Apply — Implement the Spec

**When to run:** After tasks.md has status: ready. Before sdd-code-review.

## Purpose

Execute the approved `tasks.md` plan without improvising, using TDD: test first,
then the code that makes it pass. Stop immediately on any spec ambiguity — never
guess outside scope.

> Requires agent mode with terminal access (runs project-specific commands).

## Context

Read fully before writing code: `proposal.md`, `tasks.md`, `design.md` (if
present), `openspec/specs/system.md`, the affected domain spec, the project's
`docs/doc_architecture.md` / `docs/doc_verification_guide.md`,
`docs/agent_architecture.md` for how agents operate in this repo,
`docs/security-checklist.md` for known sensitive surfaces, and
`playbook.config.yaml` (for `contract.path_in_loom` and the `provided_by`/
`consumed_by` roles), when this change touches the API.

## Behavior

1. Set `tasks.md` `status: in_progress`.
2. **Contract-first implementation (conditional).** When
   `playbook.config.yaml` declares `contract.path_in_loom` and this repo's
   role is relevant (named in `contract.provided_by` or
   `contract.consumed_by`), read the contract by path from the hub before
   implementing any API task — it is never copied, only read where it lives.
   The resolved path must stay **inside the repo** — if it escapes the
   project root, stop and report it instead of reading. The obligation
   differs by role:
   - **Provider** (`contract.provided_by` names this repo): the contract is
     the spec the implementation must fulfill — implement exactly the
     endpoints, request/response shapes, and status codes it declares.
   - **Consumer** (`contract.consumed_by` names this repo): the contract is
     the spec of what is available to call — implement against the endpoints
     it declares, including the error codes the implementation must handle.

   Declaring `contract.provided_by` does not install `contract-drift` in this
   repo's CI by itself — that stays a manual template step. Conformance is
   verified by the provider's CI if it is installed, never by this skill.
3. For each task in order:
   a. Write the test (or failing check) first — **if the task implements a
      `## Security considerations` entry (`SEC-N`) from `proposal.md`, the
      first test must be the negative case** (e.g. unauthorized access is
      rejected), not just the happy path.
   b. Write the code that makes the test/check pass.
   c. Verify scope — confirm no file outside `## Constraints and non-goals` was touched.
   d. Before running the verification command, check `pwd` — never assume the
      cwd inherited from a previous task or step.
   e. Run the task-level verification command from `docs/doc_verification_guide.md`
      through `playbook run --change <change-id> --step apply -- <command>` —
      it prints a compacted summary (one line on success; exit code + last 40
      lines on failure) while the full output always lands at
      `.specloom/runs/<run-id>/full.log`, so a failure's raw output never
      floods context unless you need it.
   f. Mark the task `[x]` in `tasks.md`.

   The test-fails→fix→re-test loop for a single task is capped at 2 retries (3
   attempts total). If the 3rd attempt is still red, stop: report the task's
   current state and do not mark it `[x]`. This never overrides the rule above —
   a task tied to a security consideration stays unmarked regardless of retry
   count until its negative test passes.
4. **ADR trigger while resolving a STOP.** If a STOP during implementation is
   resolved with a decision that is hard to reverse or architecturally
   significant (auth, module structure, contracts, a significant library,
   persistence, deployment, or a cross-cutting convention), record it as
   `openspec/changes/<change-id>/adr-<decision-slug>.md` (`status: proposed`,
   same template as `sdd-new`) before continuing — a chat resolution evaporates;
   the ADR survives the archive.
5. Closure: run the project quality gates (format, lint/type-check, feature tests,
   regression if risk warrants) from `docs/doc_verification_guide.md`, each
   through `playbook run --change <change-id> --step apply -- <command>`.
6. Append an **Execution Report** to `tasks.md` (verified ACs → test/evidence,
   commands run, result). When every task passes and gates are green, set
   `tasks.md` `status: passed`. If blocked, set `status: blocked` and record why.

## Output

- Implemented code (all tasks `[x]`).
- `tasks.md` updated: checkboxes, Execution Report, and `status: passed` (or `blocked`).
- Any `adr-<decision-slug>.md` draft created while resolving a hard-to-reverse STOP.

## Rules

- STOP on spec ambiguity → describe the problem → wait. Never guess.
- Never modify files outside `## Constraints and non-goals` of `proposal.md`.
- Never implement a task tied to a security consideration without its negative
  test passing — a happy-path test alone is not sufficient evidence.
- Never mark a task complete without its verification passing.
- The TDD loop per task is capped at 2 retries (3 attempts total); a security-tied
  task with a failing negative test is never marked complete, cap reached or not.
- Before running any command from `tasks.md`, verify `pwd` first.
- Follow conventions in `openspec/specs/system.md` and project docs.

## Preconditions (self-check)

Before starting, confirm — or run `playbook validate --precondition sdd-apply`:
`proposal.status == approved`, `tasks.status == ready`, and, **only when design
is required**, `design.status ∈ {approved, not_applicable}`. If unmet, stop and
name the missing precondition.

---

**Output file:** N/A — updates tasks.md in place (checkboxes + Execution Report + status)
**Requires terminal:** yes
