---
schema: tasks
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Legacy removal implementation plan"
status: draft
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
depends_on: proposal.md
---

# SDD 3.0 — Legacy removal plan

**Spec**: `openspec/changes/sdd-3.0-legacy-removal/proposal.md`

> **Execution gate.** All artifacts are `draft`. No phase starts until
> `proposal.md` → `approved` (and, since `design_required` is true, `design.md`
> → `approved`). This document is the work plan for review; implementation does
> not begin yet.

Each phase is **independently reviewable and mergeable** and leaves the 2.0
functionality fully green. Delivered one phase per commit, matching the 2.0
rhythm. Task ids are `T<phase>.<index>`.

---

## Phase 0 — Audit & guardrails (no deletion yet)
*Goal: prove nothing in 2.0 depends on legacy before removing it.* — de-risks **AC-04**

- [ ] **T0.1** Grep the 2.0 sources (`src/`, `bin/`, `skills/`, `schemas/`, `templates/project/`, `test/`) for any import/reference to `scripts/sync`, `playbooks/`, `dist/`, `legacy/`, or the pre-2.0 `templates/*` paths. Record the reference list.
  - *Success*: the only references are the ones this change will delete (migrate/sync-legacy/tests/docs); no core 2.0 module imports legacy.
- [ ] **T0.2** Capture a baseline: current test count green, `npm pack --dry-run` file list, `sdd --help` (8 commands). This is the before-snapshot for the Phase 4 sweep.

## Phase 1 — Remove the legacy CLI surface
*Goal: drop `migrate` and `sync --legacy`; shrink the surface to 7.* — **AC-01, AC-03**

- [ ] **T1.1** Remove `sdd migrate`: delete `src/cli/migrate.js`, unwire it from `src/cli/dispatch.js`, remove it from `COMMAND_NAMES` + help, and delete `test/migrate.test.js`.
  - *Success*: `sdd --help` lists 7 commands; `sdd migrate` is handled as an unknown command (exit 3).
  - *Tests*: update `test/dispatch.test.js` (7 commands, `migrate` unknown).
- [ ] **T1.2** Remove the `--legacy` dual-emit path from `src/cli/sync.js` (keep reconcile) and delete the `sync --legacy` byte-stable test from `test/sync.test.js`.
  - *Success*: `sdd sync` reconciles as before; `--legacy` is no longer recognized.
  - *Tests*: sync reconcile tests still pass; a test asserts `--legacy` no longer performs dual-emit.

## Phase 2 — Delete legacy sources
*Goal: physically remove the 1.x pipeline.* — **AC-02, AC-05, AC-07**

- [ ] **T2.1** Delete legacy source trees: `playbooks/`, `dist/`, `scripts/sync.js`, `scripts/sync-consumer.sh` (and any other 1.x-only script), `legacy/`.
- [ ] **T2.2** Delete pre-2.0 templates: `templates/command.md.hbs`, `templates/command-en.md.hbs`, `templates/docs/`, `templates/claude/`, `templates/github/`, `templates/openspec/`. **Keep `templates/project/`.**
  - *Tests*: a guard asserts `templates/project/` still exists and `sdd init` still scaffolds fully.
- [ ] **T2.3** Remove `sync`/`check` npm scripts from `package.json`; delete `.github/workflows/generate.yml`; remove the "Legacy drift check" step from `.github/workflows/ci.yml`.
  - *Success*: `npm test` is the only remaining script needed for CI; `npm pack --dry-run` ships only `templates/project/` under templates.
  - *Tests*: `test/publish.test.js` still passes (excludes `playbooks/`, `dist/`, `scripts/`, `legacy/`).
- [ ] **T2.4** Remove any lingering references (grep from T0.1): `detectLegacy`, `sdd sync --legacy`, `dist/claude-commands`, etc., in code/tests/docs.
  - *Tests*: a repo-wide grep test finds no reference to the deleted paths (AC-02).

## Phase 3 — Docs & version
*Goal: the repo presents as 3.0 with no legacy narrative.* — **AC-06, AC-08**

- [ ] **T3.1** README: remove the *Legacy & deprecation* section; add a short *Upgrading to 3.0* note (migrate off 1.x on a 2.x release first; 3.0 has no `migrate`); update the command reference to 7 commands and drop `sync --legacy`.
- [ ] **T3.2** `CHANGELOG.md`: add a `3.0.0` entry (removed 1.x pipeline, `migrate`, `sync --legacy`, npm sync/check, generate workflow; breaking: command surface 8→7).
- [ ] **T3.3** Bump `package.json` `version` → `3.0.0`. Bump the config template default `methodology.compatible` → `">=3.0.0 <4.0.0"` (pending the open decision).
- [ ] **T3.4** Prune legacy narrative from the 2.0 design/skills docs where it describes the frozen pipeline (e.g. design §8.5/§8.6 references), or annotate them as historical.
  - *Tests*: `sdd validate` on this repo's own `openspec/changes/*` still passes (schemas unaffected).

## Phase 4 — Verification sweep
*Goal: confirm 2.0 functionality intact and legacy fully gone.* — **AC-01…AC-08**

- [ ] **T4.1** Full `node --test` green after removals (adjusted counts); `sdd --help` shows 7 commands; `sdd --version` == `3.0.0`.
- [ ] **T4.2** End-to-end: `sdd install` (+`--runtime`), `sdd init` → `sdd status`/`sdd next`/`sdd validate` on a fixture consumer all work with no legacy present.
- [ ] **T4.3** `npm pack --dry-run` audit vs the Phase 0 baseline: only `bin/ src/ skills/ addons/ schemas/ templates/project/` (+ package.json/README/CHANGELOG); nothing legacy.
- [ ] **T4.4** Grep sweep confirms zero references to any deleted path (AC-02); `sdd doctor` still blocks an out-of-range global install (AC-08).

---

## Phase → acceptance-criteria coverage

| Phase | ACs |
|---|---|
| 0 | (de-risks AC-04) |
| 1 | AC-01, AC-03 |
| 2 | AC-02, AC-05, AC-07 |
| 3 | AC-06, AC-08 |
| 4 | AC-01…AC-08 (sweep) |
