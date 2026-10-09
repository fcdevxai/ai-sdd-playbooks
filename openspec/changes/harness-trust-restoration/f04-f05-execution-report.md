# F04/F05 upstream execution report

Date: 2026-10-06. Methodology source: `/home/ubuntu/ai-sdd-playbooks`, branch `harness-trust-restoration`, baseline HEAD `527448a98ed85263328b04308d1fe2a5d8bef79f`. The implementation was developed and tested in `/home/ubuntu/ai-sdd-playbooks-harness-worktree`, then copied by an explicit owned-file list to the installed checkout. No push, merge, or archive occurred.

## F04 — memory-independent handoff and evidence identity

**Root cause.** The packet tracked contract path/roles but not contract bytes, did not carry a versioned cross-agent identity/source manifest, and execution telemetry did not bind raw command output to actor, repository source, artifacts, and stage. The archive skill could remove the only closure proof.

**Structural correction.** `src/tokens/packet.js` hashes contract contents. `src/tokens/handoff.js`, `src/tokens/evidence.js`, and the handoff/tasks schemas produce a complete stage-specific manifest with impacted and context-only repository branch/SHA/source hashes; requirement/spec/design/tasks/contract/architecture/skill references; AC/EC/SEC IDs; criterion/repository/capability mapping; tools; risks; blockers; and declared actor identity. Stage copies have immutable content-hash names. Untracked source is included only through explicit `tasks.handoff.source_paths`; `.env`, logs, run evidence, archives, and active change artifacts are not silently treated as product source.

`playbook run` now writes private execution receipts with the child exit code, command, allowlisted environment, actor/provider/model provenance, source snapshot, artifact hashes, timestamps, summary, and exact raw-stream hashes. `playbook evidence seal` constructs a report binding from a fresh handoff and actual receipts. The `governed_manifest_hash` binds all semantic references, including architecture, skills, context repositories, and contract contents, while excluding evidence-only commit SHA and task checkboxes. `playbook evidence bind` requires explicit Git ancestry and only enumerated evidence-only paths when SHA changes. `playbook evidence retain` copies closure artifacts to `openspec/archive/<change-id>` and raw evidence to an explicit private location outside the repository, with hashes and a reference-rebase index. A failed copy removes only its own staging directory; it never deletes the active change.

**Validation.** `test/handoff-schema.test.js`, `handoff.test.js`, `source-snapshot.test.js`, `receipt.test.js`, `evidence-binding.test.js`, `seal.test.js`, and `closure-retention.test.js` cover complete and incomplete manifests, contract-byte mutation, unsafe links, changed source/spec, unknown identity, receipt/raw integrity, SHA rebinding, partial copy, and independent reconstruction after deleting a synthetic active folder. The LIA Hub generated a real stage manifest identifying `loom`, `api`, `app`, and context-only `methodology`, with nine ACs, five ECs, five SECs, content-hashed OpenAPI, seven canonical skills, and explicit provider/model availability limits. `playbook validate harness-trust-restoration` accepted the consumer manifest.

## F05 — lifecycle and runtime invariants

**Root cause.** `gateStatusFromAdapters` aggregated only supplied adapters; an empty or incomplete report could be syntactically plausible. `computeLifecycle` treated `verification-report.md.status: passed` and `proposal.status: archived` as sufficient without verifying live delivery, source freshness, receipts, or retained closure. `validate`, `status`, `next`, and skill preconditions did not share one eligibility decision.

**Structural correction.** `src/lifecycle/runtime-coverage.js` derives required adapters from affected repository capabilities and task criterion mappings, then requires a passed adapter with receipt-backed coverage or an explicit reason and substitute receipt for every excluded criterion/repository pair. A later red-first canary showed that a configured capability could carry a valid `passed` receipt while missing from the acceptance-criterion mapping. The corrected validator now requires every enabled capability to be explicitly mapped for each declared criterion/repository pair; an adapter-level pass or exclusion cannot conceal that omission. `src/lifecycle/eligibility.js` is shared by `validate`, `status`, `next`, and stage preconditions; a scalar passed gate with missing/stale source binding blocks. Verification requires unanimous live merged delivery and post-merge receipts. Archive routing requires valid verification plus an integrity-checked closure index. `src/github/repository.js` permits only generated evidence dirt after merge, and only when the merged PR head SHA exactly matches local HEAD; source dirt or uncertain GitHub identity stays unmerged/unknown. An explicitly listed Hub is deduplicated in delivery reduction.

Canonical `skills/*/canonical.md` for planning, apply, review, security, runtime, commit, verify, and archive were updated to use the enforced packet/run/seal/precondition/retention protocol. `npm run generate` produced their `SKILL.md` files; generated files were not edited directly. Archive retains proof before permanent-spec promotion and never changes `proposal.status` as a marker because that would invalidate the verified requirement hash.

**Negative canaries.** The following states are rejected by the named regressions:

| Invalid state | Regression | Rejection |
|---|---|---|
| Applicable runtime adapter omitted | `test/runtime-coverage.test.js` | Missing `http` is reported. |
| Empty/fabricated adapter evidence | `test/runtime-coverage.test.js` | Empty receipt or invalid receipt hash fails. |
| Invalid exclusion | `test/runtime-coverage.test.js` | Missing substitute or invalid substitute fails. |
| Stale commit SHA | `test/evidence-binding.test.js` | Gate binding fails until explicit evidence-only lineage is written. |
| Contract/source/spec changed after gate | `test/evidence-binding.test.js`, `test/seal.test.js` | Governed digest/freshness fails, including after manifest regeneration. |
| Verification before merge | `test/seal.test.js`, `test/lifecycle-cli.test.js` | Seal/precondition refuses an open PR. |
| Archive while PR open | `test/engine.test.js`, `test/closure-retention.test.js` | No archive routing or retained closure. |
| Conflicting repository delivery | `test/engine.test.js` | A merged aggregate with an open repository is not verified. |
| Missing/incomplete handoff | `test/handoff.test.js`, `test/handoff-schema.test.js` | Strict validation rejects the manifest. |
| Enabled capability omitted from criterion mapping | `test/runtime-coverage.test.js` | A red-first test reproduced silent acceptance; both `passed` and `not_applicable` adapter statuses now fail until the capability is mapped. |

The valid synthetic sequence in `test/seal.test.js` captures review, security, runtime, and post-merge verification receipts, seals each report, routes to `sdd-archive`, retains proof, and only then reaches `done`. It does not assert that the actual unmerged LIA change is delivered.

## Quality, installation, and consumer impact

- The isolated worktree suite passed **494/494** after the final F05 mapping correction; private raw log `/home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/f05-mapping-worktree-test.log` has SHA-256 `6b959878601bd6264a6d0c01424fb3df27da2ee1097a8ca54bf08970e962b90d`. The installed source checkout passed **496/496** through `playbook run --change harness-trust-restoration --step apply --repo loom --agent Codex --json -- npm test` (exit 0). Latest full raw evidence: `.specloom/runs/1791314727521-220c666f-BuCzWJ/full.log`, 106,597 bytes, SHA-256 `3182623d8d458ebaa9eb956dd46656305e7f2b7a84b43891e4d28f37ebb08aa8`; receipt in the same private run directory. Its actor is `Codex`; provider/model are explicitly `unknown` with identity issues, not inferred from configuration.
- `npm run generate:check` found no drift among 13 skills. `node --check` passed on 45 owned JavaScript files. The three protected preexisting files retained SHA-256 values `a6f864d4...`, `4164e8eb...`, and `ccb6807e...` respectively.
- The installed CLI and Hub remain at methodology version `0.9.2`, compatible range `>=0.1.0 <1.0.0`; no release or lockfile change was invented. `playbook install --runtime all` refreshed the 13 generated skills in both `~/.claude/skills` and `~/.agents/skills`; all installed bytes matched the canonical generated files. Private pre-install backups are under `~/.local/share/playbook/backups/harness-trust-restoration-2026-10-06/`.
- The other discovered active consumer, `eduassistant/playbook-sdd`, had no active change folders; its `doctor` and `validate` preview passed. LIA Hub `doctor`, `validate`, `status`, and `next` passed after propagation. Its actual change remains `implementing` with `delivery: uncommitted`. `sdd-verify` and `sdd-archive` preconditions failed, and `playbook evidence retain` refused closure without creating the requested raw destination.

## Bounded evidence

This is a same-version local development installation from a dirty checkout, not a released immutable package. A fresh agent may need a new process to load the newly installed skills. No actual merged LIA change was fabricated; post-merge behavior is supported by generic fixtures and live negative Hub checks. The methodology `cli` runtime adapter remains experimental, so this unmerged harness change does not claim a passed runtime gate. Provider/model identity remains unavailable where the runtime does not expose it. The focused six-entry agent re-audit belongs to the LIA companion change and remains separate from this upstream implementation report.
