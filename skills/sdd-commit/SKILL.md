---
name: sdd-commit
description: "Commit the verified change, push, and open/update the GitHub Pull Request — after validating local preconditions and gates. Detects the base branch from config/GitHub (never hardcodes main/master), never marks CI passed on push, and never auto-merges. Activate when the user says 'sdd-commit' or when 'sdd next' routes here. Requires agent mode with terminal + gh access."
lifecycle_stage: commit
produces: []
requires:
  artifacts:
    runtime-gate-report.md: { status: [passed, not_applicable] }
version: 2.0.0
---

## Purpose

Deliver the change to GitHub: commit → push → open/update the Pull Request. The
methodological work is done; this is the **delivery** dimension. GitHub is the
only supported provider.

## Preconditions (self-check)

1. Local lifecycle preconditions met (proposal approved, gates cleared).
2. `sdd validate` passes.
3. Security and runtime gates are `passed` or legitimately `not_applicable`.

If any fail, stop and report. Do not commit around a blocking finding.

## Behavior (design §9.2, C-11)

1. Run `sdd validate` — stop on any violation.
2. Verify `security-report.md` and `runtime-gate-report.md` are
   `passed`/`not_applicable`.
3. **Detect the base branch** from `github.base_branch` in `sdd.config.yaml`, or
   from GitHub's default branch. **Never hardcode `main`/`master`.**
4. Create the commit (Conventional Commits; reference the change-id).
5. Push the branch — **only if the user authorized remote actions**. If GitHub
   context is unavailable (`sdd status` shows delivery `unknown`), stop and say so.
6. Create or update the Pull Request against the detected base branch.
7. Return the delivery state (`sdd status`). Do **not** claim CI passed — CI runs
   on GitHub; `sdd next` will report `wait_for_github_ci` until checks report back.

## Rules

- Never hardcode the base branch; read it from config or GitHub.
- Do not create a PR unless remote actions are authorized.
- Do not mark `ci_passed` immediately after push — that is GitHub's to report.
- **Never merge automatically** in 2.0; merge is a human action after CI passes.
- After merge, `sdd next` routes to `sdd-verify`.
