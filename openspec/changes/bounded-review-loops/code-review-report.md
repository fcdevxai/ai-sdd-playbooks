---
schema: code-review-report
schema_version: 2
change_id: bounded-review-loops
status: passed
updated: '2026-10-11'
source_binding:
  manifest_path: >-
    openspec/changes/bounded-review-loops/handoff-manifest-sdd-code-review-1409c92d95cbcfde7626611b86bc98099d13ee042c2e693014f2b6ac86125cc3.json
  manifest_hash: 1409c92d95cbcfde7626611b86bc98099d13ee042c2e693014f2b6ac86125cc3
  governed_manifest_hash: 4dc792c787e17997bb39077ca81afc297be14879cb17ba323dc2e010acca11fb
  repositories:
    - name: loom
      branch: bounded-review-loops
      commit_sha: 749bc97cede527899499a796505801c6060adedc
      source_hash: bf1752a93a0d95e5d9986f9698001592d1ba7f2304fd8557d04b43aeac7bb445
      tree_hash: 08506e2484d23cab7966e6e51da8c33c873d407ba6159ba258138bbe87605954
  proposal_hash: 65fc6807733cc85c8f48f73ee25b071efc5a8400a1eed084ca94cfc96054ec41
  design_hash: unknown
  normative_tasks_hash: 4cf491efd4a5ceb78e989af8f78976f7474ae433606d5960bc0cf64224cd1f5a
  contract_hashes:
    - path: openspec/specs/contracts/openapi.yaml
      hash: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
  receipts:
    - repository: loom
      path: .specloom/runs/1791747662409-3cdf4327-nz6BPk/execution-receipt.json
      sha256: 3c4858678b06a4f1f3259de49d80eb37050e24e414938ee0a6bf995c68255464
    - repository: loom
      path: .specloom/runs/1791747670424-fe08bd9e-AyK2Yj/execution-receipt.json
      sha256: f9ec8a083b888f845f4e79e39dbfb79ca7ecdd98cebb49a78568ea0577b8107a
  delivery_state: uncommitted
---
# Code Review Report — Bounded review loops, bounded sensitive designs and a released global CLI

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- Do not suggest improvements outside spec scope.

Reviewed with the released global CLI and skills (`playbook` 0.10.2), not with the
skill text this change introduces. The new blocking rule was still used to sort the
non-blocking observations below into follow-ups, because it does not lower any
failing condition of the 0.10.2 skill.

## Checklist

- [passed] AC-1 covered by `test/skill-contract.test.js` ("bounded review rules survive skill generation"): three-condition blocking rule (checklist item or `AC-N`/`EC-N`/`SEC-N`, realistic scenario in the declared threat model, reproduction in the real code path, synthetic fixture insufficient) in `sdd-code-review` and `sdd-security-gate`, canonical and generated.
- [passed] AC-2 covered by the same test: `## Follow-ups` in both report templates with finding, unmet condition, owner, destination; "never change the report status"; the security template also keeps severity (SEC-3).
- [passed] AC-3 covered by the same test: the three existing failing conditions remain in `sdd-code-review` and are restated as blocking regardless of classification.
- [passed] AC-4 covered by the same test: one full round plus one delta round, delta limited to prior blocking findings (runtime: failed or blocked adapters and criteria) and the fix diff, new findings block only when they meet the rule and the fix diff caused them — in all three gates.
- [passed] AC-5 covered by the same test: stop without a third round, failing status kept and not sealed, convergence analysis with the five columns, the three human options.
- [passed] AC-6 covered by the same test: `## Review rounds` table with the six columns in the three templates; a failing report without it counts as one full round.
- [passed] AC-7 covered by the same test: `sdd-apply` fixes only the round's blocking findings, does not widen scope, stops for a human decision; the 2-retry TDD cap is still asserted.
- [passed] AC-8 covered by the same test: `sdd-design` threat model (actors in scope, what they can do, out of scope) and closed `NC-N` list mapped to `SEC-N` when `security.risk: elevated`, any `security.triggers` or `threat_model_required: true`; both review gates treat a variant outside `NC-N` as a follow-up unless an always-blocking defect is present or the threat model is wrong, and then stop and ask the human.
- [passed] AC-9 covered by the same test: `## Amendments` (`A-N`: date, reason, decision, human approver), at most two, a third goes to a new change; draft edits stay free.
- [passed] AC-10 covered by the same test: exclusion recipe with `NOT_RELEVANT_TO_CHANGE`, specific reason, proposal path and hash from the handoff, `covered_criteria` with every mapped criterion, `substitute_receipts` from real runs, disabled capabilities omitted, no other reason code. Cross-checked against the validator in `src/lifecycle/runtime-coverage.js` (exclusion fields under `exclusion:`, which the report template already shows): the recipe matches what the validator requires.
- [passed] AC-11 covered by `test/readme.test.js` ("methodology docs require a released global CLI and isolated change worktrees", install assertion now `github:fcdevxai/ai-sdd-playbooks#semver:`).
- [passed] AC-12 covered by `test/doctor.test.js` (three new tests, including `doctorCommand` text and `--json` with `healthy: true` and `EXIT.OK`). Also reproduced in the real code path with real `git`, outside the injected runner: this dirty worktree gives the warning; a non-repository directory gives nothing; a clone tagged `v0.11.0` and clean gives nothing; the same clone with an untracked file gives the warning; once that file is ignored, nothing again. Round 2 repeated these real-git runs after the F-2 fix with the same results, and also ran the whole `node bin/playbook.js doctor --cwd . --json` with `GIT_DIR` pointing to another checkout: the warning names this worktree (`749bc97`, no tags, uncommitted changes), `healthy: true`, exit 0, as without `GIT_DIR`.
- [passed] AC-13: skill contract test asserts AC-1 to AC-10 on canonical and generated text; doctor tests use an injected runner; red-first evidence recorded in `tasks.md` (`.specloom/runs/1791741066426-2b77b283-jhvTGi/full.log`, the doctor test failing before `releaseProvenance` existed).
- [passed] AC-14 covered by `test/readme.test.js` ("release version, changelog and CI pins agree at 0.11.0") plus the regression run below.
- [passed] EC-1 handled in `src/cli/doctor.js` (`releaseProvenance`, both `catch` branches: timeout, `ENOENT`, other failure → note, no warning); unit test covers the timeout; real run with `git` absent from `PATH` gave `note: "release provenance could not be checked: git unavailable"` and no warning.
- [passed] EC-2 covered by `test/doctor.test.js` (`tags: ['v0.10.2']` → warning names `v0.10.2` and `v0.11.0`).
- [passed] EC-3 covered by the skill contract test (`real code path`, `synthetic fixture`); the security-gate text keeps the always-blocking exception.
- [passed] SEC-1, SEC-2, SEC-3, SEC-5 covered by the skill contract test (always-blocking classes listed and "never demoted to follow-ups"; "not sealed"; follow-ups with owner, destination and severity; "may raise … never lowers"). Final judgment of `SEC-N` belongs to `sdd-security-gate`.
- [passed] SEC-4 as specified by the tasks: `execFileSync` with a fixed argument array, no shell, `timeout: 2000`, `GIT_ENV`, `cwd: PACKAGE_ROOT`; the doctor test asserts the exact four argument arrays, the `cwd` and the timeout. Since round 2, the git calls also drop every inherited `GIT_*` variable except `GIT_NO_REPLACE_OBJECTS` (`src/cli/doctor.js:133`), so no environment variable can choose the inspected repository; the negative test "release provenance never passes inherited repository selectors to git (SEC-4, F-2)" (`test/doctor.test.js:112`) failed before the fix (`.specloom/runs/1791747231529-247a74d6-cTUfi7/full.log`) and passes now.
- [passed] No changes outside allowed modules: every changed file is listed in `## Impacted modules`; `src/lifecycle/**`, `src/schema/**` and `schemas/**` are untouched; `src/cli/doctor.js` is the only source file changed.
- [passed] Conventions & quality gates respected: canonical edits regenerated (`npm run generate:check` clean); syntax checks, feature tests and the full regression executed (receipts below).

## Quality commands executed

Round 2 (sealed receipts):

- Syntax checks + feature tests (96 tests, 0 failed): `.specloom/runs/1791747662409-3cdf4327-nz6BPk/execution-receipt.json`
- Regression — `npm test` (855 tests, 0 failed) and `npm run generate:check`: `.specloom/runs/1791747670424-fe08bd9e-AyK2Yj/execution-receipt.json`
- `node bin/playbook.js validate --ci` before resealing: exit 1 with a single invalid artifact, this report's round-1 seal ("repository source changed: loom"), which is the expected effect of the F-2 source change (`.specloom/runs/1791747911797-2c1cb05f-xZT8Gi/full.log`). It is rerun after this report is resealed.

Round 1 (superseded by the F-2 source change): `.specloom/runs/1791746404715-0f5fef23-Sgvwxd/execution-receipt.json` (95 tests) and `.specloom/runs/1791746408806-ade28d26-yG2YXy/execution-receipt.json` (854 tests, `generate:check`, `validate --ci` exit 0).

## Round 2 — re-check of the F-2 fix

Scope limited to the fix diff, which the other session applied after round 1: the
`GIT_*` filter in `releaseProvenance` (`src/cli/doctor.js:133-135`), the negative test at
`test/doctor.test.js:112` with its `GIT_ENV` import, and the F-2 lines in the `tasks.md`
Execution Report. `proposal.md` is unchanged (hash `65fc6807…`); no other source file
changed. The filter only narrows the environment passed to the four fixed git calls:
arguments, `cwd`, timeout, `GIT_NO_REPLACE_OBJECTS` and output shape are unchanged, so
AC-12, EC-1, EC-2 and SEC-4 keep their evidence (unit tests plus the real-git runs
above). The test changes `GIT_ENV` and restores it in `finally`. No new finding.

## Issues found

None blocking.

## Follow-ups

| finding | unmet condition | owner | destination (new change, issue, accepted as-is) |
|---|---|---|---|
| F-1 — With a translated `git` (for example `LANG=es_*` with git translations installed), the "not a git repository" message no longer matches `/not a git repository/i`, so a package install (not a checkout) would show the note "release provenance could not be checked: git failed (128)" instead of staying silent. No warning and no exit-code change, so AC-12 still holds; only the edge case "a package install shows nothing" degrades into one extra note. Possible fix: run the provenance `git` calls with `LC_ALL=C`. | Not reproduced in the real code path: this machine has no git translations installed. | Methodology maintainer | Issue or small follow-up change (still open after round 2: the F-2 filter does not set `LC_ALL`) |
| F-2 — `GIT_ENV` inherits the caller's environment, so an exported `GIT_DIR` (as git does inside hooks run from a linked worktree) makes git inspect that repository instead of the package root. Reproduced with real git: `GIT_DIR=<this worktree's .git> node -e releaseProvenance({ root: <non-repo dir> })` returned a warning with this worktree's commit and dirty state for a directory that is not a checkout. Effect is limited to advisory text (no exit-code change; only commit, tag names and a changes flag of a repository the same user already reads). Possible fix: drop `GIT_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` and `GIT_COMMON_DIR` from the environment of these calls. | Not a realistic scenario within the declared threat model for this review: requires running `playbook doctor` with git's repository variables exported (inside a git hook or script). Relates to SEC-4 ("never from … environment variables"), so `sdd-security-gate` must judge it. | `sdd-security-gate` (next stage), then methodology maintainer | **Resolved in this change before round 2**: `GIT_*` variables are filtered (`src/cli/doctor.js:133`) and covered by the negative test at `test/doctor.test.js:112`; no follow-up remains |
| F-3 — `sdd-runtime-gate` says new non-blocking delta findings "go to follow-ups with an owner and destination", but its report template has no `## Follow-ups` section (AC-2 only requires it for the other two reports). | No criterion requires it; not a defect against this proposal. | Methodology maintainer | Accepted as-is for 0.11.0; add the section in the next skill change |
| F-4 — The proposal edge case "a human authorizes another round after a stop: the report records the authorization" is not stated in any of the three skills; they ask the human but do not say where to record the authorization. | Edge cases are not acceptance criteria; the `## Review rounds` table already records every round. | Methodology maintainer | Accepted as-is for 0.11.0; add one sentence in the next skill change |

## Review rounds

| round | full or delta | date | commit reviewed | blocking findings | result |
|---|---|---|---|---|---|
| 1 | full | 2026-10-11 | `749bc97` + uncommitted working tree of `bounded-review-loops` | 0 | passed |
| 2 | delta (rerun because the F-2 fix changed source after round 1 was sealed; scope: the fix diff) | 2026-10-11 | `749bc97` + uncommitted working tree including the F-2 fix | 0 | passed |
