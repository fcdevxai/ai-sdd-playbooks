---
schema: runtime-gate-report
schema_version: 2
change_id: identity-flags-and-test-isolation
status: not_applicable
created: '2026-10-10'
updated: '2026-10-10'
adapters:
  cli:
    status: not_applicable
    reason_code: NOT_RELEVANT_TO_CHANGE
    exclusion:
      reason: >-
        The change does not touch the playbook CLI surface. The proposal
        excludes CLI behavior, receipts, manifests, lifecycle rules and the
        usage string ("Constraints and non-goals") and declares
        runtime_relevant_capabilities: []. It changes skill text and the npm
        test command only; every criterion is declared non-runtime in tasks.md.
        The substitute evidence is a real npm test run through the new runner
        and a real CLI invocation that shows the CLI still validates this change
        unchanged.
      authority:
        repository: loom
        path: openspec/changes/identity-flags-and-test-isolation/proposal.md
        hash: dcf1a5181d681791ace333f8d28f6e34b28539b95f27e219de3f9aa3c8873f3b
      covered_criteria:
        - AC-3
        - AC-5
      substitute_receipts:
        - repository: loom
          path: .specloom/runs/1791643520115-48c6dfdf-8bs220/execution-receipt.json
          sha256: 67e4173dd39588a7a867f061b78c63a30128b099db49d1c24a81dcf86a6eaee8
        - repository: loom
          path: .specloom/runs/1791643735547-8bcdefad-hzOkyD/execution-receipt.json
          sha256: b06953d2a053a88a24fd6cdeb313fa8a79d79e3cdb86d56a5660e61e91fd145b
coverage: []
source_binding:
  manifest_path: >-
    openspec/changes/identity-flags-and-test-isolation/handoff-manifest-sdd-runtime-gate-cee3284aa0fb40a3cdfa3e0f000d0ca6560f4c9307746946c5f13c2a7cee7088.json
  manifest_hash: cee3284aa0fb40a3cdfa3e0f000d0ca6560f4c9307746946c5f13c2a7cee7088
  governed_manifest_hash: 10419a5df7e5ca413e46e2a6af1a243bd188c7cf4220d4948fe230a3d2473feb
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
      path: .specloom/runs/1791643520115-48c6dfdf-8bs220/execution-receipt.json
      sha256: 67e4173dd39588a7a867f061b78c63a30128b099db49d1c24a81dcf86a6eaee8
    - repository: loom
      path: .specloom/runs/1791643735547-8bcdefad-hzOkyD/execution-receipt.json
      sha256: b06953d2a053a88a24fd6cdeb313fa8a79d79e3cdb86d56a5660e61e91fd145b
  delivery_state: uncommitted
---
# Runtime Gate Report — Agent identity flags in skills and isolated test temporary directories

Reviewer: claude, provider anthropic, model claude-opus-5-5 (declared).

## browser, http, worker — not_applicable

- Capabilities `false` in `playbook.config.yaml`; non-blocking, so they are not required
  adapter entries in the frontmatter.

## cli — not_applicable (NOT_RELEVANT_TO_CHANGE)

- Why excluded: the proposal leaves the CLI out of scope and lists no runtime-relevant
  capability; all eleven criteria carry a non-runtime rationale in `tasks.md`. ADR-032 keeps the
  `cli` adapter experimental, so a relevant CLI capability would block; here it is not relevant.
- Substitute evidence:
  - `npm test` through `test/helpers/run-tests.js`, with a dedicated parent `TMPDIR`: 848 tests,
    840 pass, 0 fail, 8 todo, exit 0 (receipt `1791643520115-48c6dfdf-8bs220`). This is the real
    command the change modifies (AC-3: the runner runs the default file list; AC-5: exit code
    preserved). Afterwards the parent held no `playbook-test-run-*` root; the only entries were
    npm's `node-compile-cache` and two `playbook-skill-contract-*` directories dated
    2026-10-09 20:30, left by the task 1.1 red run that used `node --test` directly before the
    runner existed (not by this run).
  - `node bin/playbook.js validate identity-flags-and-test-isolation` from this branch: "All 10
    artifact(s) valid" (receipt `1791643735547-8bcdefad-hzOkyD`), showing the CLI behaves as
    before on this change.
- Findings: none.
