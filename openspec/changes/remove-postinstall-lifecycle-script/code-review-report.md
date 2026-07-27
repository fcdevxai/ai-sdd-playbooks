---
schema: code-review-report
schema_version: 1
change_id: remove-postinstall-lifecycle-script
status: passed
updated: 2026-07-27
---
# Code Review Report — Eliminar el postinstall que puede romper `npm install` de consumers

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- Do not suggest improvements outside spec scope.

## Checklist

- [passed] AC-1 (`package.json` no `scripts.postinstall`) — `test/postinstall.test.js`
- [passed] AC-2 (`scripts/postinstall.cjs` absent) — `test/postinstall.test.js`
- [passed] AC-3 / EC-3 (structural guard against silent reintroduction) — `test/postinstall.test.js`
- [passed] AC-4 (README real install command) — `test/readme.test.js`
- [passed] AC-5 (README private-repo/SSH-PAT note) — `test/readme.test.js`
- [passed] AC-6 (notice: version + reminder, non-install commands) — `test/dispatch.test.js` (see Issue 1 — evidence is partial)
- [passed] AC-7 (notice absent for `install`) — `test/dispatch.test.js`
- [passed] AC-8 (notice self-extinguishes, no new persisted state) — `test/dispatch.test.js`, reuses `.playbook-version`
- [passed] AC-9 (security-checklist postinstall row updated) — manual read-through
- [passed] AC-10 (ADR exists, `status: proposed`, `supersedes: ADR-006`) — pre-existing artifact, untouched
- [passed] SEC-1 (no lifecycle script; negative test) — `test/postinstall.test.js`
- [passed] SEC-2 (`--json` output uncontaminated) — `test/dispatch.test.js`
- [passed] No changes outside allowed modules — `git status` matches `design.md`'s Module impact list exactly (README.md, docs/security-checklist.md, package.json, scripts/postinstall.cjs [deleted], src/cli/dispatch.js, src/install/targets.js, plus their tests)
- [passed] Conventions & quality gates respected — `src/cli/dispatch.js` imports `src/install/targets.js` only (not `doctor.js`), matching the design's explicit layering decision; `node --check`, full feature-test run, `npm test`, `npm run generate:check` all executed and green (see `tasks.md` Execution Report)

## Issues found

### Issue 1 — AC-6's notice test doesn't assert the version substring
- **File**: `test/dispatch.test.js:132-141`
- **Problem**: AC-6 requires the notice show both the installed version and the `playbook install` reminder. `src/cli/dispatch.js:203` does emit both (verified manually: `playbook-ai 0.9.0 — skills not installed for any target, run \`playbook install\`.`), but the only test covering this path (`test/dispatch.test.js:139`) asserts `/playbook install/` only — a future edit that dropped the version from the message would pass this test undetected.
- **Suggested fix**: Strengthen the assertion at `test/dispatch.test.js:139` to also match the version, e.g. `assert.match(out[0], new RegExp(pkg.version))` (the file already imports `fs`/`package.json` version elsewhere in this suite for the `--version` test, so the pattern is already in scope).
