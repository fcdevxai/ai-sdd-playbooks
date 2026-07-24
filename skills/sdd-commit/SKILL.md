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

If `context-packet.md` exists, read it instead of `proposal.md`+`tasks.md` in
full — it carries acceptance criteria, constraints, security considerations,
files touched, and verification commands copied verbatim from those sources.
If it doesn't exist, fall back to reading both in full (no error, no warning).
If its content visibly contradicts the live `proposal.md`/`tasks.md`, prefer
the full sources and note the discrepancy. Impacted repos, acceptance
criteria, and other change-artifact content come from the packet (or the full
`proposal.md`/`tasks.md`), never from `spec-read` — that command is confined to
`openspec/specs/**`.

Use `playbook spec-read <file>#<anchor>` to read only the relevant section of a
permanent spec (e.g. `openspec/specs/system.md#code-conventions`); if the
anchor is absent, fall back to full-read and report why. If you need a
permanent-spec anchor you don't know and `.specloom/index/spec-index.json`
doesn't exist, run `playbook spec-index` to build it, then `playbook spec-read
openspec/specs/<file>#<anchor>`. If `spec-index` or the lookup fails, full-read
the spec and report why.

## Behavior

1. Run `playbook validate` — it is the same check CI runs on the PR, so a failure
   here means the PR would be rejected anyway. If it reports issues, fix only what
   is safely fixable and re-run it — **don't reason about the reports
   yourself**. **Only a derived artifact may be fixed:** regenerate a stale
   `context-packet.md` with `playbook packet <change-id>`. **Never edit
   `proposal.md`, `design.md`, `tasks.md`, an `adr-*.md` draft, or a gate report
   (`code-review-report.md`, `security-report.md`, `runtime-gate-report.md`) to
   make `validate` pass** — the first two carry a human `status: approved`, the
   reports carry a gate's verdict, and an ADR draft is the record of *why* a
   decision was taken, waiting for a human to accept or reject it: a `status:
   proposed` draft is unreviewed, not unprotected. None of them is this stage's to
   rewrite. Anything not named regenerable counts as signed. When editing a signed artifact is the
   only way past the failure, **stop and report which artifact and which issue,
   without consuming an iteration**. This fix→re-run loop is capped at **3
   iterations**; at the 4th failed attempt, stop and report the pending issues
   exactly as `playbook validate` returns them, **without further blind edits**.
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
- The fix→`playbook validate`→re-run loop is capped at 3 iterations; at the 4th
  failed attempt, stop and report what `playbook validate` returns — never keep
  iterating past the cap, and never make blind edits.
- Never make `validate` pass by weakening a gate report's `status`, least of all
  `security-report.md`. A retry budget never overrides a security rule — the same
  precedence `sdd-apply`'s TDD cap has over its security condition, and the reason
  for "Do not commit around a blocking finding" above.

## Preconditions (self-check)

1. Local lifecycle preconditions met (proposal approved, gates cleared).
2. `playbook validate` passes — or its only remaining failure is a derived
   artifact this stage may regenerate, which step 1 handles under its capped loop.
3. Security and runtime gates are `passed` or legitimately `not_applicable`.

If any fail, stop and report. Do not commit around a blocking finding.

---

**Output file:** N/A — commits, pushes, and opens/updates a GitHub PR
**Requires terminal:** yes
