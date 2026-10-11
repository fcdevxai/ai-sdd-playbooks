---
schema: runtime-gate-report
schema_version: 2
change_id: bounded-review-loops
status: not_applicable
updated: '2026-10-11'
adapters:
  cli:
    status: not_applicable
    reason_code: NOT_RELEVANT_TO_CHANGE
    exclusion:
      reason: >-
        The proposal declares runtime_relevant_capabilities: [] and keeps cli
        excluded under the ADR-032 criterion (playbooks spec, "The cli runtime
        adapter is excluded"). The only observable CLI change is an advisory
        release-provenance warning in playbook doctor, which ADR-032 covers with
        a unit test failing against the pre-change code plus a recorded
        invocation before and after the change; both are attached here.
      authority:
        repository: loom
        path: openspec/changes/bounded-review-loops/proposal.md
        hash: 65fc6807733cc85c8f48f73ee25b071efc5a8400a1eed084ca94cfc96054ec41
      covered_criteria:
        - AC-12
        - EC-1
        - EC-2
        - SEC-4
      substitute_receipts:
        - repository: loom
          path: .specloom/runs/1791749330203-30c3c1ea-e4qWWz/execution-receipt.json
          sha256: 7fec339b0f17d535de4960feee0ea8eb8695020773ad15ef74399efca9101d27
        - repository: loom
          path: .specloom/runs/1791749331125-724e3099-ztPRhb/execution-receipt.json
          sha256: 6f8e9a7204e526d16dbc923ce1748232d94cbdeb1344a4efe8547f5e83dba5a9
        - repository: loom
          path: .specloom/runs/1791749332064-a36d2ff6-0EV8cC/execution-receipt.json
          sha256: 46272d63f06836dbecefbfb83ed4860aa3a9ac16859f9d96bb4eebf369aba60b
coverage: []
source_binding:
  manifest_path: >-
    openspec/changes/bounded-review-loops/handoff-manifest-sdd-runtime-gate-3b3092bf17757d771b1beb29b2044980bc7e5e4b8d9a182783b7f42fa2e7342c.json
  manifest_hash: 3b3092bf17757d771b1beb29b2044980bc7e5e4b8d9a182783b7f42fa2e7342c
  governed_manifest_hash: 3bff49dde9a8e3f564f1a9fd6d34d6405bce90b4c86b7f69bad17b22021325c6
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
      path: .specloom/runs/1791749330203-30c3c1ea-e4qWWz/execution-receipt.json
      sha256: 7fec339b0f17d535de4960feee0ea8eb8695020773ad15ef74399efca9101d27
    - repository: loom
      path: .specloom/runs/1791749331125-724e3099-ztPRhb/execution-receipt.json
      sha256: 6f8e9a7204e526d16dbc923ce1748232d94cbdeb1344a4efe8547f5e83dba5a9
    - repository: loom
      path: .specloom/runs/1791749332064-a36d2ff6-0EV8cC/execution-receipt.json
      sha256: 46272d63f06836dbecefbfb83ed4860aa3a9ac16859f9d96bb4eebf369aba60b
  delivery_state: uncommitted
---
# Runtime Gate Report — Bounded review loops, bounded sensitive designs and a released global CLI

Reviewer: claude, provider anthropic, model claude-opus-5-5 (declared).

## browser, http, worker — not_applicable

- Capabilities `false` in `playbook.config.yaml`; omitted from the frontmatter.

## cli — not_applicable (NOT_RELEVANT_TO_CHANGE, ADR-032)

- Before: released global `playbook doctor --cwd .` (0.10.2): healthy, no release-provenance warning (`.specloom/runs/1791749330203-30c3c1ea-e4qWWz/full.log`).
- After: `node bin/playbook.js doctor --cwd .` from this worktree: healthy, exit 0, with the warning "release provenance: … expected v0.11.0; uncommitted changes: true" (`.specloom/runs/1791749331125-724e3099-ztPRhb/full.log`).
- Unit tests: 26 doctor tests pass, including AC-12, EC-1, EC-2 and the SEC-4/F-2 negative test (`.specloom/runs/1791749332064-a36d2ff6-0EV8cC/full.log`); red-first evidence is recorded in `tasks.md`.
- Findings: none.

## Review rounds
| round | full or delta | date | commit reviewed | blocking findings | result |
|---|---|---|---|---|---|
| 1 | full | 2026-10-11 | `749bc97` + uncommitted working tree | 0 | not_applicable |
