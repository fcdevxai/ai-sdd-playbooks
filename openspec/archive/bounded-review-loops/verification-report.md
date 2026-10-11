---
schema: verification-report
schema_version: 2
change_id: bounded-review-loops
status: passed
updated: '2026-10-11'
source_binding:
  manifest_path: >-
    openspec/changes/bounded-review-loops/handoff-manifest-sdd-verify-c99ae7f9a01ac0b244971b55e5ac0f77c7ca7d3ba53e2539c28cabfdb50042d5.json
  manifest_hash: c99ae7f9a01ac0b244971b55e5ac0f77c7ca7d3ba53e2539c28cabfdb50042d5
  governed_manifest_hash: 7d4028ac7a3e9c3e8371a22b270503d85d40a1da51321bc81a3bb8678ecc54f8
  repositories:
    - name: loom
      branch: bounded-review-loops
      commit_sha: 691b0314cb2e6e11e8349064f83cf6bf39c96b03
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
      path: .specloom/runs/1791750318091-fdc9e9a2-NdX5WV/execution-receipt.json
      sha256: f5144df13bbeb63e71ac82e7ffbbbaba27db47590a912a7fe54f00341abba1b8
    - repository: loom
      path: .specloom/runs/1791750319793-b530ef2c-46vF3e/execution-receipt.json
      sha256: 019f208a4ee25a1269b415de1804a05d52f646e5c8dee0ae89b01c302026c689
  delivery_state: merged
---
# Verification Report — Bounded review loops, bounded sensitive designs and a released global CLI

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any `SEC-N` without passing post-merge evidence → `status: failed`.
- Any blocking regression → `status: failed`.
- Never proceed to `sdd-archive` while `status: failed`.

Verified on the merged code: PR #29, merge commit `691b031` (tag `v0.11.0`), delivery `merged`.
Feature run: `.specloom/runs/1791750318091-fdc9e9a2-NdX5WV` (96 tests). Regression run: `.specloom/runs/1791750319793-b530ef2c-46vF3e` (855 tests, generate:check, validate --ci).

## Acceptance criteria

| # | Criterion | Test/Check | Result |
|---|---|---|---|
| AC-1 | Blocking rule in code review and security gate | `test/skill-contract.test.js` "bounded review rules survive skill generation" | passed |
| AC-2 | `## Follow-ups` section, never changes status | same test | passed |
| AC-3 | Code review failing conditions kept | same test | passed |
| AC-4 | One full + one delta round in three gates | same test | passed |
| AC-5 | Stop with convergence analysis, no third round | same test | passed |
| AC-6 | `## Review rounds` section; failing report without it = one full round | same test | passed |
| AC-7 | `sdd-apply` fixes only the round's blocking findings | same test | passed |
| AC-8 | Threat model and `NC-N` list in sdd-design; variants outside list are follow-ups | same test | passed |
| AC-9 | Numbered `## Amendments`, at most two | same test | passed |
| AC-10 | Runtime-gate exclusion recipe | same test | passed |
| AC-11 | Released-CLI rule in docs; README install source | `test/readme.test.js` (docs and install assertions) | passed |
| AC-12 | Advisory release-provenance warning in doctor | `test/doctor.test.js` (provenance and `doctorCommand` text/JSON tests) | passed |
| AC-13 | Contract tests exist and fail if rules are removed | the three test files above, 96 tests in the feature run | passed |
| AC-14 | 0.11.0 in package files, changelog and CI pins; npm test, generate:check, validate --ci | `test/readme.test.js` release test; regression run | passed |

## Error cases

| # | Error case | Test/Check | Result |
|---|---|---|---|
| EC-1 | git unavailable, failing or timing out: note, no warning | `test/doctor.test.js` EC-1 test | passed |
| EC-2 | HEAD without `v<version>` tag: warning names tags found and expected | `test/doctor.test.js` AC-12/SEC-4 test (`v0.10.2` vs `v0.11.0`) | passed |
| EC-3 | Unreproducible finding is a follow-up | `test/skill-contract.test.js` ("real code path", "synthetic fixture") | passed |

## Security considerations

| # | Control | Test/Check (negative, re-run post-merge) | Result |
|---|---|---|---|
| SEC-1 | Always-blocking classes never demoted to follow-ups | skill-contract test: "never demoted to follow-ups" and the five classes asserted | passed |
| SEC-2 | Round cap never clears a failing gate | skill-contract test: "failing status", "not sealed"; negative assertion against "seal a failing report" | passed |
| SEC-3 | Follow-ups recorded with owner and destination | skill-contract test: Follow-ups columns | passed |
| SEC-4 | git run with fixed args, no shell, timeout, no inherited `GIT_*` selectors | `test/doctor.test.js` "release provenance never passes inherited repository selectors to git (SEC-4, F-2)" and the argument-array assertions | passed |
| SEC-5 | Risk may raise, never lowers | skill-contract test: "may raise … never lowers" | passed |

## Regression

**Result**: `npm test` 855 tests, 0 failed; `npm run generate:check` clean; `node bin/playbook.js validate --ci` exit 0, all run on merge commit `691b031`. No blocking regression. Open non-blocking follow-ups from the reviews: F-1 (translated git adds an extra note), F-3 (no Follow-ups section in the runtime-gate template), F-4 (no place to record an authorized extra round); none affects an acceptance criterion.
