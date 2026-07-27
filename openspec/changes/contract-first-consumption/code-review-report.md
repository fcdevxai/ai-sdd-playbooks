---
schema: code-review-report
schema_version: 1
change_id: contract-first-consumption
status: passed
updated: 2026-07-27
---
# Code Review Report — Cerrar el circuito de contract-first: autoría → consumo → multi-repo

## Checklist

- [passed] AC-1 — three-condition guard (`impact.public_contract`, `contract.path_in_loom`,
  `capabilities.http`) in `skills/sdd-design/canonical.md`, covered by
  `test/skill-contract.test.js`
- [passed] AC-2 — declared skip in `design.md` `## Public contracts / interfaces` for both
  skip cases ("never silent"), covered by `test/skill-contract.test.js`
- [passed] AC-3 — `playbook.config.yaml` added to `sdd-design`'s `## Context`, covered by
  `test/skill-contract.test.js`
- [passed] AC-4 — advisory `notices` channel in `src/cli/validate.js`, exit code unaffected,
  covered by `test/contract-first.test.js`
- [passed] AC-5 — schema accepts `contract.provided_by`/`consumed_by`, back-compat asserted,
  unknown-repo cross-check blocks with a named error, covered by `test/contract-first.test.js`
- [passed] AC-6 — `sdd-plan` plans against contract endpoints when applicable, covered by
  `test/skill-contract.test.js`
- [passed] AC-7 — `sdd-apply` distinguishes provider (must-fulfill) vs consumer
  (available-to-call, incl. error codes), covered by `test/skill-contract.test.js`
- [passed] AC-8 — `sdd-plan`/`sdd-apply` read by path, never copy, covered by
  `test/skill-contract.test.js`
- [passed] AC-9 — packet carries `## Contract` + `sources.contract`, byte-identical without
  a contract, staleness on topology change, covered by `test/tokens.test.js`
- [passed] AC-10 — `role: impacted` removed from template, uncommented multi-repo block
  passes `playbook validate`, covered by `test/contract-first.test.js`
- [passed] AC-11 — template documents `provided_by`/`consumed_by` coherently with its own
  `repos:` example, covered by `test/contract-first.test.js`
- [passed] SEC-1/EC-1 — `path_in_loom` escape (`..`, absolute, symlink) rejected via
  `resolveContainedPath` before any read; reused, not reimplemented
- [passed] SEC-2/EC-2 — unknown repo name in `provided_by`/`consumed_by` fails via
  `resolveConfiguredRepoPath` without touching the filesystem
- [passed] No files changed outside `## Impacted modules` (proposal.md) beyond the natural
  test-file and `src/cli/packet.js` companions to the modules listed
- [passed] Conventions & quality gates respected — CLI/domain split honored
  (`src/tokens/packet.js` never imports `loadConfig`), `node --test` (120/120),
  `npm test` (430/430), `npm run generate:check` (no drift)

## Issues found

### Issue 1 — `context-packet.md`'s "Files touched" silently drops a touched file when a task's `**Files**:` label wraps to a second line

- **File**: `openspec/changes/contract-first-consumption/tasks.md:34-35` (and the same
  pattern at the `**Files**:` lines of Task 4.1, 4.2, 4.3), surfaced via
  `src/util/markdown.js`'s `extractLabeledTokens`
- **Problem**: `extractLabeledTokens` matches `FILES_LABEL_RE` line-by-line
  (`content.split('\n')`), so when a `**Files**:` entry wraps onto a continuation line —
  as it does for Tasks 4.1, 4.2, and 4.3, each of which lists
  `` `test/skill-contract.test.js` `` on the line *after* the other two files — only the
  first line is captured. The result: `context-packet.md`'s `## Files touched` (regenerated
  and checked into this change) omits `test/skill-contract.test.js` entirely, even though
  it's a real, substantially-changed file (86 lines per `git diff --stat`) and the primary
  evidence source for AC-1, AC-2, AC-3, AC-6, AC-7, and AC-8. The omission is silent — the
  only existing guard (`files.length === 0`) fires on a fully-empty list, not a
  partially-truncated one. This directly undermines the packet's stated purpose: this very
  skill (`sdd-code-review`) is instructed to read `context-packet.md` *instead of*
  proposal.md+tasks.md and scope file reads from its "Files touched" list — a reviewer
  trusting that list at face value would skip `test/skill-contract.test.js` entirely.
- **Suggested fix**: either (a) reformat the three wrapped `**Files**:` lines in
  `tasks.md` to a single line each (lowest-risk, in-scope for this change since it already
  edits `tasks.md`), or (b) fix `extractLabeledTokens` to join a label's wrapped
  continuation line(s) before matching — out of scope for *this* change's declared files,
  so would need its own change/task if pursued, but is the durable fix since any future
  tasks.md with a long files list will hit the same silent truncation.

## Notes

- `context-packet.md`'s `sources` hashes match the current `proposal.md`/`tasks.md` bytes —
  the packet is not stale.
- `design.md` and `proposal.md` are both `status: approved`; the two ADR drafts
  (`adr-contract-roles-read-from-hub.md`, `adr-contract-trigger-scoped-to-http.md`) are
  `status: proposed` and consistent with the shipped code, ready for `sdd-archive` to
  promote.
- The overall status is `passed` because Issue 1 doesn't fail any `AC-N`, doesn't touch a
  file outside declared scope, and doesn't skip a required quality gate — it's a
  pre-existing extractor limitation surfaced by this change's own `tasks.md` formatting.
  Recommend fixing it (option a above) before `sdd-archive`, since it would otherwise ship
  a permanently-incomplete `context-packet.md` for this change.
