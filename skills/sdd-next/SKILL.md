---
name: sdd-next
description: >-
  Ask the SDD CLI what the next valid step is for the current change and act on
  it. Use when the user says 'sdd-next', 'what's next', or wants to know which
  SDD skill to run now.
description_es: >-
  Preguntarle al CLI de SDD cuál es el próximo paso válido para el change actual
  y actuar en consecuencia.
title_es: SDD Next — Preguntar el Próximo Paso
version: 0.1.0
lifecycle_stage: null
produces: []
requires: {}
---
# SDD Next — Ask the CLI What's Next

**When to run:** Any time the user asks what to do next, or between skill invocations.

## Purpose

Tell the user (and yourself) the single next valid action for the current SDD
change. The **CLI is the authority** — not you. Do not infer the lifecycle
state from the files yourself.

## Behavior

1. Run the CLI and read its answer:

   ```bash
   playbook next --json
   ```

   It returns `{ change, next, lifecycle, delivery }`. `next.action` is one of:
   `run_skill` (with `next.skill`), `await_human`, `wait_for_github_ci`,
   `merge`, `remediate` (with `next.skill`), `blocked` (with `next.reason`),
   or `done`.

2. Act on `next.action`:
   - **run_skill / remediate** → invoke the named skill (e.g. `sdd-apply`).
   - **await_human** → tell the user what human action is needed (e.g. approve
     the proposal by setting `status: approved`).
   - **wait_for_github_ci** → tell the user CI is running; do not proceed.
   - **merge** → tell the user CI passed and a human merge is required.
   - **blocked** → report `next.reason` (e.g. `GITHUB_CONTEXT_UNAVAILABLE`,
     `GITHUB_CI_FAILED`) and stop.
   - **done** → the change is archived; nothing to do.

3. Never re-derive the state or "guess" the next step. If `playbook next`
   disagrees with your expectation, trust `playbook next`.

## Rules

- Do not call other SDD skills without first consulting `playbook next`.
- Do not fabricate delivery state; report exactly what the CLI returns.
- Read-only: this skill decides nothing and writes nothing itself.

---

**Output file:** N/A — read-only
**Requires terminal:** yes
