---
status: implemented
owner: bernardo
last_updated: 2026-07-03
---

# CI — spec-lint Workflow Behavior

> **Inherited from specloom**, adapted for `playbook-ai`. In `playbook-ai` this workflow ships as `playbook-validation.yml` (runs `playbook validate --ci`); its live behavior is the authority and may differ from this inherited spec. `.specloom/` is the runtime dir. See `CREDITS` and `ADR-026`.

## Purpose

The `spec-lint` GitHub Actions workflow enforces SDD readiness on pull requests: any PR that touches `openspec/changes/**` must pass `loom validate` before merging. It exists in two copies that must stay structurally aligned:

- `.github/workflows/spec-lint.yml` — specloom's own repo (invokes `node framework/cli/loom.js validate`, installs with `cd framework && npm ci`, caches on `framework/package-lock.json`).
- `framework/templates/github/workflows/spec-lint.yml` — the template distributed to consumer projects (invokes `npx specloom validate`, installs with plain `npm ci`).

All validation logic lives in `framework/cli/lib.js` (`validateReadyForPR`, `isArchiveOnlyDiffAgainst`); the workflow never reimplements checks in bash.

## Trigger and path filtering

- The workflow triggers on **every** `pull_request`, with **no** `paths:` filter at the workflow level — a path-filtered required status check would stay pending forever on PRs outside those paths (see ADR-004).
- Path filtering happens inside the job: an early step with `id: sdd_paths` (right after checkout, before any expensive step) diffs the PR against its base (`git diff --name-only <base.sha>...HEAD`) and publishes `touched=true|false` to `$GITHUB_OUTPUT` depending on whether the diff matches `^openspec/changes/`.
- The diff runs in its own shell assignment, never piped directly into `grep`: under the runner's default `bash -e`, a git failure (e.g. unreachable base sha) fails the step. A required check must never pass green without having inspected the diff.
- The expensive steps (setup-node, dependency install, `loom validate`) are guarded with `if: steps.sdd_paths.outputs.touched == 'true'`. When the PR does not touch `openspec/changes/**`, the job ends in success immediately at near-zero CI cost.

## Validation flow (touched=true)

- Checkout uses `fetch-depth: 0` so the base commit is reachable for `--base` diffing.
- The workflow derives the ticket slug from the PR branch basename (`${BRANCH_NAME##*/}`) before calling `loom validate`. This preserves the CLI's path-traversal guard against slugs containing `/` while allowing branch prefixes such as `codex/<ticket-slug>`.
- `loom validate "<ticket-slug>" --base "<base.sha>"` runs the same check a human runs locally; `--base` lets it recognize `/sdd-archive` PRs (pure removals under `openspec/changes/**`) as valid.

## Security constraints

- The trigger is `pull_request`, never `pull_request_target` — the job runs PR-authored code and must stay in the unprivileged context (read-only `GITHUB_TOKEN`, no secrets).
- Path filtering uses runner-native `git diff`; no third-party action may be introduced for it. Only `actions/checkout` and `actions/setup-node` are allowed as external actions.
- PR branch names are passed through environment variables and reduced to their basename before validation; they must not be interpolated directly as ticket slugs.

## Validation

- Template structure is covered by `framework/cli/test/spec-lint-template.test.js`, including negative checks (no workflow-level `paths:`, no `pull_request_target`, no third-party filtering action, diff-in-assignment).
- The two copies are kept aligned manually; the only intended divergence besides invocation form is a consumer-facing TODO comment in the template's `sdd_paths` step.
