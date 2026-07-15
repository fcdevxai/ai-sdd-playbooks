---
schema: design
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Legacy & old-reference removal design"
status: draft
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
depends_on: proposal.md
security:
  risk: low
  threat_model_required: false
  controls: []
---

# SDD 3.0 — Legacy & old-reference removal design

Technical contract for `proposal.md`. A removal + contract change with **no new
behavior**: the command-surface change, the exact deletion list, the reference
purge, and versioning. 3.0 is a clean baseline — no cross-version migration.

## 1. Command surface change (8 → 7)

`migrate` is removed from the public surface (supersedes 2.0 AC-01). New surface,
in order: `install · init · doctor · status · next · validate · sync`.

- `src/cli/dispatch.js`: drop `migrate` from `COMMAND_NAMES`, the `HANDLERS.migrate`
  wiring, and the `migrateCommand` import.
- `sdd migrate` → unknown-command handling (`exit 3`). No deprecation notice
  (clean baseline).
- `test/dispatch.test.js`: assert the 7-command surface and `migrate` unknown.

## 2. `sync` — drop the legacy dual-emit

Remove the `--legacy` branch from `src/cli/sync.js` (and its `PACKAGE_ROOT` /
`execFileSync` / `scripts/sync.js` dependency). `sync` keeps only reconcile
(lock `resolved` ↔ installed version). Delete the `--legacy` byte-stable test in
`test/sync.test.js`; keep the reconcile tests.

## 3. Deletion list

**Delete:**

| Path | Why |
|---|---|
| `playbooks/` | 1.x canonical sources |
| `dist/` | 1.x generated commands |
| `scripts/sync.js`, `scripts/sync-consumer.sh`, `scripts/fix-bodies.mjs` (if present) | 1.x generator/installer/helpers |
| `legacy/` | freeze-policy doc |
| `templates/command.md.hbs`, `templates/command-en.md.hbs` | 1.x command templates |
| `templates/docs/`, `templates/claude/`, `templates/github/`, `templates/openspec/` | pre-2.0 consumer templates |
| `.github/workflows/generate.yml` | 1.x generate workflow |
| `src/cli/migrate.js`, `test/migrate.test.js` | migrate command + `detectLegacy` |
| `skills/sdd-ff/` | 1.x→2.0 deprecation bridge (obsolete on a fresh baseline) |

**Keep (untouched):** `bin/`, all `src/` except `migrate.js`, `skills/` except
`sdd-ff/` (13 core skills remain), `addons/`, `schemas/`, **`templates/project/`**,
`test/` except the deleted files, `openspec/` (incl. the historical
`changes/sdd-2.0/`). If `scripts/` becomes empty, remove the empty dir.

**Guard:** a test asserts `templates/project/` survives and `sdd init` still
scaffolds fully, so a wildcard `templates/` delete can't slip through.

## 4. Reference purge (surviving files)

After the deletions, remove every remaining mention of the old world:

- `skills/sdd-plan/SKILL.md`: drop "Replaces the deprecated `sdd-ff`" from the
  `description` and body — `sdd-plan` simply is the planner.
- `addons/confluence/document-code/SKILL.md` and `write-in-confluence/SKILL.md`:
  remove the "Full 1.x reference: `playbooks/…` (frozen)" lines.
- `README.md`: remove the *Legacy & deprecation* section and any migration/
  deprecation wording; present 3.0 as the baseline (single doc source). Command
  reference → 7 commands, no `sync --legacy`.
- `test/skill-contract.test.js`: drop `sdd-ff` from the presence list.
- `test/traceability.test.js`: the 2.0 map references `AC-13 → migrate.test.js`
  and an 8-command AC-01; both are superseded — realign to the 3.0 ACs.

Driven by the Phase 0 grep inventory; the Phase 4 grep sweep must come back empty
(AC-02), exempting `openspec/changes/sdd-2.0/` (historical record).

## 5. package.json, versioning & config

- `version` → `3.0.0`; remove `sync` and `check` npm scripts (`test` stays).
  `files` already lists only `templates/project/` — re-audit via `npm pack --dry-run`.
- `templates/project/sdd.config.yaml`: `methodology.compatible` → `">=3.0.0 <4.0.0"`.
- The `sdd.lock` compatibility-range machinery and `doctor`'s range check stay as
  a **forward-looking** feature (3.0→4.0); there is no 1.x/2.x migration framing.

## 6. CI

- `.github/workflows/ci.yml`: remove the "Legacy drift check (1.x)" (`npm run check`)
  step; keep tests + `npm pack --dry-run` + CLI smoke.
- Delete `.github/workflows/generate.yml`.

## 7. Test impact

- **Delete:** `test/migrate.test.js`; the `sync --legacy` case in `test/sync.test.js`.
- **Update:** `test/dispatch.test.js` (7 commands, `migrate` unknown);
  `test/skill-contract.test.js` (13 skills, no `sdd-ff`); `test/traceability.test.js`
  (realign to 3.0 ACs); `test/install.test.js` if it asserts a skill count.
- **Add:** a grep/guard test asserting no source/test/skill/shipped-doc reference
  to any deleted path or old term (AC-02), plus the `templates/project/`-survives guard.
- **Unchanged, must stay green:** engine, schemas, install (+`--runtime`), init
  (+capability hint), doctor, validate, security, adapters, delivery,
  detect-capabilities, publish.

## 8. Traceability

| AC | Design section |
|---|---|
| AC-01 | §1 |
| AC-02 | §3, §4, §7 |
| AC-03 | §2 |
| AC-04 | §3 (keep list), §7 |
| AC-05 | §5 |
| AC-06 | §4 (README) |
| AC-07 | §6 |
