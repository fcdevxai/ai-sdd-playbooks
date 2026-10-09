---
sources:
  proposal: a87862bde32cc386e4cc7ade48971a00e6bdaab1b0448631d0cd085d63a93fce
  tasks: ceaa0d1f8f281ee4d78d81f49f038f9c66477065902091a8d334e5ddbf06f972
  contract: 2260109d99574a48c6b6a511d5963f4425e30b430daa082a75e3a115f9aaf70c
  contract_content: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
---
# Context Packet — Evidence-preserving, source-bound SDD harness

## Ticket

harness-trust-restoration

## Acceptance criteria

- **AC-1:** F06 canaries cover success, recognized failure, previously unrecognized failure, warning-only success, skipped/incomplete tests, `rtk proxy`, and Playbook-wrapped execution. Exit codes, important output and lossless RAW behavior are preserved; optimizer responses contain no permission decision.
- **AC-2:** `playbook run` preserves test/assertion counts, warnings, skipped/incomplete state and relevant diagnostics in useful compact summaries; full raw evidence is retained and audit mode is lossless. The child command's exit code is preserved rather than converted to generic exit `1`. Interoperation with independently owned global hooks and RTK is validated without relying on hook ordering.
- **AC-3:** A versioned handoff references requirement/spec, AC/EC/SEC, repositories/branches/SHAs, design/tasks/contracts/architecture content hashes, skills/tools, risks/blockers, producer identity and timestamp. Referenced canonical artifacts need not be duplicated in full.
- **AC-4:** Contract byte mutation invalidates packet/handoff freshness. Required manifest fields, unresolved required references, escaping paths and broken links are rejected.
- **AC-5:** Receipts record agent, provider/model availability and provenance, stage/change/spec identity, repository/branch/commit, governed artifact hashes, command, bounded environment, exit status, summary, raw-evidence reference and timestamps. Unknown identity generates an explicit validation issue.
- **AC-6:** Required verification reports, manifests and an evidence index/raw evidence bundle survive change-folder cleanup; archive cannot delete the only closure proof.
- **AC-7:** All applicable adapters are present, nonempty, evidence-bearing and passed, or explicitly excluded with a validated rationale. Relevance combines configured adapters, affected-repository capabilities and explicit criterion/task mappings; an ambiguous relevance mapping blocks instead of guessing.
- **AC-8:** Gate freshness detects relevant commit/source changes and contract/artifact mutation. Receipt generation itself does not create a circular self-hash dependency; evidence-only artifacts are not governed application source.
- **AC-9:** Verification requires unanimous merged delivery for impacted repositories. Archive requires current valid post-merge verification; `pr_open` plus `verification: passed` never leads to archive.
- **AC-10:** Negative tests reject missing adapters, empty/fabricated reports, invalid exclusions, stale commits, changed contracts, pre-merge verification, archive with an open PR, conflicting repository delivery states and incomplete handoffs.
- **AC-11:** Generic targeted regressions, the complete methodology suite, schema checks and generation validation precede propagation. Supported `playbook install` updates both agent targets, and consuming Hub doctor/validate/status/next plus changed-command canaries pass. No unrelated user changes, invented version bumps or undocumented lock changes.

## Constraints and non-goals

Do not touch user-modified `src/repos/classify.js`, `src/repos/plan.js` or `test/repos.test.js`. Do not alter product behavior, dependencies or deferred findings F07–F14. Implement F06 first; wait for the intervening consumer waves before F04/F05 activation. Edit canonical skill sources, not generated skills by hand. No HTTP OpenAPI authoring: this contract is CLI/artifact-based. The existing experimental CLI adapter remains blocked where applicable; use the methodology's approved real-CLI evidence convention rather than marking an unsupported adapter passed. No completion/merge/archive claim without the existing gates.

## Security considerations

- **SEC-1:** No output hook emits `permissionDecision: allow`, `ask`, `deny` or `defer` for optimization. Existing independent authorization controls remain intact.
- **SEC-2:** Read canonical references through existing contained-path/symlink safety controls. Do not read arbitrary secret files to build a manifest.
- **SEC-3:** Environment/identity recording is allowlisted metadata only; no wholesale environment, credential, payload or raw sensitive application logging. Raw evidence is private and fixtures synthetic; sensitive evidence must not be committed automatically.
- **SEC-4:** Artifact/schema migration is explicit, versioned and fail-closed. Legacy inspection support cannot silently grant new completion eligibility; no project-specific exception may bypass generic invariants. Do not deploy a change that unexpectedly invalidates other active consumers.
- **SEC-5:** Evidence presence/hashes demonstrate provenance and consistency, not the truth of arbitrary claims. Required observations and criterion mappings remain reviewable; validators reject empty structural evidence rather than claiming they can authenticate a fabricated real-world event.
- **SEC-6:** No automated push, merge, approval or irreversible external runtime effect. Integration tests run in isolated temporary repositories.

## Files touched

- `change execution evidence; isolated worktree.`
- `test/tokens.test.js`
- `src/cli/run.js`
- `src/tokens/run.js`
- `src/repos/gate-check.js`
- `English execution evidence under this change.`
- `new handoff/receipt/binding/closure schemas and relevant existing schemas; schema tests.`
- `src/tokens/packet.js`
- `src/cli/packet.js`
- `src/cli/dispatch.js`
- `skills/sdd-archive/canonical.md`
- `src/adapters/index.js`
- `src/cli/validate.js`
- `src/cli/status.js`
- `src/lifecycle/preconditions.js`
- `src/lifecycle/engine.js`
- `skills/*/canonical.md`
- `SKILL.md`
- `test/skill-contract.test.js`
- `focused tests and English execution evidence.`
- `execution evidence and supported installed skill targets after impact review.`
- `src/tokens/evidence.js`
- `test/source-snapshot.test.js`
- `test/handoff.test.js`
- `test/handoff-schema.test.js`
- `methodology and consumer execution evidence`
- `generated handoffs`
- `supported local installation state only.`
- `openspec/changes/harness-trust-restoration/design.md`
- `src/tokens/receipt.js`
- `src/tokens/retention.js`
- `test/receipt.test.js`
- `test/evidence-run.test.js`
- `test/lifecycle-cli.test.js`
- `src/tokens/capture.js`
- `src/lifecycle/runtime-coverage.js`
- `test/runtime-coverage.test.js`
- `src/lifecycle/eligibility.js`
- `schemas/runtime-gate-report.schema.json`
- `skills/sdd-runtime-gate/canonical.md`
- `src/tokens/handoff.js`
- `src/tokens/seal.js`
- `src/tokens/binding.js`
- `schemas/handoff-manifest.schema.json`
- `schemas/source-binding.schema.json`
- `schemas/evidence-binding.schema.json`
- `test/evidence-binding.test.js`
- `test/seal.test.js`
- `skills/sdd-commit/canonical.md`
- `execution evidence`
- `src/tokens/equivalence.js`
- `src/cli/evidence.js`
- `.github/workflows/playbook-validation.yml`
- `templates/project/github/workflows/playbook-validation.yml`
- `test/validate.cli.test.js`
- `generated handoffs; no installed skill is expected to change.`
- `src/util/fs-safe.js`
- `src/config/artifacts.js`
- `src/util/frontmatter.js`
- `src/`
- `gray-matter`
- `playbook-validation.yml`
- `skills/sdd-verify/canonical.md`
- `test/evidence-adversarial.test.js`
- `private evidence; any correction stays within Amendment R5.`
- `installed skills.`
- `test/closure-retention.test.js`
- `execution evidence.`
- `generated handoffs.`
- `schemas/closure-index.schema.json`
- `private evidence; corrections within Amendments R1–R6.`

## Verification commands

- `no formatter is configured; preserve repository ESM conventions.`
- `node --check`
- `node --test test/tokens.test.js test/adapters.test.js test/engine.test.js test/lifecycle-cli.test.js test/validate.cli.test.js`
- `npm test`
- `npm run generate:check`

## Contract

- Path: `openspec/specs/contracts/openapi.yaml`

## Handoff manifest

- openspec/changes/harness-trust-restoration/handoff-manifest.json

## Full sources

- openspec/changes/harness-trust-restoration/proposal.md
- openspec/changes/harness-trust-restoration/tasks.md
