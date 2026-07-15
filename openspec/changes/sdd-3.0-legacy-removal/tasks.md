---
schema: tasks
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Legacy & old-reference removal plan"
status: ready
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
depends_on: design.md
---

# SDD 3.0 — Legacy & old-reference removal plan

**Spec**: `proposal.md` · **Design**: `design.md`

> **Execution gate.** `proposal.md` and `design.md` are **approved** (2026-07-15).
> Implementation proceeds one phase at a time, each stopping for human review.
> **Phases 0–2 are complete**; later phases are not started.

Each phase is independently reviewable and leaves the 2.0 functionality green.
One phase per commit. Task ids are `T<phase>.<index>`.

## Phase 0 — Audit & guardrails
*Goal: inventory every old reference before deleting anything.* — de-risks **AC-02, AC-04**

- [x] **T0.1** Grep the surviving tree for every old term. ✓ Hits confined to the expected files (migrate.js/test, sync.js/test `--legacy`, sdd-ff in skill-contract, traceability mappings, dispatch list). **Two extra cleanups surfaced (added to Phase 3):** the `migrate` mention in `src/util/fs-safe.js` comments, and the legacy-path assertions in `test/publish.test.js`.
- [x] **T0.2** No core module imports a legacy path (✓ de-risks R-01). Baseline captured: **8** commands, **14** skills, **169** tests green.

## Phase 1 — Remove the legacy CLI surface (8 → 7)
*Goal: drop `migrate` and `sync --legacy`.* — **AC-01, AC-03**

- [x] **T1.1** Remove `sdd migrate`: deleted `src/cli/migrate.js` + `test/migrate.test.js`; unwired from `dispatch.js` (`COMMAND_NAMES` 8→7, handler, import, summary). ✓
  - *Tests*: `test/dispatch.test.js` → 7 commands + `migrate` unknown (exit 3). ✓ Also **realigned `test/traceability.test.js` here** (forced by the migrate.test deletion): converted to a capability→test map with no 2.0 AC numbers and no migrate/legacy/sdd-ff entries — this covers the traceability part of T3.2.
- [x] **T1.2** Remove the `--legacy` dual-emit from `src/cli/sync.js` (keep reconcile); delete the `sync --legacy` test in `test/sync.test.js`. ✓ (dropped now-unused `execFileSync`/`PACKAGE_ROOT`/`fileURLToPath` imports)

## Phase 2 — Delete legacy sources + the sdd-ff bridge
*Goal: physically remove the 1.x pipeline and the obsolete bridge.* — **AC-02, AC-05, AC-07**

- [x] **T2.1** Deleted `playbooks/`, `dist/`, `scripts/sync.js`, `scripts/sync-consumer.sh`, `scripts/fix-bodies.mjs`, `legacy/`. ✓ `scripts/` is now empty and gone.
- [x] **T2.2** Deleted pre-2.0 templates: `command*.hbs`, `docs/`, `claude/`, `github/`, `openspec/`. ✓ `templates/` now holds only `project/`.
- [x] **T2.3** Deleted `skills/sdd-ff/`. ✓ Skill count 14 → **13**.
  - *Note*: deleting `sdd-ff/` broke `test/skill-contract.test.js`, so **the skill-contract part of T3.2 was pulled in here** (same coupling as traceability in Phase 1): dropped `sdd-ff` from the presence list (asserts 13), removed the `sdd-ff`-deprecated test, and cleaned the residual `sdd-ff` references from the neighbouring test + the traceability comment.
- [x] **T2.4** Removed the `sync`/`check` npm scripts; deleted `.github/workflows/generate.yml`; dropped the "Legacy drift check (1.x)" step from `.github/workflows/ci.yml`. ✓ `test/publish.test.js` still green; `npm pack --dry-run` lists no legacy path.

## Phase 3 — Purge remaining references + docs + version
*Goal: single doc source, no old references, presented as 3.0.* — **AC-02, AC-05, AC-06**

- [ ] **T3.1** `skills/sdd-plan/SKILL.md`: remove the "replaces the deprecated `sdd-ff`" wording (description + body). `addons/confluence/*/SKILL.md`: remove the "Full 1.x reference: `playbooks/…`" lines.
- [x] **T3.2** `test/skill-contract.test.js` was realigned in **Phase 2 / T2.3** (drop `sdd-ff`, assert 13, remove deprecated test). `test/install.test.js` pins no skill count (checked). `test/traceability.test.js` was realigned in Phase 1 / T1.1.
- [ ] **T3.3** README: remove the *Legacy & deprecation* section and all migration/deprecation wording; command reference → 7 commands (no `sync --legacy`); present 3.0 as the baseline (single doc source). CHANGELOG: a clean `3.0.0` entry.
- [ ] **T3.4** `package.json` `version` → `3.0.0` (scripts already trimmed in T2.4). `templates/project/sdd.config.yaml`: `methodology.compatible` → `">=3.0.0 <4.0.0"`.
- [ ] **T3.5** Clean the two extra spots found in Phase 0: the `migrate` mention in `src/util/fs-safe.js` comments (→ `--fix`/bootstrap only), and `test/publish.test.js` exclusion assertions (drop the now-nonexistent `playbooks/`/`dist/`/`legacy/`/`scripts/`/`templates/{docs,claude}` paths; keep `node_modules/`/`test/`/`openspec/`).
- [ ] **T3.6** Add the guard/grep test: no source/test/skill/shipped-doc reference to any deleted path or old term (AC-02, exempting `openspec/changes/sdd-2.0/`); assert `templates/project/` survives.

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
