---
schema: proposal
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Remove 1.x legacy compatibility"
status: approved
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
delivery:
  provider: github
impact:
  public_contract: true       # removes the `migrate` command, `sync --legacy`, and npm sync/check scripts
  data_model: false
  architecture_boundary: true  # removes the entire 1.x generation/distribution subsystem
  external_integration: false
  cross_repository: true       # drops support for 1.x submodule consumers
  authentication: false
  authorization: false
  infrastructure: true         # removes the 1.x generate workflow and the legacy CI drift check
  concurrency: false
  migration: true              # this is a removal/upgrade with a documented migration boundary
security:
  risk: low
  triggers: []
---

# SDD 3.0 — Remove 1.x legacy compatibility

## Objective

Complete the transition started in 2.0: **remove the frozen 1.x pipeline entirely**
so the repository has a single architecture (2.0 Agent Skills + `sdd` CLI). 2.0
kept 1.x working "frozen in place" during a deprecation window and explicitly
deferred physical removal to 3.0 (see `legacy/README.md`, 2.0 design §8.5). This
change performs that removal.

Per the approved decision, the removal is a **clean break**: the migration tooling
(`sdd migrate` / `detectLegacy`) is also removed. Consumers still on 1.x must
migrate to 2.x **before** adopting 3.0.

## Background

In 2.0 the 1.x sources were left at their current paths and only documented as
legacy: `playbooks/`, `dist/claude-commands/`, `scripts/sync.js`,
`scripts/sync-consumer.sh`, the pre-2.0 `templates/` (hbs + docs/claude/github/
openspec), the `sync`/`check` npm scripts, `.github/workflows/generate.yml`, and
the `sdd sync --legacy` dual-emit path. The compatibility-range pin
(`>=2.0.0 <3.0.0`) means 2.x consumers do **not** auto-adopt 3.0 — `sdd doctor`
blocks an out-of-range install — so removal does not silently break them.

## Scope

**In scope — remove**

- Legacy sources: `playbooks/`, `dist/`, `scripts/sync.js`, `scripts/sync-consumer.sh` (and any other 1.x-only scripts), `legacy/`.
- Pre-2.0 templates: `templates/command.md.hbs`, `templates/command-en.md.hbs`, `templates/docs/`, `templates/claude/`, `templates/github/`, `templates/openspec/`. **Keep `templates/project/`** (the 2.0 scaffolds).
- CLI: the **`sdd migrate`** command + `src/cli/migrate.js` + `detectLegacy`; the **`sdd sync --legacy`** dual-emit path (reconcile behavior stays).
- npm scripts `sync` and `check`; `.github/workflows/generate.yml`; the legacy drift step in `.github/workflows/ci.yml`.
- Tests tied to legacy: `test/migrate.test.js`, the `sync --legacy` byte-stable test in `test/sync.test.js`, and any `dist/` references.
- Docs: the *Legacy & deprecation* section of the README; legacy notes in the design/skills that describe the frozen pipeline.

**In scope — change**

- Command surface shrinks from **8 → 7** (`install`, `init`, `doctor`, `status`, `next`, `validate`, `sync`). This supersedes 2.0 AC-01.
- `package.json` version → **3.0.0**; `files` already ships only `templates/project/`.
- Default `methodology.compatible` in the config template → `">=3.0.0 <4.0.0"`.

**Out of scope (non-goals)**

- No new features. This is a removal + version/doc update only.
- No changes to the 2.0 lifecycle, schemas, skills behavior, or GitHub delivery.
- No new remote providers.
- Not re-adding a migration path in 3.0 (the clean-break decision).

## Acceptance criteria

- **AC-01** `sdd --help` lists exactly **7** commands: `install`, `init`, `doctor`, `status`, `next`, `validate`, `sync`. `migrate` is absent and unknown-command handling applies to it.
- **AC-02** None of the legacy paths remain in the repo (`playbooks/`, `dist/`, `scripts/sync.js`, `scripts/sync-consumer.sh`, `legacy/`, `templates/{command*.hbs,docs,claude,github,openspec}`), and `grep` finds no source/test/doc references to them.
- **AC-03** `sdd sync` no longer accepts `--legacy`; its reconcile behavior (lock ↔ installed version) is unchanged and still tested.
- **AC-04** All 2.0 functionality is intact: install/init/doctor/status/next/validate/sync, the skills, the lifecycle engine, and the schemas — the full (non-legacy) test suite is green.
- **AC-05** `package.json` has no `sync`/`check` scripts, `version` is `3.0.0`, and `npm pack --dry-run` ships only `bin/ src/ skills/ addons/ schemas/ templates/project/` (+ package.json/README).
- **AC-06** README and CHANGELOG document the removal and state clearly that migrating off 1.x must be done on a **2.x** release before upgrading to 3.0.
- **AC-07** CI (`.github/workflows/ci.yml`) no longer runs the legacy drift check, and `.github/workflows/generate.yml` is removed.
- **AC-08** A 2.x consumer (compatible `">=2.0.0 <3.0.0"`) is not silently upgraded: `sdd doctor` still blocks an out-of-range global install (unchanged from 2.0, C-08).

## Risks

- **R-01 — Stranding 1.x consumers.** Removing `migrate` leaves no in-3.0 path off 1.x. *Mitigation:* 3.0 is a major version; document that migration must happen on 2.x first; keep the last 2.x release published/tagged.
- **R-02 — Hidden coupling to legacy.** A 2.0 code path might import a legacy module. *Mitigation:* Phase 0 audits imports of `scripts/`/`playbooks/`/`dist/`; the suite must stay green after removal (AC-04).
- **R-03 — Accidental over-deletion.** Deleting `templates/` wholesale would take `templates/project/` with it. *Mitigation:* delete named 1.x subpaths only; a test asserts `templates/project/` survives and `npm pack` is intact.
- **R-04 — Consumers on the compatible range.** *Mitigation:* the `>=2.0.0 <3.0.0` pin + `sdd doctor` block already prevent silent adoption (AC-08); no additional work needed.

## Design

`design_required` is **true** (public-contract + architecture-boundary removal), so
a short `design.md` precedes implementation via `sdd-design` — mainly the command-
surface change (8→7), the exact deletion list, and the compatibility/versioning
note. The mechanics are otherwise straightforward deletion + doc/version updates.

## Open technical decisions

None. Resolved at approval: the config template default `methodology.compatible`
bumps to `">=3.0.0 <4.0.0"` for new `sdd init` in 3.0; existing projects keep
their own pin.
