---
schema: code-review-report
schema_version: 2
change_id: identity-flags-and-test-isolation
status: passed
created: '2026-10-10'
updated: '2026-10-10'
source_binding:
  manifest_path: >-
    openspec/changes/identity-flags-and-test-isolation/handoff-manifest-sdd-code-review-aac29d6ee46c62cfb1f9b7554d715088ce182a7c52c68c943918f0773d7a4aa5.json
  manifest_hash: aac29d6ee46c62cfb1f9b7554d715088ce182a7c52c68c943918f0773d7a4aa5
  governed_manifest_hash: fca57fe3bc8460c0ca45e745f6bbb5c820ba6ce736d12d870924da3ecd1e7c81
  repositories:
    - name: loom
      branch: identity-flags-and-test-isolation
      commit_sha: 20c7248b72aba0c012aea80dba7bacdc492bfc70
      source_hash: 6e54a418f5f1aaa83e6a075c5a4a883ccfb4a3510652411af5ccfea8bced80d8
      tree_hash: 37323d1101847192fb02aef35cbc876a86d3e55be573c39b28d3411935114b5b
  proposal_hash: dcf1a5181d681791ace333f8d28f6e34b28539b95f27e219de3f9aa3c8873f3b
  design_hash: unknown
  normative_tasks_hash: 4f78b58495e6f9418fe2114a8ebfd4e7e3def41be60c5d999b13071fced409c2
  contract_hashes:
    - path: openspec/specs/contracts/openapi.yaml
      hash: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
  receipts:
    - repository: loom
      path: .specloom/runs/1791643355889-41902048-HZfak4/execution-receipt.json
      sha256: 014ff38b5ad4a5da715fbfc96d856e7ddbbe1d4415d7d1a278c506e05ceca108
    - repository: loom
      path: .specloom/runs/1791643357492-c924f7b8-01qpDt/execution-receipt.json
      sha256: d3e5536d01912134fd93cfed18ca63c38272f92792ff9832ffef8e762c773419
    - repository: loom
      path: .specloom/runs/1791643358249-6d6ee439-YCGgQx/execution-receipt.json
      sha256: 37bb38f8cb148fba1d6c0100a4c13bc09f5a41a1d0055ea1c5c8d97fce52e967
  delivery_state: uncommitted
---
# Code Review Report — Agent identity flags in skills and isolated test temporary directories

Reviewer: claude, provider anthropic, model claude-opus-5-5 (declared). Same session that
implemented the change; not an independent review.

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- Do not suggest improvements outside spec scope.

## Scope of the review

This branch is stacked on `merged-delivery-identity` (commit `20c7248`, `0.10.1`). `playbook
changed-files` compares against `main` (`v0.10.0`) and therefore also lists the `0.10.1` files
(`src/github/*`, `src/tokens/equivalence.js`, `test/delivery.test.js`,
`test/post-merge-delivery.test.js`, `openspec/specs/cli/spec.md`,
`openspec/changes/merged-delivery-identity/*`); those belong to that change and its own
closure review. This review covers `git diff 20c7248` plus the untracked files of this change.

## Checklist

- [passed] AC-1 covered by `test/skill-contract.test.js` "every skill command that names --agent also passes --provider and --model, with the identity rule (AC-1, AC-2, SEC-2)": all seven skills show the three flags in every inline `playbook packet` / `playbook run` command, and each states the identity rule once. No skill has these commands inside fenced code blocks, so the inline-span scan sees every invocation.
- [passed] AC-2 covered by the same test over `canonical.md` and `SKILL.md`, and `npm run generate:check` (no drift, receipt `1791643357492-c924f7b8-01qpDt`).
- [passed] AC-3 covered by runner tests "AC-3: …" (fresh root under the inherited `TMPDIR`; default list = `test/*.test.js` only).
- [passed] AC-4 covered by the apply leftover check (task 2.3): a full `npm test` leaves nothing created by the run; the only entry is `node-compile-cache`, created by npm itself.
- [passed] AC-5 covered by runner test "AC-5: …" (file arguments forwarded, exit status preserved).
- [passed] AC-6 covered locally by full runs on Node 18.20.8 and 20.20.2 through the runner; `.github/workflows/tests.yml` unchanged. The pull-request CI matrix is the final confirmation.
- [passed] EC-1 covered by runner test "EC-1: …".
- [passed] EC-2 covered by runner test "EC-2: SIGTERM …" (the runner is the group leader of a detached child group and forwards the signal; it ends with `SIGTERM`).
- [passed] EC-3 covered by runner test "EC-3: …" (exit 2 with "cannot create the test temporary root", no test runs).
- [passed] SEC-1 covered by runner test "SEC-1: …": `removeRunRoot` refuses paths outside the parent, the parent itself, unrelated children, nested roots, a symbolic link carrying the prefix, traversal and `/`; the root removed is always the one returned by `fs.mkdtempSync`, never a path from arguments or environment.
- [passed] SEC-2: the identity rule says the values are declared by the caller, never observed by the CLI; no CLI, receipt or manifest code changed.
- [passed] No changes outside allowed modules: skills (seven `canonical.md` + generated `SKILL.md`), `test/helpers/run-tests.js`, `test/run-tests.test.js`, `test/skill-contract.test.js`, `package.json` (`scripts.test`, version), `package-lock.json` (version), `docs/doc_verification_guide.md`, `README.md`, `CHANGELOG.md`, and this change's artifacts. No CLI, receipt, manifest, lifecycle or evidence code changed; the CI workflow is unchanged.
- [passed] Conventions & quality gates respected: ESM, no new dependency, `node --test` kept as the framework (`AGENTS.md`, `openspec/specs/system.md` remain accurate); skills edited only in `canonical.md` and regenerated. Review runs: feature tests 72 pass (`1791643355889-41902048-HZfak4`), `generate:check` (`1791643357492-c924f7b8-01qpDt`), `git diff --check` clean (`1791643358249-6d6ee439-YCGgQx`). Apply gates: `node --check` ×3, full `npm test` 848 tests / 0 fail / 8 todo (`1791589483521-c71af14d-KQUpdq`).

## Stale-reference sweep

`node --test test/<file>` no longer appears as an instruction outside historical decision
records (ADRs and audits describe the framework, which is unchanged). No template or skill
shows `--agent <agent>` without `--provider` and `--model`.

## Issues found

None blocking.

### Note 1 — duplicate finish call is harmless
- **File**: `test/helpers/run-tests.js:78-79`
- **Observation**: if the child emits both `error` and `exit`, `finish` runs twice; the second
  `removeRunRoot` finds no root (no-op) and the second `resolve` is ignored. No action needed.
