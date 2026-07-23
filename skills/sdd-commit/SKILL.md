---
name: sdd-commit
description: >-
  Commit the verified change, push, and open/update the GitHub Pull Request —
  after validating local preconditions and gates. Detects the base branch from
  config/GitHub (never hardcodes main/master), never marks CI passed on push,
  and never auto-merges. Activate when the user says 'sdd-commit' or when
  'playbook next' routes here. Requires agent mode with terminal + gh access.
description_es: >-
  Hacer commit del change verificado, push, y abrir/actualizar el Pull Request
  de GitHub — tras validar preconditions y gates locales. Detecta la base branch
  desde config/GitHub, nunca marca CI passed al pushear, y nunca hace
  auto-merge.
title_es: SDD Commit — Entregar el Change
version: 0.1.0
lifecycle_stage: commit
produces: []
requires:
  artifacts:
    runtime-gate-report.md:
      status:
        - passed
        - not_applicable
---
# SDD Commit — Ship the Change

**When to run:** After sdd-runtime-gate is passed or not_applicable. Before human PR review.

## Purpose

Deliver the change to GitHub: commit → push → open/update the Pull Request. The
methodological work is done; this is the **delivery** dimension. GitHub is the
only supported provider.

## Context

Use `playbook spec-read <file>#<anchor>` to read only the relevant section of a
spec (e.g. `proposal.md#impacted-repos`); if the anchor is absent, fall back to
full-read and report why.

## Behavior

1. Run `playbook validate` — stop on any violation.
2. Verify `security-report.md` and `runtime-gate-report.md` are
   `passed`/`not_applicable`.
3. **Multi-repo changes** (`## Impacted repos` in `proposal.md` is non-empty):
   run `playbook commit-plan <change-id>` (read-only) to get the per-repo PR
   payload — title, body, base, head, files, rollback note. It never invokes
   `gh` itself; use its output to open one PR per repo listed. Each sibling
   repo's branch must already exist (`playbook prepare-repos <change-id>`,
   normally run earlier, before implementation).
4. **Detect the base branch** for the SDD repo from `github.base_branch` in
   `playbook.config.yaml`, or from GitHub's default branch. **Never hardcode
   `main`/`master`.**
5. Create the commit (Conventional Commits; reference the change-id).
6. Push the branch — **only if the user authorized remote actions**. If GitHub
   context is unavailable (`playbook status` shows delivery `unknown`), stop and
   say so.
7. Create or update the Pull Request against the detected base branch (and, for
   multi-repo changes, one PR per repo per the commit-plan payload).
8. Return the delivery state (`playbook status`). Do **not** claim CI passed —
   CI runs on GitHub; `playbook next` will report `wait_for_github_ci` until
   checks report back.

## Rules

- Never hardcode the base branch; read it from config or GitHub.
- Do not create a PR unless remote actions are authorized.
- Do not mark `ci_passed` immediately after push — that is GitHub's to report.
- **Never merge automatically** — merge is a human action after CI passes.
- After merge, `playbook next` routes to `sdd-verify`.

## Preconditions (self-check)

1. Local lifecycle preconditions met (proposal approved, gates cleared).
2. `playbook validate` passes.
3. Security and runtime gates are `passed` or legitimately `not_applicable`.

If any fail, stop and report. Do not commit around a blocking finding.

---

**Output file:** N/A — commits, pushes, and opens/updates a GitHub PR
**Requires terminal:** yes
