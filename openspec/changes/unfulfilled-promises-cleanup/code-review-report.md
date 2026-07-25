---
schema: code-review-report
schema_version: 1
change_id: unfulfilled-promises-cleanup
status: passed
updated: 2026-07-24
---
# Code Review Report — Cerrar las promesas incumplidas del CLI, la distribución y las specs

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- Do not suggest improvements outside spec scope.

## Checklist

- [passed] AC-1 — `.gitkeep` created and read-only-checked; not yet committed because
  no change in this cycle has been committed yet (that's `sdd-commit`'s job, not a
  code defect). `src/cli/init.js`/`src/cli/doctor.js` write it via `writeIfMissing`.
- [passed] AC-2 covered by `test/init.test.js:17-35,104-110,112-128`
- [passed] AC-3 covered by `test/tokens.test.js:90-127` (warn + EC-6 no-duplicate)
- [passed] AC-4 covered by `test/skill-contract.test.js:367-373` — instruction present
  and reachable in `skills/sdd-plan/canonical.md`/`SKILL.md`; no prior section
  contradicts it (see note below on a pre-existing, out-of-scope generator quirk)
- [passed] AC-5 covered by `test/install.test.js:35-47,118-129` (`src/install/manifest.js`)
- [passed] AC-6 covered by `test/doctor.test.js:116-158` (`src/cli/doctor.js:45-57`)
- [passed] AC-7 covered by `test/install.test.js:131-156` (`src/install/skills.js:62-80`)
- [passed] AC-8 covered by `test/doctor.test.js:170-211`
- [passed] AC-9 covered by `test/sync.test.js:35-60` — no mode/path/digest leak to lock
- [passed] AC-10 covered by `test/postinstall.test.js` (all cases, incl. EC-4, SEC-001)
- [passed] AC-11 — `openspec/specs/cli/spec.md` postinstall + contract-drift sections
  corrected; unrelated legacy specloom text left alone per non-goals
- [passed] AC-12 covered by `test/fs-safe.test.js:47-71`, `test/repos.test.js:528-550`
  (`src/util/fs-safe.js:58-82`, used in `src/cli/repos.js:150-158`, `EXIT.USAGE` before read)
- [passed] No changes outside allowed modules — `playbook changed-files --diff` matches
  `context-packet.md`'s "Files touched" exactly
- [passed] Conventions & quality gates respected — `node --check` per file, feature-test
  suite, `npm test`, `npm run generate:check` all green (see `tasks.md` Execution Report)

## Issues found

None blocking. Two notes for the record, neither changes the `passed` status:

### Note 1 — AC-1's "commiteado" is pending `sdd-commit`, not missing
- **File**: `openspec/changes/.gitkeep`
- **Observation**: the file exists and is correct, but nothing in this change is
  committed yet (expected — no change files anywhere in `openspec/changes/` are
  committed at this point in the cycle). This resolves automatically at `sdd-commit`
  and is not a code defect.

### Note 2 — Pre-existing generator quirk, out of scope
- **File**: `skills/sdd-plan/SKILL.md` (generated from `skills/sdd-plan/canonical.md`)
- **Observation**: the generator's section splitting is not fence-aware, so
  `canonical.md`'s top-level `## Preconditions` and `## Rules` sections render nested
  inside the fenced `tasks.md` template example in the generated `SKILL.md`, rather
  than as separate top-level sections. Confirmed via `git diff HEAD` that this
  structure predates this change — this change only added a bullet to the existing
  (already-nested) `## Rules` content. The new mandatory-`Regression` instruction is
  still present and readable as text (LLM skill consumption isn't fence-scoped), and
  `test/skill-contract.test.js` passes. Fixing the generator's fence-awareness is
  legitimate follow-up work but is out of scope for this change (no non-goal covers
  it explicitly, but it's a pre-existing issue unrelated to this change's ACs).
