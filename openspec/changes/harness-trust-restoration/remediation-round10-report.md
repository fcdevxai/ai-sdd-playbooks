# Tenth-review remediation — harness-trust-restoration

Date: 2026-10-08. Operation: bounded `sdd-apply`, methodology first, Hub consumer second. This is an implementation report, not an independent review or a gate verdict. Both authoritative code-review reports remain byte-identical `failed`.

## Contract and recovery

The existing approved proposal/design and Amendments R1–R6 were preserved. Tasks R10.26/R10.28/R10.30/R10.32/R10.33 and consumer H.9/H.10 explicitly reopened only the authorized remediation. Both plans were made `ready`, their strict `sdd-apply` preconditions passed, and they then entered `in_progress`. The initial CLI outputs are in `recovery-cli.json`. New own test paths were declared before the final apply receipts. Packets were regenerated following normative changes, read and validated.

The installed executable resolves to `/home/ubuntu/ai-sdd-playbooks/bin/playbook.js`. Generic implementation was developed in a private rsync copy with its explicit CLI; only the enumerated owned files were propagated. The Hub has no local lifecycle, capture, fingerprint, binding or closure implementation.

## Issue matrix

| Issue | Rule and criteria | Red evidence | Common correction | Variants and positive controls | Green evidence | Files / limits |
|---|---|---|---|---|---|---|
| 26 | R1/R5/R6; AC-3/8/10, EC-4 | Independent assume-unchanged and skip-worktree gates stayed eligible; permanent matrix rejects the previous source | Compare actual tracked submodule bytes, file kind, executable bit and link target to HEAD independently of index hints; recurse into gitlinks and recheck at snapshot end | Both flags separately; direct/nested; edit/delete/symlink/directory/mode; normal dirty/untracked vs ignored; clean flagged control; changes during capture; old seals become ineligible | New source/variant suites, independent variants and full suite | `src/tokens/evidence.js`; unsupported raw-byte submodule root paths fail closed. Ignored files retain the approved exclusion. No claim of detecting a mutation that is fully undone between observations |
| 28 | R1/R5/R6; AC-8/10, EC-4 | List-first fence checkbox mutation kept the old hash and eligible gates; executed heredocs produce different stdout | Conservatively recognize fences through list/quote containers; preserve literal lines/newlines/checkboxes/report-like headings; normalize actual administrative completion only | List/ordered/nested/blockquote/nested quote/tab/continuation; heredocs; blank lines; indented and ordinary fences; later tasks after reports; real administrative equivalence | Permanent literal execution controls and independent controls; full suite | `src/tokens/evidence.js`; ambiguous containers stay governed, which can fail closed rather than erase literal content |
| 30 | R5/R6; AC-6/9/10, EC-3/5 | Coherently altered review manifest/report/receipt/index proposal identity validated after active/run-store removal | Shared normative manifest projection joins every prerequisite to verification and the retained manifest; live/portable eligibility checks the same stage relationships | Review/security/runtime separately and jointly; proposal/design/normative tasks/architecture/contracts; recalculated checksums; all original receipts/raw; missing/corrupt/failed controls; live/portable and retained chain | Independent closure probe, 20 retained mutation cases, live/portable cases, original receipt/raw controls, full suite | `src/tokens/handoff.js`, `src/tokens/retention.js`, `src/lifecycle/eligibility.js`; commit/branch/full-task bookkeeping may differ under R1–R5. Delivered base content is not falsely compared with a pre-merge tree; its provenance stays governed by each binding |
| 31 safeguard | R5/R6; AC-5/6/10, EC-1/5 | An additional substitute receipt outside the seal list was omitted despite a valid runtime mapping; isolated red replay fails | Traverse source, adapter, substitute and coverage receipt edges, retain each original and all streams; reject invalid runtime coverage before publishing | Distinct receipt arrays (YAML aliases must not conceal the case); successful reconstruction after active/run-store removal; experimental passed publication refused | Final focused suite and full installed suite | `src/tokens/retention.js`, flow regression; private raw access remains required |
| 32 | R5/R6; AC-4/10, SEC-2 | Raw-byte change names caused external reads or accepted final links; old-source sentinel flow reproduces reads | Classify change prefixes with exact path bytes; walk every parent and check the final regular file before reads or readlink; preserve exact byte keys in declared directory expansion | Tracked/untracked invalid bytes; internal/external parents; final links; nested regular controls; snapshot/packet/capture/seal/bind/retention sentinels; authorized distribution aliases | Permanent variants/flow; original sentinel probes; full alias/reference suite | `src/util/fs-safe.js`, `src/tokens/evidence.js`; skill distribution aliases retain the approved separate reference contract. Static containment does not claim an OS-level atomic filesystem lock |
| 33 | R5/R6; AC-7/10, EC-3 | Additional CLI passed entry with an HTTP receipt was accepted; additional regressions show seal and bind accepted it too | Evaluate every declared adapter before required coverage; enforce known identity, support, state, enabled repository capability and mapped receipt correlation; invoke the same evaluator before runtime seal/rebind | Required/extra/disabled/unknown/prototype names; experimental CLI; unrelated receipt; actual config; HTTP positive; bounded authority/criteria/substitute `not_applicable`; full/shallow clone CI; fail wins over local-only | New direct/live/CI/seal/bind cases; original runtime controls; private clone suites; full suite | `src/lifecycle/runtime-coverage.js`, `src/tokens/seal.js`, `src/tokens/binding.js`; receipts expose correlation, not authentication of real-world claims. CLI remains experimental and cannot pass |

## Red first and diagnostic history

All receipts and raw streams are retained under the private evidence root below. The original rerun10 and rerun8-derived probes were preserved. `probe-adaptations.json` documents exact import routing and scaffolding changes; no original reproduction was overwritten.

- Independent variants on previous source: 8 registered, 1 passed, 7 failed; controls: 3 passed groups.
- Permanent source/variant red suite: 66 registered, 8 passed, 58 failed. These are expected unsafe-behavior failures, including subtest parent failures.
- Old-source whole-entry regression replay in `previous`: 14 registered, 5 passed, 9 failed. Sentinels demonstrate reads before rejection in the old implementation.
- Initial focused implementation check: 101 passed.
- Additional runtime seal/bind regression: 7 registered, 5 passed, 2 failed before the common operation checks.
- First full suite: 815 registered, 800 passed, 7 failed, 8 TODO. Seven legacy preparations tried to seal invalid coverage before their intended assertion. They were changed to prepare valid supported HTTP or the approved bounded CLI substitute first, then introduce corruption; early-seal rejection checks were added. Existing expectations were retained and own-config failure reasons strengthened.
- The added retention support regression failed before publication checking. The additional receipt regression first accidentally shared a YAML sequence alias with source_binding; after separating the arrays, its red replay proved the omitted edge (1 failed). Both class corrections now require green controls.
- A fixture correction check first exposed two preparation mistakes; the corrected check passes 8/8. No policy or descriptor was weakened.
- An attempted command ran before the new test file had been written and failed with missing-file diagnostics. A combined historical-probe invocation ran a dependent eligibility probe before its chain observations existed (26 passed, 1 scaffolding failure); the dependent probe was then run in order and passed 2/2.
- Two preliminary consumer helper checks failed on incorrect assumptions (context repository treated as product topology, then legitimately absent own config treated as required). Their versions are retained in red/; the third uses actual authority and passes, without changing generic fallback behavior.
- One preliminary flow invocation omitted an explicit TMPDIR and inherited host `/tmp`; it is diagnostic only. The authoritative old-source replay and final controls use the private scratchpad. `preliminary-tmpdir-deviation.json` discloses its candidate fixture directories. A focused command also overlapped test-source edits and correctly recorded `source_changed_during_run: true`; it is not eligible evidence.

## Verification results

| Check | Registered / passed / failed / skipped / TODO | Exit / receipt |
|---|---|---|
| Final installed npm test | 817 / 809 / 0 / 0 / 8 | 0; methodology `1791503997827-aae80fa3-FOkvUZ` |
| Isolated final affected suites | 100 / 100 / 0 / 0 / 0 | 0; implementation `1791503948869-61271c61-rNNwof` |
| Independent final probes | 25 / 25 / 0 / 0 / 0; dependent controls 2 / 2 / 0 / 0 / 0 | 0; methodology `1791504120079-1c1b1033-GZIIeI`, `1791504167895-40a6b868-QslQjA` |
| Private rsync + commit + full/shallow clones | Full 82 passed; shallow 22 passed; no failures or TODO | 0; implementation `1791504121707-5e5d1992-fYXVkO`; both complete logs retained |
| Generation consistency | No generated drift | 0; methodology `1791503999174-77aa19ce-WIMAxT` |
| Modified/new JS syntax | 17 files | 0; methodology `1791504020276-2305d8c2-FP7tdD` |
| Hub consumer checks | Catalog 24, app wrapper 25, F01 2, alias 7, authority 4, F06 11; validators/canaries also passed | All exit 0; exact commands and receipts in `hub-checks.json` |
| Serial freshness mutations | 5 stale checks and exact restoration checks | 0; Hub `1791504059716-e57ee075-N8PIVU` |
| Actual capabilities/context/authority | Own configs legitimately absent for app/API; explicit Hub fallback; methodology remains context, not product topology | 0; Hub `1791504143035-1bf9587a-znghLg` |
| Historical runtime mapping diagnostic | 10 absent Hub EC/SEC declarations | **Failed/pending**, exit 1; Hub `1791504015184-97f8b3bc-7lVAyi` |
| Runtime omission/contradiction controls | Omissions exposed; old app/API CLI and aggregate-only fallback rejected | 0; control only, not runtime approval; Hub `1791504017208-77ca0281-G5dDwt` |


The count of registered tests includes TODO. No TODO, blocked adapter, missing mapping, structural validation or local-only observation is represented as a passed runtime gate.

## Propagation and changed files

| Propagated owned file | Changed hunk starting lines |
|---|---|
| [src/util/fs-safe.js](/home/ubuntu/ai-sdd-playbooks/src/util/fs-safe.js:87) | 87, 140 |
| [src/tokens/evidence.js](/home/ubuntu/ai-sdd-playbooks/src/tokens/evidence.js:132) | 132, 155, 203, 245, 267, 362, 401 |
| [src/tokens/handoff.js](/home/ubuntu/ai-sdd-playbooks/src/tokens/handoff.js:215) | 215, 238 |
| [src/tokens/retention.js](/home/ubuntu/ai-sdd-playbooks/src/tokens/retention.js:6) | 6, 15, 93, 124, 134, 144, 255, 271 |
| [src/lifecycle/eligibility.js](/home/ubuntu/ai-sdd-playbooks/src/lifecycle/eligibility.js:1) | 1, 51, 82, 116 |
| [src/lifecycle/runtime-coverage.js](/home/ubuntu/ai-sdd-playbooks/src/lifecycle/runtime-coverage.js:108) | 108, 126 |
| [src/tokens/seal.js](/home/ubuntu/ai-sdd-playbooks/src/tokens/seal.js:8) | 8, 19, 74 |
| [src/tokens/binding.js](/home/ubuntu/ai-sdd-playbooks/src/tokens/binding.js:15) | 15, 136 |
| [test/helpers/closure-fixture.js](/home/ubuntu/ai-sdd-playbooks/test/helpers/closure-fixture.js:9) | 9, 23 |
| [test/evidence-binding.test.js](/home/ubuntu/ai-sdd-playbooks/test/evidence-binding.test.js:27) | 27, 35, 54 |
| [test/remediation-round10.test.js](/home/ubuntu/ai-sdd-playbooks/test/remediation-round10.test.js:1) | 1 |
| [test/remediation-round10-variants.test.js](/home/ubuntu/ai-sdd-playbooks/test/remediation-round10-variants.test.js:1) | 1 |
| [test/remediation-round10-flow.test.js](/home/ubuntu/ai-sdd-playbooks/test/remediation-round10-flow.test.js:1) | 1 |
| [test/helpers/evidence-fixture.js](/home/ubuntu/ai-sdd-playbooks/test/helpers/evidence-fixture.js:26) | 26, 101 |
| [test/remediation-runtime.test.js](/home/ubuntu/ai-sdd-playbooks/test/remediation-runtime.test.js:6) | 6, 14, 34 |
| [test/remediation-matrix.test.js](/home/ubuntu/ai-sdd-playbooks/test/remediation-matrix.test.js:7) | 7, 46, 56 |
| [test/evidence-attack-binding-b.test.js](/home/ubuntu/ai-sdd-playbooks/test/evidence-attack-binding-b.test.js:6) | 6, 51 |


`propagation.json` records exact before/after hashes and modes; `initial/owned/` keeps pre-edit bytes; `diffs/` records change line locations. Three new upstream tests were declared in both owning and consumer `source_paths`. No Hub-owned implementation or catalog inventory was added. Methodology/Hub task execution records, session handoffs, this report and derived apply packets/manifests were updated. Previous task history remains intact.

## Evidence and command provenance

Private evidence root:
`/home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/remediation-rerun10-20261008/`.

Every verification command uses `playbook run --change harness-trust-restoration --step apply --repo <loom|app> --agent codex --provider openai --model gpt-6 -- <command>`, with TMPDIR in this private scratchpad for final checks. Agent/provider/model are explicitly caller-declared, not runtime-attested. No environment dump, product data, PHP test or real product runtime was used. `command-results.json` enumerates commands, exit codes, capture state, test totals and private receipt/raw paths; `runs-index.json` records file checksums for original captures. Synthetic tests alone create commits, clones, seals, bindings and retained closures in private fixtures. Reports/manifests/receipts from earlier sessions remain historical evidence.

## Preservation

| Root | Branch | HEAD | Index |
|---|---|---|---|
| Methodology | harness-trust-restoration | 27044053983fea54e5d08350fc62b19f2a33739d | Empty and unchanged |
| Hub | harness-trust-restoration | e15c24c83558a7525c8d8e5143d3b862c08cf341 | Empty and unchanged |
| app | harness-trust-restoration | ea627eec4c13b8b8fb7aeed77da62d4a94470aeb | Empty and unchanged |
| api | harness-trust-restoration | f0748628771e847c65dc233280c1d77a06c51f43 | Empty and unchanged |

Protected hashes remain a6f864d4… (classify), 33988736… (approved plan), ccb6807e… (repos tests), 60b4926e… (Hub prompt). `preservation-postflight.json` records complete hashes, modes, links and exact changed-file lists. `baseline.json` is the new session baseline, not a historical Git-only diff. The final exact scope is limited to the 17 propagated files, two task plans/session handoffs/reports and derived apply context files.

The baseline includes content, type, mode and symlink targets. App/API and all 54 inventoried global entries remain unchanged. Official distributions, generated Boost blocks, permanent specs, dependencies/version/lock/configuration, protected files and both failed review reports are preserved. No real index change, Git delivery operation or global install occurred. The prior delivery decision for protected files was not reopened.

## Remaining work and owners

| Pending | Owner / recommended action | Current claim |
|---|---|---|
| Independent review of both changes | Responsible review session: methodology first, then Hub; independently replay variants and audit current raw/source | Both current reports remain failed; this apply session does not review |
| Ten Hub EC/SEC declarations; twelve methodology EC/SEC declarations | Plan/runtime owner: map each or provide a justified governed non-runtime rationale | Explicit omissions, not green coverage |
| App browser/HTTP and API HTTP/worker evidence | Later runtime-gate owner: real observations or approved authority/criteria/receipt-bound exclusions | Pending; no product runtime gate executed |
| Bounded CLI substitute | Later runtime-gate owner: before/after invocations and old-source red regression under approved policy | CLI experimental; never passed here |
| Eight summary/telemetry/capture TODO tests | Methodology maintainer: retained R6 follow-ups with raw and real exit intact | TODO, not approved tests |
| EC/SEC instructions and packet navigation | Planning/agent workflow owner: resolve approved declarations and navigation in their stage | Pending, no automatic stage completion |
| Hub release/workflow migration | Separate delivery/release owner: explicit version and CI migration | Out of scope; installed checkout consumption does not prove tagged-release parity |
| Shallow history, private receipts and delivery limits | Later delivery/review owner: apply R2–R5 without promoting unknowns | Accepted boundaries retained; private evidence requires durable access |

The session stops after apply, evidence preservation and consumer revalidation. No code review, security/runtime gate, verify, archive or later stage was executed.

## Final context and lifecycle postflight

Both current apply manifests were read and validated through the installed upstream implementation. The first final helper incorrectly imported the private implementation after the real normative records were finalized; it failed closed on the Hub context. Its original is retained under red/manifest-check-private-root.mjs; the corrected authoritative-root checks passed. No manifest or source was changed to hide the mismatch. Both CLI validate/validate --ci commands passed; doctor returned 4 solely for the preserved failed reviews. Status/next retain implemented/uncommitted and remediate sdd-code-review. The ten captured CLI results are in postflight-cli.json.
