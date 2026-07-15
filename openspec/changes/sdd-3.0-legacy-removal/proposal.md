---
schema: proposal
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Remove 1.x legacy and all old references"
status: approved
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
delivery:
  provider: github
impact:
  public_contract: true        # removes the `migrate` command, `sync --legacy`, npm sync/check scripts
  data_model: false
  architecture_boundary: true   # removes the entire 1.x generation/distribution subsystem
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: true          # removes the 1.x generate workflow and the legacy CI drift check
  concurrency: false
  migration: true               # a removal/cleanup release
security:
  risk: low
  triggers: []
---

# SDD 3.0 — Remove 1.x legacy and all old references

## Objective

Make 3.0 a **clean baseline**: a single architecture (2.0-style Agent Skills +
`sdd` CLI) and a **single source of documentation**, with **no legacy pipeline
and no old references** anywhere in the repo. Everyone starts fresh on 3.0 —
there is **no cross-version migration story** to support or document.

## Background

2.0 kept the 1.x pipeline "frozen in place" and deferred its removal to 3.0.
Because every project starts on 3.0, we don't need the migration tooling, the
deprecation narrative, or the 1.x bridges — all of it is removed. (The historical
record of how 2.0 was built stays in `openspec/changes/sdd-2.0/` and in git.)

## Scope

**Remove — legacy sources**

- `playbooks/`, `dist/` (`dist/claude-commands/`), `scripts/sync.js`, `scripts/sync-consumer.sh` (and any other 1.x-only script), `legacy/`.
- Pre-2.0 templates: `templates/command.md.hbs`, `templates/command-en.md.hbs`, `templates/docs/`, `templates/claude/`, `templates/github/`, `templates/openspec/`. **Keep `templates/project/`.**
- `.github/workflows/generate.yml`; the `sync`/`check` npm scripts; the legacy drift step in `ci.yml`.

**Remove — CLI surface**

- The **`sdd migrate`** command (`src/cli/migrate.js`, `detectLegacy`, `test/migrate.test.js`) — no migration path in 3.0.
- The **`sdd sync --legacy`** dual-emit path (reconcile stays).

**Remove — old references / bridges**

- The **`sdd-ff`** skill (`skills/sdd-ff/`) — the 1.x→2.0 deprecation bridge; obsolete on a fresh baseline. Drop the "replaces the deprecated `sdd-ff`" wording from `sdd-plan`.
- The "Full 1.x reference: `playbooks/…`" lines in the Confluence add-on skills.
- All legacy/migration/deprecation narrative in the README and shipped docs.

**Change**

- Command surface **8 → 7**: `install`, `init`, `doctor`, `status`, `next`, `validate`, `sync`. Supersedes 2.0 AC-01.
- Core skills **14 → 13** (`sdd-ff` removed).
- `package.json` version → **3.0.0**; config template `methodology.compatible` → `">=3.0.0 <4.0.0"` (fresh baseline).
- README/CHANGELOG present 3.0 as the starting point — a **single doc source**, no "what changed from 1.x/2.0" migration narrative.

**Out of scope (non-goals)**

- No new features; removal + cleanup + version/doc updates only.
- No changes to the 2.0 lifecycle, schemas, skill behavior, or GitHub delivery.
- No cross-version migration tooling or narrative.
- Do not rewrite the historical `openspec/changes/sdd-2.0/` record (kept as-is).

## Acceptance criteria

- **AC-01** `sdd --help` lists exactly **7** commands (`install`, `init`, `doctor`, `status`, `next`, `validate`, `sync`); `migrate` is unknown (exit 3).
- **AC-02** No legacy path or old reference remains — a repo-wide grep finds no `playbooks/`, `dist/claude`, `scripts/sync`, `legacy/`, `sdd-ff`, `sync --legacy`, or "1.x"/migration/deprecation wording in source, tests, skills, or shipped docs (the `openspec/changes/sdd-2.0/` historical record is exempt).
- **AC-03** `sdd sync` no longer accepts `--legacy`; reconcile behavior is unchanged and still tested.
- **AC-04** All 2.0 functionality is intact: install (+`--runtime`), init (+capability hint), doctor, status, next, validate, sync, the 13 core skills, the lifecycle engine, and the schemas — the full (adjusted) test suite is green.
- **AC-05** `package.json` has no `sync`/`check` scripts, `version` is `3.0.0`, and `npm pack --dry-run` ships only `bin/ src/ skills/ addons/ schemas/ templates/project/` (+ package.json/README/CHANGELOG).
- **AC-06** README and CHANGELOG present 3.0 as the baseline (single doc source) with **no** migration/deprecation narrative; the shipped `templates/project/docs/*` remain the only consumer doc set.
- **AC-07** CI (`.github/workflows/ci.yml`) no longer runs the legacy drift check, and `.github/workflows/generate.yml` is removed.

## Risks

- **R-01 — Hidden coupling to legacy.** A 2.0 code path might import a legacy module. *Mitigation:* Phase 0 audits imports of `scripts/`/`playbooks/`/`dist/`; the suite must stay green (AC-04).
- **R-02 — Accidental over-deletion.** A wildcard delete of `templates/` would remove `templates/project/`. *Mitigation:* delete named 1.x subpaths only; a guard test asserts `templates/project/` survives and `npm pack` is intact.
- **R-03 — Stale references left behind.** Removing files but not their mentions. *Mitigation:* the Phase 0 grep list drives a Phase 4 grep sweep that must come back empty (AC-02).

## Design

`design_required` is true (public-contract + architecture-boundary removal); see
`design.md` for the command-surface change, the exact deletion list, and the
reference-purge list.

## Open technical decisions

None.
