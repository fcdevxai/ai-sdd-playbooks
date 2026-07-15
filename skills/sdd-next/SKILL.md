---
name: sdd-next
description: "Ask the SDD CLI what the next valid step is for the current change and act on it. Use when the user says 'sdd-next', 'what's next', or wants to know which SDD skill to run now."
lifecycle_stage: null
produces: []
requires: {}
version: 2.0.0
---

## Purpose

Tell the user (and yourself) the single next valid action for the current SDD
change. The **CLI is the authority** — not you. Do not infer the lifecycle
state from the files yourself.

## Behavior

1. Run the CLI and read its answer:

   ```bash
   sdd next --json
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

3. Never re-derive the state or "guess" the next step. If `sdd next` disagrees
   with your expectation, trust `sdd next`.

## Rules

- Do not call other SDD skills without first consulting `sdd next`.
- Do not fabricate delivery state; report exactly what the CLI returns.
- Read-only: this skill decides nothing and writes nothing itself.
