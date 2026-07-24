---
schema: code-review-report
schema_version: 1
change_id: token-saving-parity
status: passed
updated: 2026-07-24
---
# Code Review Report — Paridad de ahorro de tokens: cablear packet + spec-index

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- Do not suggest improvements outside spec scope.

## Checklist

- [passed] AC-1 — `sdd-commit`/`sdd-runtime-gate` carry the packet block. Verified
  by direct grep (`context-packet.md` / `read it instead of`) and by
  `test/skill-contract.test.js` ("sdd-commit and sdd-runtime-gate read the
  context-packet...").
- [passed] AC-2 — no `skills/*/canonical.md` contains `proposal.md#`/`tasks.md#`.
  Verified by direct grep across `skills/` (0 hits) and by the corresponding
  skill-contract test.
- [passed] AC-3 — `sdd-verify`/`sdd-commit` explicitly state that
  proposal/tasks content comes from the packet, never from `spec-read`
  (`skills/sdd-verify/canonical.md:38`, `skills/sdd-commit/canonical.md:32`).
- [passed] AC-4 — all 5 section-first skills (`sdd-code-review`,
  `sdd-security-gate`, `sdd-runtime-gate`, `sdd-verify`, `sdd-commit`) mention
  `spec-index` with the discovery/fallback instruction. Verified by grep count
  per skill and by the corresponding skill-contract test.
- [passed] AC-5 — `skills/sdd-apply/canonical.md:59` says `.specloom/runs/`;
  `grep -R ".playbook/runs" skills/` returns nothing.
- [passed] AC-6 — `specIndexAdvisory({cwd})` in `src/cli/doctor.js:95-99`,
  wired into `warnings[]` in `doctorCommand` (line 152-153). Confirmed the
  `healthy` computation (`problems.length === 0`, line 180) is untouched by
  the new warning — same channel/pattern as the existing `workflowStaleness`.
  Covered by `test/doctor.test.js` integration tests (missing/built cases).
- [passed] AC-7 — `npm run generate:check` → "No drift — 13 skill(s) in sync."
  (re-run independently during this review, not just trusted from the
  Execution Report).
- [passed] AC-8 — 4 new tests in `test/skill-contract.test.js` cover cases
  (a)-(d) from the AC text; re-run independently, all green.
- [passed] AC-9 — 3 unit tests for `specIndexAdvisory` + 2 `doctorCommand`
  integration tests in `test/doctor.test.js`; re-run independently, all green.
- [passed] No changes outside allowed modules — `git diff --stat` against
  `skills/`, `src/`, `test/` shows only the files listed in the proposal's
  `## Impacted modules` (6 `canonical.md` + their derived `SKILL.md`,
  `src/cli/doctor.js`, `test/doctor.test.js`, `test/skill-contract.test.js`).
  No unrelated file touched.
- [passed] Conventions & quality gates respected — ESM, `node --test`, no
  explanatory comments (only a why-comment mirroring `workflowStaleness`'s own
  style). `node --check src/cli/doctor.js`, the two feature-test files,
  `npm run generate:check`, and the full `npm test` (339 tests) all pass,
  independently re-run in this review.

## Error cases

- [passed] EC-1 — covered by the new skill-contract tests: deleting any
  wiring (packet block, spec-index mention, spec-read example fix, runs path)
  fails the corresponding assertion by name.
- N/A EC-2 — pre-existing `generate:check` drift-detection mechanism, not
  introduced by this change; exercised (not broken) by AC-7's re-run.
- [passed] EC-3 — the fallback phrase "If `spec-index` or the lookup fails,
  full-read the spec and report why" is present verbatim in all 5 section-first
  skills (grep-verified).

## Security considerations

- [passed] SEC-1 — the only code change is the read-only `specIndexAdvisory`
  check (existence check on a local path under `cwd`, no I/O writes, no
  external input, no secrets). Confirmed by reading the full diff of
  `src/cli/doctor.js`: 18 lines added, all additive, no existing behavior
  altered.
- [passed] SEC-2 — `spec-read`'s confinement to `openspec/specs/**` is
  untouched by this change (no edits to `src/tokens/spec-index.js`); the
  fixed `spec-read` examples in `sdd-verify`/`sdd-commit` point to
  `openspec/specs/system.md#code-conventions`, not change artifacts.

## Issues found

None.
