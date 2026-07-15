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

> **Execution gate.** `proposal.md` and `design.md` were approved (2026-07-15),
> **amended and re-approved the same day** (scope expansion: doc-template alignment).
> Implementation proceeds one phase at a time, each stopping for human review.
> **Phases 0–5 are complete** (legacy removal + purge + doc alignment + version/docs);
> Phase 6 (verification sweep) is not started.

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

## Phase 3 — Purge remaining legacy references
*Goal: no old references left in surviving files.* — **AC-02**

- [x] **T3.1** `skills/sdd-plan/SKILL.md`: removed the "replaces the deprecated `sdd-ff`" wording (description + body). `addons/confluence/*/SKILL.md`: removed the "Full 1.x reference: `playbooks/…`" lines. ✓
- [x] **T3.2** `test/skill-contract.test.js` was realigned in **Phase 2 / T2.3** (drop `sdd-ff`, assert 13, remove deprecated test). `test/install.test.js` pins no skill count (checked). `test/traceability.test.js` was realigned in Phase 1 / T1.1.
- [x] **T3.3** Cleaned the `migrate` mentions in `src/util/fs-safe.js` comments (→ `--fix`/bootstrap) and `src/cli/init.js`'s header comment (→ dry-run/apply). `test/publish.test.js` exclusion assertions now keep only `node_modules/`/`test/`/`openspec/`. ✓
- [x] **T3.4** Added `test/no-legacy-refs.test.js`: scans `src/ bin/ skills/ addons/ templates/project/ test/` for removed 1.x paths/old terms (empty), and asserts `templates/project/` survives. ✓ Shipped-doc coverage (README/CHANGELOG) is **extended in Phase 5** once those are clean.

## Phase 4 — Template & doc-model alignment (amendment)
*Goal: consumer docs match the house convention out of the box.* — **AC-08, AC-09** · design §9

- [x] **T4.1** Renamed (git-mv, history kept): `architecture.md` → `doc_architecture.md`, `verification.md` → `doc_verification_guide.md`. Added `templates/project/docs/agent_architecture.md` (generic skeleton lifted from the git-history 1.x template, modernized to the global SDD skills + `sdd next`). ✓
- [x] **T4.2** CLI wiring: `config.js` `DEFAULT_DOCUMENTS` (two paths + `agent_architecture`) **and** `DEFAULT_CONFIG.methodology.compatible` → `">=3.0.0 <4.0.0"` (consistency with §5's 3.0→4.0 framing); `init.js` `LOGICAL` (+ entry) and `CANDIDATE_PATTERNS` (specific — `architecture` excludes `agent`, R-05); `templates/project/sdd.config.yaml` `documents:` block + `compatible` → 3.0. ✓
- [x] **T4.3** Skills: repointed `docs/architecture.md`/`docs/verification.md` → renamed paths across `sdd-enrich-us`, `sdd-design`, `sdd-plan`, `sdd-apply`, `sdd-code-review`, `sdd-verify`; `sdd-bootstrap-project` now maps the 4th doc (distinct from `architecture`); `sdd-apply` + `sdd-bootstrap-project` reference `docs/agent_architecture.md`. ✓
- [x] **T4.4** Tests: `test/config.test.js` (new default paths, `resolveAllDocuments` = 5); `test/init.test.js` (4 docs scaffold + a new R-05 cross-adoption test); `test/doctor.test.js` range fixtures → 3.0 (coupled to the template `compatible` bump). Suite **167/167**; a real `sdd init` scaffolds the four docs. ✓

## Phase 5 — Version, README & CHANGELOG
*Goal: single doc source, presented as 3.0.* — **AC-05, AC-06**

- [x] **T5.1** `package.json` `version` → `3.0.0`. ✓ `sdd --version` = `3.0.0`.
- [x] **T5.2** README: removed the *Legacy & deprecation* section, the 2.0/frozen intro blockquote, the `migrate` row and `sync --legacy`; command reference → 7 commands; init section documents the **four-doc** consumer set; `npm run check` dropped from Development. ✓
- [x] **T5.3** CHANGELOG: replaced with a single clean `3.0.0` baseline entry (no Deprecated/Compatibility sections, no migration narrative). ✓ Also **extended `test/no-legacy-refs.test.js`** to scan `README.md`/`CHANGELOG.md` (now clean) — closes the shipped-doc gap noted in T3.4.

## Phase 6 — Verification sweep
*Goal: 2.0 intact, legacy fully gone, docs aligned.* — **AC-01…AC-09**

- [ ] **T6.1** Full `node --test` green; `sdd --help` = 7 commands; `sdd --version` = `3.0.0`; skill count = 13; a fresh `sdd init` scaffolds the four aligned docs.
- [ ] **T6.2** E2E: `sdd install` (+`--runtime`) → `init` → `status`/`next`/`validate` on a fixture consumer, with no legacy present.
- [ ] **T6.3** `npm pack --dry-run` audit vs the Phase 0 baseline: only `bin/ src/ skills/ addons/ schemas/ templates/project/` (+ package.json/README/CHANGELOG).
- [ ] **T6.4** Grep sweep returns empty for every old term **and** for the pre-rename `docs/architecture.md`/`docs/verification.md` paths (AC-02, AC-08).

---

## Phase → acceptance-criteria coverage

| Phase | ACs |
|---|---|
| 0 | (de-risks AC-02, AC-04) |
| 1 | AC-01, AC-03 |
| 2 | AC-02, AC-05, AC-07 |
| 3 | AC-02 |
| 4 | AC-08, AC-09 |
| 5 | AC-05, AC-06 |
| 6 | AC-01…AC-09 (sweep) |
