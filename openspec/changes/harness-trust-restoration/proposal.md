---
schema: proposal
schema_version: 1
change_id: harness-trust-restoration
status: approved
owner: pending
created: 2026-10-06
updated: 2026-10-08
impact:
  public_contract: true
  data_model: false
  architecture_boundary: true
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: true
  infrastructure: true
  concurrency: false
  migration: false
security:
  risk: elevated
  triggers: [authorization, infrastructure, ai_tool_execution, sensitive_logging]
runtime_relevant_capabilities: [cli]
---
# Evidence-preserving, source-bound SDD harness

## Approved bounded closure — 2026-10-08

After ten failed reviews that did not converge, the user approved closing this change under design Amendment R7: an honest-error threat model, a closed acceptance checklist (C1–C12), a blocking rule restricted to realistic and reproducible scenarios, and delivery outside the SDD lifecycle gate under the bootstrap exception (ADR-042), released as `0.10.0`. The acceptance criteria, error cases and security considerations below are unchanged; R7 defines how their completion is judged. The failed review reports remain history.

## Objective

Correct F06, F04 and F05 in dependency order as the methodology companion to the LIA harness remediation. F03 and F01/F02 are consumer configuration/context work between F06 and F04. Introduce behavioral controls without applying unrelated application changes or migrating other consumers implicitly. The user approved the original proposals and designs on 2026-10-06; this generic proposal retains its approval. Consumer amendment D1 has human approval and introduces no methodology decision. Its implementation is deferred; the latest current-session ceiling is sdd-design. Approval remains distinct from executed evidence and passed gates.

## Guiding principle

The CLI must enforce critical state invariants, not infer completion from syntactically valid scalar statuses. Methodology output must retain authoritative evidence. Generic corrections apply upstream and are consumed through supported installation, with explicit compatibility/migration handling for older artifacts. There is no LIA-only packet or lifecycle implementation. Before global propagation, assess other active consumers and stop on unexpected invalidation rather than conceal it behind a downstream patch.

## Impacted modules

`playbook run` compaction/raw evidence/exit behavior; `src/tokens/run.js` receipts; packet generation and freshness; adapter completeness; lifecycle engine; CLI validation/status/archive coordination; schemas and canonical SDD skill sources. Existing standalone Claude output hooks and RTK implementation are separate owners, not methodology modules.

## Impacted repos

Single-repository methodology implementation. Product changes are governed by the consumer companion proposal and are not added to this repository's topology.

## Files touched

Candidate owned files within scope, finalized by design/plan:

- `src/tokens/run.js`, `src/tokens/packet.js`.
- `src/cli/run.js`, `src/cli/packet.js`, `src/cli/validate.js`, `src/cli/status.js`.
- `src/lifecycle/engine.js`, `src/adapters/index.js`, `src/config/artifacts.js`.
- Existing archive/cleanup CLI module, once identified; no unrelated archive behavior.
- `schemas/`: handoff/evidence schemas and existing config/runtime/verification schemas.
- `skills/*/canonical.md` only for stages consuming/producing this contract; generated output through the established generator.
- New focused tests under `test/`; relevant existing test files except the user-modified `test/repos.test.js`.
- This change's artifacts and proposed ADR drafts.

Non-Git global Claude filter/RTK adapter changes are governed by the companion's global installation scope, not generated from this repository: inspection found no upstream owner of those existing standalone hooks. Do not introduce `src/tokens/claude-evidence.js` or a LIA coordinator to merge these independent responsibilities. Methodology regression fixtures may model interaction without owning global hook policy.

## Expected behavior

### Happy path (Given/When/Then)

Given a consumer using the corrected canonical methodology and a complete current handoff, when an agent runs a stage, then evidence identifies actor/source/environment, relevant content and commits are bound to the result, required adapters are accounted for, and the next action respects delivery state. Successful post-merge verification and its closure evidence survive archive.

### Edge cases

RAW commands are not optimized or rewrapped. Unknown failures retain all diagnostics. Missing actor identity is a visible validation issue; unobservable provider/model values remain unavailable rather than invented. Empty reports, missing adapters, invalid exclusions and stale governed source state fail closed. Compatibility mode remains explicitly separate and cannot be labeled strict compliance.

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

## Error cases

- **EC-1:** Evidence mode cannot capture or retain a complete raw log: command result is reported with an evidence failure, not a fabricated pass.
- **EC-2:** Actor identity cannot be observed: record unavailable identity and validation issue; never substitute a configured model as an observed runtime value.
- **EC-3:** Required capability, reference, hash or delivery state is missing/conflicting: block with a specific reason.
- **EC-4:** Governed source changes after a gate: invalidate its eligibility and identify the required revalidation stage.
- **EC-5:** Archive retention fails: do not remove the change evidence.
- **EC-6:** A compatibility consumer would be unexpectedly migrated, or user work overlaps: stop that wave and report the affected scope.

## Security considerations

- **SEC-1:** No output hook emits `permissionDecision: allow`, `ask`, `deny` or `defer` for optimization. Existing independent authorization controls remain intact.
- **SEC-2:** Read canonical references through existing contained-path/symlink safety controls. Do not read arbitrary secret files to build a manifest.
- **SEC-3:** Environment/identity recording is allowlisted metadata only; no wholesale environment, credential, payload or raw sensitive application logging. Raw evidence is private and fixtures synthetic; sensitive evidence must not be committed automatically.
- **SEC-4:** Artifact/schema migration is explicit, versioned and fail-closed. Legacy inspection support cannot silently grant new completion eligibility; no project-specific exception may bypass generic invariants. Do not deploy a change that unexpectedly invalidates other active consumers.
- **SEC-5:** Evidence presence/hashes demonstrate provenance and consistency, not the truth of arbitrary claims. Required observations and criterion mappings remain reviewable; validators reject empty structural evidence rather than claiming they can authenticate a fabricated real-world event.
- **SEC-6:** No automated push, merge, approval or irreversible external runtime effect. Integration tests run in isolated temporary repositories.

## Constraints and non-goals

Do not touch user-modified `src/repos/classify.js`, `src/repos/plan.js` or `test/repos.test.js`. Do not alter product behavior, dependencies or deferred findings F07–F14. Implement F06 first; wait for the intervening consumer waves before F04/F05 activation. Edit canonical skill sources, not generated skills by hand. No HTTP OpenAPI authoring: this contract is CLI/artifact-based. The existing experimental CLI adapter remains blocked where applicable; use the methodology's approved real-CLI evidence convention rather than marking an unsupported adapter passed. No completion/merge/archive claim without the existing gates.

## Implementation decisions proposed for review

1. F06: global Claude owns its filtering/bypass behavior; RTK owns normal command optimization; upstream `playbook run` owns structured summaries, exit preservation and retained/raw evidence. These are corrected independently and tested together. No new LIA-only routing or methodology-owned Claude coordinator. RAW (`rtk proxy`) must remain unmodified by output hooks. NORMAL Playbook summaries retain counts/warnings/skips and point to complete raw evidence; unknown failure formats retain diagnostics.
2. F04: add `handoff-manifest` and `execution-receipt` schema versions using canonical references and SHA-256 content hashes. Identity provenance distinguishes observed runtime, explicit caller declaration and unavailable values. Missing agent identity blocks strict eligibility; unavailable provider/model is visible and bounded rather than fabricated.
3. F05: upstream validation checks the complete required adapter set and criterion/task mapping, exclusions, nonempty evidence, governed source snapshots and unanimous delivery. Pure lifecycle computation receives validated eligibility rather than treating report statuses as sufficient. Report-only changes are excluded from their own source snapshot; governed code/config/contract changes invalidate it. Commit/merge refresh and legacy artifact migration rules must be specified and regression-tested in design so they cannot create an endless commit/evidence cycle or unexpectedly invalidate active consumers.
4. Retention: preserve a versioned closure evidence directory/index outside the active change folder before cleanup, with references/content hashes and privacy-aware raw-log retention. Missing closure proof blocks archive.

These architectural decisions are refined in the approved generic design. Approval does not claim successful implementation or a passed gate. The installed CLI resolves directly to this checkout: implementation therefore requires an isolated upstream worktree before edits to reusable source, then intentional validated propagation. Global skill installation follows `canonical.md` → `npm run generate` → generated `SKILL.md` → `playbook install --runtime all`. Existing `0.9.2` compatibility state is preserved unless the repository's approved workflow requires otherwise.

## Open technical decisions

Original proposal approval was explicitly supplied by the user on 2026-10-06: "Si, apruebo ambas"; design sign-off followed: "Si, apruebo ambos diseños". Source-snapshot/commit refresh semantics, closure paths, strict activation and adapter mappings are defined in the approved design. Consumer D1 does not change these decisions. See session-handoff.md for the outstanding consumer revalidation boundary; no new generic code or later lifecycle stage is authorized by that record.
