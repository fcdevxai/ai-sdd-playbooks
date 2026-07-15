---
schema: tasks
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Legacy & old-reference removal plan"
status: draft
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
depends_on: design.md
---

# SDD 3.0 — Legacy & old-reference removal plan

**Spec**: `proposal.md` · **Design**: `design.md`

> **Execution gate.** `proposal.md` is **approved**. Since `design_required` is
> true, no phase starts until `design.md` → `approved` too (currently `draft`,
> awaiting sign-off). Implementation does not begin yet.

Each phase is independently reviewable and leaves the 2.0 functionality green.
One phase per commit. Task ids are `T<phase>.<index>`.

## Phase 0 — Audit & guardrails
*Goal: inventory every old reference before deleting anything.* — de-risks **AC-02, AC-04**

- [ ] **T0.1** Grep the surviving tree (`src/`, `bin/`, `skills/`, `addons/`, `schemas/`, `templates/project/`, `test/`, `README.md`, `.github/`) for every old term: `playbooks`, `dist/claude`, `scripts/sync`, `legacy`, `sdd-ff`, `sync --legacy`, `detectLegacy`, `migrate`, `1.x`, "deprecat". Record the hit list — it drives Phases 3–4. (Exempt `openspec/changes/sdd-2.0/`.)
- [ ] **T0.2** Confirm no core 2.0 module imports a legacy path; capture the baseline (test count, `npm pack --dry-run` files, `sdd --help` = 8 commands, skill count = 14).

## Phase 1 — Remove the legacy CLI surface (8 → 7)
*Goal: drop `migrate` and `sync --legacy`.* — **AC-01, AC-03**

- [ ] **T1.1** Remove `sdd migrate`: delete `src/cli/migrate.js` + `test/migrate.test.js`; unwire from `dispatch.js` (`COMMAND_NAMES`, handler, import).
  - *Tests*: `test/dispatch.test.js` → 7 commands, `migrate` unknown (exit 3).
- [ ] **T1.2** Remove the `--legacy` dual-emit from `src/cli/sync.js` (keep reconcile); delete the `sync --legacy` test in `test/sync.test.js`.

## Phase 2 — Delete legacy sources + the sdd-ff bridge
*Goal: physically remove the 1.x pipeline and the obsolete bridge.* — **AC-02, AC-05, AC-07**

- [ ] **T2.1** Delete: `playbooks/`, `dist/`, `scripts/sync.js`, `scripts/sync-consumer.sh` (+ any other 1.x-only script), `legacy/`. Remove `scripts/` if it ends up empty.
- [ ] **T2.2** Delete pre-2.0 templates: `templates/command*.hbs`, `templates/docs/`, `templates/claude/`, `templates/github/`, `templates/openspec/`. **Keep `templates/project/`** (guard test).
- [ ] **T2.3** Delete `skills/sdd-ff/` (the 1.x→2.0 deprecation bridge).
- [ ] **T2.4** Remove `sync`/`check` npm scripts; delete `.github/workflows/generate.yml`; drop the legacy drift step from `.github/workflows/ci.yml`.
  - *Tests*: `test/publish.test.js` still green (excludes deleted paths).

## Phase 3 — Purge remaining references + docs + version
*Goal: single doc source, no old references, presented as 3.0.* — **AC-02, AC-05, AC-06**

- [ ] **T3.1** `skills/sdd-plan/SKILL.md`: remove the "replaces the deprecated `sdd-ff`" wording (description + body). `addons/confluence/*/SKILL.md`: remove the "Full 1.x reference: `playbooks/…`" lines.
- [ ] **T3.2** `test/skill-contract.test.js`: drop `sdd-ff` from the presence list (13 skills). `test/traceability.test.js`: realign to the 3.0 ACs (no `AC-13 → migrate`, no 8-command AC-01). Adjust `test/install.test.js` if it pins a skill count.
- [ ] **T3.3** README: remove the *Legacy & deprecation* section and all migration/deprecation wording; command reference → 7 commands (no `sync --legacy`); present 3.0 as the baseline (single doc source). CHANGELOG: a clean `3.0.0` entry.
- [ ] **T3.4** `package.json` `version` → `3.0.0` (scripts already trimmed in T2.4). `templates/project/sdd.config.yaml`: `methodology.compatible` → `">=3.0.0 <4.0.0"`.
- [ ] **T3.5** Add the guard/grep test: no source/test/skill/shipped-doc reference to any deleted path or old term (AC-02, exempting `openspec/changes/sdd-2.0/`); assert `templates/project/` survives.

## Phase 4 — Verification sweep
*Goal: 2.0 intact, legacy fully gone.* — **AC-01…AC-07**

- [ ] **T4.1** Full `node --test` green; `sdd --help` = 7 commands; `sdd --version` = `3.0.0`; skill count = 13.
- [ ] **T4.2** E2E: `sdd install` (+`--runtime`) → `init` → `status`/`next`/`validate` on a fixture consumer, with no legacy present.
- [ ] **T4.3** `npm pack --dry-run` audit vs the Phase 0 baseline: only `bin/ src/ skills/ addons/ schemas/ templates/project/` (+ package.json/README/CHANGELOG).
- [ ] **T4.4** Grep sweep returns empty for every old term (AC-02).

---

## Phase → acceptance-criteria coverage

| Phase | ACs |
|---|---|
| 0 | (de-risks AC-02, AC-04) |
| 1 | AC-01, AC-03 |
| 2 | AC-02, AC-05, AC-07 |
| 3 | AC-02, AC-05, AC-06 |
| 4 | AC-01…AC-07 (sweep) |
