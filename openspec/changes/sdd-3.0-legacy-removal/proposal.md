---
schema: proposal
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Legacy removal + consumer doc-template alignment"
status: approved   # re-approved 2026-07-15 after scope expansion
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

3.0 also **aligns the consumer doc templates** to the naming and structure that
real SDD projects already use in practice (`agent_architecture.md`,
`doc_architecture.md`, `doc_verification_guide.md`, `sdd-workflow.md`), so a fresh
`sdd init` matches the house convention out of the box.

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

**Align — consumer doc templates (scope expansion, 2026-07-15)**

- Rename the shipped consumer docs to the house convention: `templates/project/docs/architecture.md` → `doc_architecture.md`, `verification.md` → `doc_verification_guide.md` (`sdd-workflow.md` unchanged).
- Add a 4th consumer doc `templates/project/docs/agent_architecture.md` (how agents operate in the repo) — a generic, stack-agnostic skeleton.
- The doc model gains a matching logical document. `DEFAULT_DOCUMENTS`, the `documents:` template, `sdd init` scaffolding/adoption, and `sdd-bootstrap-project` learn the four docs; the skills that read project docs point at the renamed paths. The `documents` schema is already open (no schema change).

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
- **AC-06** README and CHANGELOG present 3.0 as the baseline (single doc source) with **no** migration/deprecation narrative; the shipped `templates/project/docs/*` (the aligned four-doc set) remain the only consumer doc set.
- **AC-07** CI (`.github/workflows/ci.yml`) no longer runs the legacy drift check, and `.github/workflows/generate.yml` is removed.
- **AC-08** A fresh `sdd init` scaffolds the consumer docs under the house-convention names — `docs/agent_architecture.md`, `docs/doc_architecture.md`, `docs/doc_verification_guide.md`, `docs/sdd-workflow.md`; `DEFAULT_DOCUMENTS` and the `documents:` template point at these paths, and no source/skill/test/shipped-doc still references the pre-rename `docs/architecture.md` or `docs/verification.md`.
- **AC-09** The doc model has a 4th logical document `agent_architecture`; `sdd-bootstrap-project` detects/maps all four docs (without cross-adopting `agent_architecture.md` ↔ `doc_architecture.md`); the skills that read project docs reference the renamed paths; and the full (adjusted) test suite is green.

## Risks

- **R-01 — Hidden coupling to legacy.** A 2.0 code path might import a legacy module. *Mitigation:* Phase 0 audits imports of `scripts/`/`playbooks/`/`dist/`; the suite must stay green (AC-04).
- **R-02 — Accidental over-deletion.** A wildcard delete of `templates/` would remove `templates/project/`. *Mitigation:* delete named 1.x subpaths only; a guard test asserts `templates/project/` survives and `npm pack` is intact.
- **R-03 — Stale references left behind.** Removing files but not their mentions. *Mitigation:* the Phase 0 grep list drives a final grep sweep that must come back empty (AC-02).
- **R-04 — Doc-rename ripple.** The doc paths are referenced in ~6 skills, config defaults, `init.js`, and tests; a missed spot leaves a dangling `docs/architecture.md`. *Mitigation:* the sweep also asserts no leftover pre-rename doc paths (AC-08); the rename lands in its own phase/commit.
- **R-05 — Candidate cross-adoption.** `agent_architecture.md` and `doc_architecture.md` both contain "architect", so `sdd init`/`sdd-bootstrap-project` could adopt one as the other. *Mitigation:* specific candidate patterns (the plain architecture pattern excludes "agent"); a test covers both (AC-09).

## Amendment — 2026-07-15 (scope expansion)

After Phases 0–2 shipped, the owner observed that the 2.0 consumer doc templates
(`architecture.md`, `verification.md`) diverge from the names/structure real SDD
projects use (`agent_architecture.md`, `doc_architecture.md`,
`doc_verification_guide.md`). Decision (owner): **fold the alignment into 3.0**
and adopt the **full** house convention (rename **and** add `agent_architecture`).
This adds the *Align* scope block, AC-08/AC-09, R-04/R-05, design §9, and Phases
4–5 in `tasks.md`. Phases 0–2 (legacy removal) are unaffected and stay done.

## Design

`design_required` is true (public-contract + architecture-boundary removal); see
`design.md` for the command-surface change, the exact deletion list, and the
reference-purge list.

## Open technical decisions

None.
