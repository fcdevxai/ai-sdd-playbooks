---
schema: code-review-report
schema_version: 2
change_id: harness-trust-restoration
status: failed
updated: 2026-10-08
---
# Code Review Report — Harness trust restoration (tenth review)

## Independent decision and reviewed state

**Failed: five blocking classes remain: Issues 26, 28, 30, 32 and 33.** Original reproductions are corrected; variants remain. Issues 27, 29, 31 and 34 are resolved in the independently examined cases. Severity is High for 26/28/30/32 and Medium for the narrower remaining 33 variant. These counterexamples violate approved rules and need no new design decision.

Whole-change review against proposal, design Amendments R1–R6 and refinements, tasks and Execution Reports, repository instructions, permanent references, current code, original rerun8 probes and independent variants. Remediation-round8-report.md and private remediation evidence are an index, not a verdict. Under R6 accepted unreviewed/foreign/partial/false evidence and unsafe reads block; summary-only and fail-closed limitations are follow-ups.

Root /home/ubuntu/ai-sdd-playbooks: branch harness-trust-restoration, HEAD 27044053983fea54e5d08350fc62b19f2a33739d, empty index. Fresh packet generated with --stage sdd-code-review --agent codex --provider openai --model gpt-6, then validated8/8. Manifest tree_hash 88743ed27f175b99f214eeb33251c60901b63666b8b839c22bcb142a131801b4. Identity is caller-declared, not independent runtime attestation. playbook changed-files harness-trust-restoration --diff executed and saved privately; changed core files read where the diff was insufficient.

Both ninth-review failed reports were copied byte for byte to /home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/code-review-20261008/rerun10/input/ before replacement. Initial doctor reports expected failed review, validate passes structural checks, status/next require review remediation. This failed report is NOT sealed. Real writes are review reports and derived review packets/manifests. Test commits/clones/seals/bindings/retention occur only in private TMPDIR fixtures.

## Whole-surface audit

| Surface | Independent checks / code inspection | Result |
|---|---|---|
| Capture/receipts | Sync/async per-stream parsing, raw persistence, fsync/write failure, argv, real exit/signal/spawn mapping, provenance, before/after source, schema/stage | Controls pass; eight approved TODO follow-ups |
| Packet/handoff/seal | Contract bytes, data-only frontmatter, current HEAD, immutable manifests, alias/reference contents, report identity/schema, stage pins, contained reads/writes | Original controls pass; encoded filename containment fails(32) |
| Snapshot/plan | Working/committed inventories, deletions, executable bit, directories, gitlinks, byte-safe exclusions, report boundaries, literal commands | Ordinary dirty/byte exclusions fixed; hidden child bytes(26) and list-first fence(28) fail |
| Binding/history/CI | Complete expected record, latest selection, supersedes, every repo, full/shallow ancestry, replace/graft controls, own-commit manifest, rebind | Examined adversarial controls pass |
| Eligibility/public entries | validate/status/next/preconditions, expected schema per filename, identity, seal/bind, four report types | Original29 and independent16-case identity/schema matrix reject |
| Runtime | Real fixture config, AC/EC/SEC, mapped receipts/exclusions, own config absent versus invalid present, experimental CLI | Original33/34 corrected; extra unsupported passed claim remains(33) |
| Closure/retention | Active/run-store disposal, four gates and original raw, corruption/failure, schema/identity/stage, raw-root containment, atomic publication | Originals retained; prerequisites are not joined to verified source(30) |
| Distribution/scope | Generation,85 JS syntax checks,13 installed skills/both targets, exact PR SHA/full history, version/lock and preservation | Pass for observed boundary; separate Hub consumer review follows |

## Every acceptance/error/security criterion

| Criterion | Judgment | Evidence / gap |
|---|---|---|
| AC-1 | passed for review scope | Capture/RTK controls; installed F06 replay in companion |
| AC-2 | passed with R6 follow-ups | Child result and lossless raw preserved; TODOs unpassed |
| AC-3 | failed | Complete manifest fields, but hidden child bytes keep identity(26) |
| AC-4 | failed | Normal contracts/references reject; encoded filename unsafe read(32) |
| AC-5 | passed for examined fields/identity | All four report identity/schema entries reject; failed receipts ineligible |
| AC-6 | failed | Originals retained, but review and verification can concern different proposals(30) |
| AC-7 | failed | Required experimental CLI rejects; extra unsupported passed entry accepted(33) |
| AC-8 | failed | Hidden child/literal mutation preserve old gate eligibility(26/28) |
| AC-9 | failed for closure chain | Live unanimous delivery passes; retained prerequisite may concern foreign source(30) |
| AC-10 | failed | Existing negatives pass; seven safe assertions fail across five classes |
| AC-11 | passed for observed methodology boundary | 727 passed/8 TODO, generation clean, syntax/parity, both-root preflight, version/lock unchanged |

| Criterion | Review evidence |
|---|---|
| EC-1 | capture_error/failed execution rejects; each gate receipt/raw survives disposal and detects corruption |
| EC-2 | Unavailable identity explicit; declared identity not observation |
| EC-3 | Report/capability invalid inputs reject; extra CLI claim remains(33) |
| EC-4 | Original mutations reject; hidden child/list command remains eligible(26/28) |
| EC-5 | Retention rollback/membership controls pass; semantic closure incomplete(30) |
| EC-6 | Private isolation, no installation/migration, preservation audit |
| SEC-1 | Permission-neutral optimization, independent authorization ownership; companion installed replay |
| SEC-2 | failed: encoded change-local read boundary bypass(32) |
| SEC-3 | Private synthetic evidence, metadata allowlist, no credentials/product data |
| SEC-4 | Identity/schema now rejects; false runtime/closure acceptance still blocks overall contract(30/33) |
| SEC-5 | Findings are visible internal contradictions, not claims that hashes authenticate external events |
| SEC-6 | No real remote/irreversible operations; scratch-only Git/evidence mutations |

These review checks do not populate future runtime mappings. Methodology EC-1–6 and SEC-1–6 still need mappings or justified non_runtime declarations before that stage.

## Blocking findings

### Issue 26 — High: child index flags conceal unreviewed submodule bytes

- **File/line:** src/tokens/evidence.js:157, especially:169.
- **What changes:** gitlinkCommit uses child porcelain status as clean-content proof, then hashes HEAD. Child update-index --assume-unchanged or --skip-worktree on a.js hides its tracked byte edit. Parent source/tree digests remain identical; fresh handoff and all three old gates remain eligible.
- **Reproduction:** independent-variants.mjs, two flag cases. Seal clean fixture first; edit child only afterward, with no HEAD move. Child status is empty. Ordinary dirty and nested-child mutations now reject; index-hidden changes remain unreviewed.
- **Rule:** R1 comparable reviewed inventory, R5 governed content, R6 accepted unreviewed evidence; AC-3/8, EC-4.
- **Who acts:** Methodology maintainer/remediation agent.
- **Recommended action:** Compare actual tracked child contents/types/executable bits/deletions and recursively initialized children independently of index hints, or fail closed on those hints. Cover direct/nested child, capture, bind and CI. Clean porcelain alone is insufficient.

### Issue 28 — High: a list-first fenced command loses meaningful bytes

- **File/line:** src/tokens/evidence.js:330, :346.
- **What changes:** Fence recognition accepts only up to three leading spaces. A valid list beginning with a fenced sh block on its first item line is missed. Its two-space heredoc line "- **Done**: [x]" is discarded as bookkeeping. Changing it to [ ] changes stdout but keeps both normative hashes e02fb858a8b20b47bbc944e55cf5d311b0fc0cf33862c0e72bee17b56d222b0d. After navigation refresh all three original seals stay eligible.
- **Reproduction:** independent-variants.mjs list-fenced-literal. Independent-controls.mjs runs both heredocs via sh -s/stdin and proves different stdout. Ordinary fences, indented code, list continuation fences and genuine administrative metadata are controls.
- **Rule:** Commands/task text are normative; only actual bookkeeping/report sections may be removed. R1/R5/R6, AC-8, EC-4.
- **Who acts:** Methodology maintainer/remediation agent.
- **Recommended action:** Use container-aware Markdown normalization or conservatively preserve ambiguous code. Cover first-block list fences, nested lists/blockquotes and legitimate bookkeeping.

### Issue 30 — High: retained prerequisites can concern a different proposal

- **File/line:** src/tokens/retention.js:242, :255, :260.
- **What changes:** Reports are checked against their own stage manifests; prerequisite hashes are not joined to retained verified normative sources. Review report, immutable stage manifest and original receipt can consistently name proposal ffff… while retained/verified proposal differs. Rehashing those records/index yields validateClosureIndex ok:true after active-folder/run-store disposal.
- **Reproduction:** independent-variants.mjs archive-foreign-proposal-chain. Start from valid full closure. Only review proposal identity changes consistently across manifest/source_binding/receipt; actual proposal, verification and other gates stay unchanged.
- **Rule:** R5 intact sealed source chain; R6 foreign/partial accepted closure; AC-6/9/10. This is a provable internal contradiction, independent of external attestation. Original wrong-stage/governed-hash and failed-receipt cases now reject.
- **Who acts:** Methodology maintainer/remediation agent.
- **Recommended action:** Join each prerequisite's normative/canonical references to the retained verified sources, using normative-task/delivered-content rules consistent with live eligibility. Check proposal/design/tasks/contracts/reference identities across the full graph, beyond per-stage self-consistency.

### Issue 32 — High: encoded Git names bypass contained evidence reads

- **File/line:** src/tokens/evidence.js:213, :229, :235.
- **What changes:** Non-UTF-8 names become encoded keys beginning with U+0001; startsWith(change-prefix) misses them. Change-local entries use direct readFileSync/readlink instead of contained regular-file checks. An external parent symlink causes outside bytes to be read before later rejection; a final symlink at an encoded change filename returns a snapshot without rejection.
- **Reproduction:** independent-variants.mjs raw-name-parent-symlink/final-symlink. Minimal committed fixtures use basename byte ff. Reader instrumentation records the exact Buffer path through the external parent; sentinel is benign and private. Ordinary UTF-8 link cases now reject before reads.
- **Rule:** R5 rule4 checks before reading/hashing; R6 unsafe reads block even if a later check fails. AC-4, SEC-2.
- **Who acts:** Methodology maintainer/remediation agent.
- **Recommended action:** Classify paths using exact bytes and enforce containment/regular-file checks for Buffer paths before each read/hash/link operation. Explicit fail-closed rejection of non-UTF-8 change-local evidence also satisfies the boundary; lossy decoding does not.

### Issue 33 — Medium: an extra experimental adapter still claims passed

- **File/line:** src/lifecycle/runtime-coverage.js:129, :133.
- **What changes:** Support checks iterate only requiredAdapters. In the actual HTTP-only fixture config, adding CLI passed with a valid HTTP receipt and no CLI mapping leaves runtime ok:true and validate --ci exit0. Aggregate report accepts an unsupported passed claim. Required experimental CLI now rejects; this narrower case does not fulfill a missing required CLI mapping.
- **Reproduction:** independent-variants.mjs extra-experimental-cli loads the real fixture config, not fixed helper CONFIG.
- **Rule:** Approved F05 experimental CLI policy allows bounded substitute as not_applicable, never passed; R6 false accepted evidence, AC-7/10.
- **Who acts:** Methodology maintainer/remediation agent.
- **Recommended action:** Check support/status/evidence of every reported adapter before required coverage. Reject unsupported passed claims/unrelated receipts; preserve authority-backed bounded substitute.

## Complete disposition and bounded follow-ups

| Issue | Independent disposition |
|---|---|
| 26 | Ordinary/nested dirt corrected; hidden-index variant remains |
| 27 | Exact working/committed byte-safe exclusion controls pass |
| 28 | Original literal cases corrected; first-list-block fence remains |
| 29 | Foreign/schema/required-field controls reject;16 mutations across 4 report types include shared schema, CI, seal and bind; original status/next/precondition reject |
| 30 | Original seal/failed-receipt cases reject; cross-stage normative join remains |
| 31 | Four originals/raw retained and validated after disposable stores vanish; each failed receipt and corrupt raw independently reject |
| 32 | Ordinary parent/final links reject; encoded-key variants remain |
| 33 | Required experimental CLI rejects with real config; bounded substitute passes; extra claim remains |
| 34 | Legitimately absent config falls back; malformed YAML, wrong capabilities shape and directory authority fail |

Issues 1–25 have passing permanent regressions and replayed core rebind/capture/CI controls. This closes tested cases, not an assertion of exhaustive immunity.

R6 follow-ups, **owner methodology maintainer**, recommended separately after blockers:
- Eight TODO tests remain unpassed: Laravel async/sync totals, PHPUnit totals/warnings, truncation disclosure, byte display limit, terminal controls, telemetry symlink reads and run-store symlink writes.
- Plan/runtime canonical instructions/template omit required EC/SEC or non_runtime declarations. Align before runtime; omission fails closed.
- Packet omits promised error-case navigation; full proposal and manifest EC references remain authority.

Accepted R2–R5 limits remain visible: private CI receipts local-only; shallow ancestry unknown, not passed; delivered mode requires merge lineage/branch protection; detached exact PR-head CI makes only branch identity local-only. Filters/CRLF and unsupported merge-ref handling are not silently granted equivalence. Hub tagged-release/workflow migration, real app/API browser/HTTP/worker evidence and bounded CLI substitute remain separate pending work. No runtime gate passed.

## Captured commands and evidence integrity

All checks below use playbook run --change harness-trust-restoration --step review --repo loom --agent codex --provider openai --model gpt-6, TMPDIR=/home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/code-review-20261008/rerun10/scratch. Full raw/receipts are .specloom/runs/<run>/; sources/observations/input copies are private in /home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/code-review-20261008/rerun10.

| Check | Result | Run |
|---|---|---|
| npm test |735 registered:727 passed,0 failed,8 TODO|1791498337717-26c9b8e8-sT1yUz|
| generate:check |passed, no drift|1791498337671-0e25e236-LSAuma|
| syntax/installed parity |85 JS;13 skills identical in 2targets|1791498337466-7ab25c34-7Qt8v9|
| Original runtime, actual config |2 passed|1791498337499-9d67a8f6-LNgO7V|
| Original eligibility, after chain dependency |2 passed|1791498518160-f7f091f0-Ixlshf|
| Adapted original whole-flow/chain |12 passed|1791498811791-98a3d240-bxumaZ|
| Independent variants |1 positive passed;7 safe assertions failed in 5classes|1791498794713-13d59fc7-O6cigE|
| Independent controls |3 groups passed:16 report cases,8 gate receipt/raw checks, literal controls|1791498964141-2c0ea1eb-V5XqF1|
| Own config/schema matrix |2 groups passed|1791498909012-39014685-BARacn|
| Retained rebind |passed|1791498909127-29dcb318-K0FDsx|
| Follow-up bind |passed|1791498909070-8d6b1c50-S7DNYh|
| Private rsync/commit/clone CI + retained contracts |6 passed|1791498631909-db8ae1c7-9ad7NF|

CI probes cover complete history, detached exact HEAD, shallow local-only, corrupt committed binding, governed source mutation, tampered supersedes and strict --ci --precondition. Provable failures remain failures alongside unknown/private evidence. Retained probes cover own-commit manifest, capture_error and signal/permission exit mapping.

Probe adjustments are disclosed: unchanged original whole-flow assumed dirty snapshots return rather than throw; original chain selected first receipt, now review instead of verification. Adapted private copies catch early rejection/select run-verify. Initial eligibility started before its observation dependency and was rerun sequentially. Early variants/controls had fixture/instrumentation errors; version99 was an invalid assertion against the published minimum>=1 schema, so final invalid-version case uses0. Raw corruption was rerun after restoring the failed receipt. Only final canonical runs above support conclusions.

## Preservation and stopping point

Final private final-audit.json and postflight.json are recorded after the companion review; they compare four roots/global installed files to baseline, exact receipt/raw hashes/restoration, fresh manifests and final routing. Preservation targets classify a6f864d4…, repos test ccb6807e…, Hub doc 60b4926e…; current plan 33988736… includes already-approved R5 safe-frontmatter import, differing from historical 4164e8eb…, and is preserved by this reviewer. Version 0.9.2, package/lock/config, product sources, official distributions and permanent specs are unchanged by review.

**Recommended action:** methodology owner remediates all five classes under separately authorized sdd-apply, regenerate both handoffs, then rerun methodology followed by consumer Hub review. No Hub-local lifecycle fork; CLI routing authorizes no later stage.
