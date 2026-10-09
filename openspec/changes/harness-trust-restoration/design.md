---
schema: design
schema_version: 1
change_id: harness-trust-restoration
status: approved
created: 2026-10-06
updated: 2026-10-08
security:
  risk: elevated
  threat_model_required: true
  controls: [SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006]
---
# Technical design — Evidence-preserving, source-bound SDD harness

## Preconditions

The user explicitly approved both companion proposals and both original designs on 2026-10-06. This methodology design retains its recorded approval; approval is not executed evidence or a passed gate. The acceptance criteria and security risk of the approved proposal are unchanged. Implementation order remains F06, intervening consumer F03/F01/F02, then F04 and F05. The consumer's later D1 amendment changes its skill distribution/discovery decisions, not this generic design. See session-handoff.md for the current consumer revalidation boundary.

## Approach

Keep methodology mechanisms in this repository and LIA information in the consumer Hub. The pure lifecycle engine receives validated eligibility and delivery observations; filesystem, hashing, process execution, and Git/GitHub remain outside it. A single eligibility evaluator supplies `validate`, `status`, `next`, and stage preconditions so one path cannot bypass a rule enforced by another.

### F06: capture first, summarize separately

Replace synchronous buffered child capture in `src/cli/run.js` with an asynchronous, file-backed runner shared with `gate-check`. Use `spawn` with argument arrays and `shell: false`; no reinterpretation of caller arguments. Create the private run directory and open raw files before starting the child. Drain stdout and stderr as binary chunks into separate lossless files and a combined `full.log`. The combined log records observed chunk-arrival order, which cannot prove a total order across two independent OS streams. Separate streams and byte counts/hashes are authoritative for losslessness.

The collector is incremental: bounded diagnostic rings and summary accumulators, no complete in-memory output or fixed total-output ceiling. Backpressure/error handling must finish or explicitly fail capture; an incomplete log cannot produce a successful evidence receipt. Record spawn errors, signals, capture errors, and start/end times separately. Preserve normal child exits, including 7; use 127 for executable-not-found, 126 for a non-executable command, and `128 + signal number` for signal termination. A successful child with failed evidence persistence makes the wrapper fail with an explicit evidence error; retain the actual child status separately rather than rewriting it as a test failure.

NORMAL prints a structured, bounded summary: child status/exit, recognized test and assertion counts, warning presence/count, skipped/incomplete presence, and useful failure context. Unknown failure formats still receive a diagnostic tail. Output that does not match a known runner is reported as unclassified, never assigned invented test counts or a fabricated complete-test status. Bound both lines and bytes, and disclose truncation of the display. Always reference the complete raw files and receipt.

RAW (`playbook run --raw`) forwards stdout/stderr bytes to their corresponding streams while persisting the same evidence. Do not add banners or summaries to raw child streams. The receipt path remains discoverable under the run directory; optional JSON output is mutually exclusive with RAW. `rtk proxy playbook run --raw ...` composes two explicit bypasses. NORMAL requires preservation of important information, not byte equality; RAW requires byte equality for each stream.

Global Claude filtering and RTK are independent owners. Their adapters are specified in the consumer design. Methodology fixtures exercise their contracts without adding a Claude hook, LIA router, or RTK implementation here.

### F04: versioned handoff and execution receipts

Keep the existing deterministic `context-packet.md` navigation artifact. Add a derived `handoff-manifest.json` generated alongside it by `playbook packet`. Do not move semantic authority from proposal/design/tasks/specs into the manifest. References carry repository identity, contained relative path, byte hash, and optional section/criterion identifiers. The packet additionally includes error cases and the manifest reference. Existing contract metadata is retained, but actual contract bytes are hashed separately and compared at consumption.

The manifest is stage-specific. Requirement/spec/architecture references come from configured document mappings and explicit change declarations; relevant extra contracts, skills, tools, risks, blockers, and criterion applicability are declared in the approved task plan. No secret-file scan, guessed artifact, or invented empty context. Required fields are present even for a legitimate empty list, with a non-applicability reason where needed. A designed change requires an approved design reference. All impacted repositories, including the Hub once, must resolve through configured topology; unknown or unavailable repositories block strict handoff generation.

`playbook packet --stage <stage> --agent <agent>` generates current repository observations and declared producer identity. Provider/model may be supplied only with their provenance; absent values are `unknown` with explicit identity issues. A configured default model is not runtime identity. Deterministic output retains the previous `created_at` when content and identity inputs are unchanged; a changed stage, source, or identity creates a new manifest timestamp. Existing packet deterministic tests remain meaningful.

`playbook run` and `gate-check` emit a schema-validated `execution-receipt.json` in each run directory. Keep `usage.json` base fields for existing telemetry consumers and reference the new receipt. Receipt creation can record identity issues without discarding useful raw output, but strict stage evidence requires a known agent and explicit stage/change association. Unknown provider/model remains an explicit bounded issue; it must never be silently filled from configuration.

### Source snapshots and freshness

Capture branch and exact HEAD for each configured impacted repository, plus a deterministic governed-content digest. Use Git's tracked-file inventory and staged/unstaged changes; include relevant untracked implementation/configuration files from declared scope. Hash bytes, file type/mode, and deletions, not timestamps. Do not recursively read ignored files, `.env`, credentials, dependencies, caches, or runtime logs. Referenced symlinks must resolve within their authorized repository boundary. A required source inventory that cannot be established blocks evidence binding.

Hash proposal, approved design, the normative task plan, contracts, architecture references, relevant canonical skills, and relevant configuration independently. Task completion checkboxes and the appended Execution Report are execution bookkeeping: record the full tasks byte hash for handoff identity and a separately specified normative-plan hash for gate governance. Both hashes are visible; normalization removes only the documented bookkeeping fields, never task text, commands, criteria, mappings, or required files. Mutation of normative content stales gates; mutation of any handoff reference stales that handoff.

Exclude derived packets/manifests, run logs/receipts, gate reports, verification reports, and the change's explicitly enumerated audit evidence from the governed source tree. Proposal/design/normative tasks and contracts are always included separately and cannot be excluded by caller configuration. Gate artifacts do not hash themselves. Record exclusions and inventory so a hidden application-source omission can be reviewed. Capture before and after command execution; governed content changes during execution make the result ineligible.

Exact HEAD mismatch is stale, including an evidence-only commit. No implicit SHA forgiveness. An explicit `playbook evidence bind <change-id> <report>` may produce a new binding with lineage to the original execution only when the governed byte digest and all normative/contract hashes are identical, and the intervening Git diff contains only enumerated evidence artifacts. A changed implementation, architecture, contract, task command, or unavailable ancestry requires rerunning the gate. The command cannot change a signed report's status or invent an execution; its separate binding contains old/new SHAs, identical digests, and reason. Pre-merge bindings never count as post-merge verification.

### Amendment R1 — Explicit rebind across an identical implementation commit

Approved by the user on 2026-10-07 after `sdd-code-review` Issue 1 (code-review-report.md, preserved with status `failed`). The sentence above that limits `playbook evidence bind` to an intervening diff containing only evidence artifacts is **superseded** by this amendment for implementation commits; every other statement in this section stays in force. The real lifecycle order is dirty implementation, approved gates, `sdd-commit`: without this rule committing the reviewed bytes stales every gate.

`playbook evidence bind <change-id> <report>` may produce a new binding across an intervening commit that records governed implementation paths only when all of the following hold:

1. **Explicit.** Rebinding happens only through `evidence bind`. A changed HEAD stays stale until the CLI validates equivalence; nothing is forgiven implicitly.
2. **Content recorded in the destination commit.** The governed content is read from the destination commit's Git tree, never inferred from the current working tree. Equal working-tree hashes are not sufficient (a partial commit leaves the working tree unchanged).
3. **One definition on both sides.** The reviewed snapshot records a Git-comparable digest per repository (`tree_hash`) over the same inventory, with entry type (file or symlink), the executable bit as the relevant mode, content bytes and link targets, and treating deletions as absence. The destination tree is hashed with the same function. Entries Git cannot represent consistently make the digest unavailable, which rejects the rebind. Normative artifacts, contracts, architecture, skills and configuration references governed by the handoff must also keep their recorded hashes at the destination commit.
4. **Every linked repository.** All repositories bound to the report are validated. The original report and its receipts are preserved unchanged; the binding records original execution (report and receipts), previous SHA, destination SHA, intervening commits, the committed governed paths and both digests.
5. **Only valid approved evidence.** The report must be a cleared gate (`passed` or `not_applicable`) with a valid source binding and valid receipts. Rebinding cannot change `failed` into `passed`, accept a receipt with a capture error, or supply absent or corrupt evidence.
6. **Reject on doubt.** Any difference, incomplete inventory, partial or incompatible commit, unavailable digest (including reports sealed before this amendment) or unverifiable ancestry rejects the rebind and requires a rerun through an explicit lifecycle route (re-execute and re-seal the gate on the committed SHA).
7. **No delivery shortcut.** A rebind is not post-merge verification and never permits archive of unmerged work; `sdd-verify` and retention keep their merged-delivery preconditions.

No local workaround is allowed in a consuming Hub. Regressions must cover the real order (dirty implementation, approved gates, identical commit, bind, next) plus changed-content, extra-file, partial-commit, deletion, mode, symlink and legacy-report negatives.

Review Issues 2 to 6 (runtime exclusions, receipts with a capture error, `sdd-commit` precondition agreement, exit-code mapping, capability applicability) enforce invariants already specified in this design. They add no design decision beyond the two clarifications below.

- An exclusion's approving authority is a reference (repository, path, hash) that must match a canonical reference already governed by the handoff (spec, architecture, contract, design or requirement).
- Where this section requires a repository's capabilities and the change touches more than one repository, the repository's explicit `repos.<name>.capabilities` is required; the aggregate Hub capabilities apply only to single-repository changes.

### Amendment R2 — Content-based freshness, portable CI checks and immutable bindings

Approved by the user on 2026-10-07 after the second `sdd-code-review` (code-review-report.md, preserved with status `failed`). It refines Amendment R1 and the freshness sentences above; every other statement stays in force.

**Problem.** A handoff manifest records the exact HEAD it was generated at. Committing it changes HEAD, so a committed manifest is stale at its own commit and required PR CI fails. A binding is keyed by one exact destination SHA and is written once, so committing the binding (or any later evidence commit) stales it with no way to supersede it. Gate receipts are private and absent from a clean clone.

**Content-based freshness.** The saved manifest and its immutable stage copies are never rewritten, and the observed SHAs stay recorded. `validate`, `status`, `next` and stage preconditions treat a manifest whose only differences are repository commit identity (`commit_sha`, `source_hash`, `inventory_count`) as fresh only when, for each such repository: the recorded commit is a verifiable ancestor of the current HEAD; the governed semantics, normative, contract, architecture, skill and configuration hashes are unchanged; and the Git tree actually recorded at HEAD, not the working tree, has the same `tree_hash`, with every governed reference keeping its recorded hash at that commit. Ignoring `commit_sha` without these checks is not allowed. Sealing a gate and writing a receipt still require a manifest generated at the current HEAD, so they never record a stale SHA.

**Missing history.** Ancestry is never declared valid without history. If the recorded commit is not present (a shallow clone), the check reports `local-only` with the reason and the remedy (`fetch-depth: 0`); it is never `passed` or `not_applicable`. The workflow templates and this repository's workflow fetch full history.

**Portable CI validation.** `validate --ci` still rejects every defect a clean checkout can prove: invalid schemas, malformed or inconsistent `source_binding` and binding files, absent or altered portable references and stage manifests, binding lineage that does not match, and governed content that differs from the sealed snapshot. Checks that need private receipts or raw logs, sibling repositories that are not checked out, or history that is not available are reported explicitly as `local-only` (not verified in this environment, with the reason). They are never counted as passed or not applicable, and they never hide a failure the checkout can prove. A receipt file that is present is still validated. A green CI run accredits only the checks CI executed: it grants no gate eligibility, delivery, verification or archive. `validate` without `--ci`, `status`, `next` and stage preconditions stay strict, and `--ci` cannot be used to satisfy a precondition (the combination is evaluated strictly).

**Immutable, versioned bindings.** A binding is keyed by report, repository and destination SHA (`evidence-binding-<report>-<repository>-<sha>.json`) and is never overwritten. Each is validated against the original sealed snapshot, the normative artifacts and the original receipts; an earlier binding never substitutes for that validation. A binding records lineage by verifiable references (earlier bindings it supersedes with their hashes, the sealed report hash, the original receipts, sealed and destination SHAs and tree digests). Repeating `bind` for the same destination and evidence is idempotent; a contradictory binding fails. A later HEAD with identical governed content may rely on an ancestral binding after verifying ancestry, the committed tree equivalence at that HEAD and all required hashes; that validation writes no further versioned file, which ends the commit-the-evidence cycle. A real content change, corrupt evidence, an incomplete inventory or unverifiable ancestry rejects and requires revalidation through the explicit lifecycle route. None of this relaxes receipts, preconditions or post-merge delivery.

**Consumers.** No Hub-local patch is permitted. Protected pre-existing edits in the methodology checkout belong to a separate delivery that must be settled before any gate is sealed; changed governed content invalidates sealed evidence and is never rebound across a different snapshot.

### Amendment R3 — Receipt path containment and binding lineage completeness

Approved by the user on 2026-10-07 after the third `sdd-code-review` (code-review-report.md, preserved with status `failed`). It clarifies Amendment R2 and adds no new capability.

**Receipt references are validated before availability is decided.** A receipt reference must be exactly `.specloom/runs/<one run directory>/execution-receipt.json`, where the run directory is a single path segment without `.`, `..` or separators; the schema enforces this. Shape and containment inside the project root are checked first, in every mode, and a malformed or escaping reference is a provable defect that fails `validate --ci` as well as strict validation. Only a well-formed, contained reference whose file is absent from the checkout may be reported `local-only` (private receipts are not versioned). A containment error is never reinterpreted as absence.

**A binding is verified field by field, not trusted.** Validation recomputes the destination assessment from the sealed snapshot and compares every recorded identity, digest and path set: the sealed and destination commits, the report hash, `governed_hash`, `evidence_only_paths`, and, when the assessment is an identical-content implementation commit, a mandatory `equivalence` section whose reviewed digest, committed digest, committed governed paths, intervening commits and original receipts all match. A binding that omits `equivalence` where the mode requires it is invalid, and one that carries it where the assessment is evidence-only is invalid.

**Predecessor chain.** `supersedes` must list exactly the binding files of the same report and repository whose destination commit is a proper ancestor of this binding's destination, each with the hash it had; an omitted predecessor, a listed file that is absent or altered, or an entry that is not such a predecessor makes the binding invalid. Ancestry that cannot be verified because history is missing is `local-only` in portable mode and never valid. This applies in strict and portable validation alike.

### Amendment R4 — Binding identity, precedence and contained reads

Approved by the user on 2026-10-07 after the fourth `sdd-code-review` (code-review-report.md, preserved with status `failed`). It tightens Amendments R2 and R3.

**Exact expected binding.** A binding is valid only if it equals the binding recomputed from the sealed report and the destination commit. Validation builds the complete expected record (change, repository, the sealed report's repository and exact change-local path and hash, sealed and destination commits, governed digest, evidence paths, the equivalence section when the destination is an implementation commit, and the predecessor list with current file hashes) and compares every field except the creation time. A field the validator does not recognize is a difference, so no recorded field is trusted by omission.

**Deterministic precedence.** Of the binding files for one report and repository, those whose destination is the HEAD or a proper ancestor of it are applicable; others are ignored. The latest applicable binding is the one that is not a proper ancestor of another applicable binding. If there is not exactly one (history that is not linear), validation fails as ambiguous. Only the latest applicable binding is validated, and a contradictory latest binding fails; validation never falls back to an older valid binding. Predecessors are checked through the lineage hashes recorded by the latest binding, not for their own validity, so a damaged binding that was later superseded stays allowed. `bind` uses the same selection: it is idempotent when the latest applicable binding is valid, writes a new binding when it is not, and fails on a contradictory binding for the same destination.

**Contained, regular reads.** Every binding file read, whether a candidate or a predecessor named by `supersedes`, must be a regular file that is not a symbolic link, lie inside the project root after resolving its directory, and have the exact change-local name `evidence-binding-<name>.json` with no path traversal. Anything else is a provable defect that fails strict and portable validation alike; a file is never read before these checks.

### Amendment R5 — Evaluation model, checkout context and delivered evidence

Approved by the user on 2026-10-08 after the fifth `sdd-code-review` (code-review-report.md, preserved with status `failed`, Issue 15) and a class-level analysis that confirmed further variants with probes. It replaces case-by-case remediation with explicit rules the review can check one by one; Amendments R1–R4 remain in force where not refined here.

**1. Evaluation model.** Every evidence check is evaluated per unit (a repository, a gate report, a binding candidate, a lineage entry) and returns pass, fail or unknown. Results are aggregated: any fail makes the result fail whatever else is unknown; unknown is reported as local-only and is never a pass; a pass needs no fail and no unknown. A failure or an unknown in one unit never stops the evaluation of another unit, and inside a unit every check that does not depend on the unknown input still runs. In particular, a governed-content difference that is visible without history (the working tree digest differs from the sealed digest) is a failure even when ancestry cannot be examined.

**2. History is three-valued and unknown only when it is genuinely incomplete.** Ancestry is yes, no or unknown. In a repository that is not shallow, a commit that is absent is not part of any history there: it is never an ancestor, a binding naming it does not apply, and evidence that requires it as an ancestor fails (history rewritten after sealing, or foreign evidence). Unknown exists only in a shallow repository, where an absent commit or a walk across the shallow boundary cannot be decided; strict validation treats unknown as failure. Changed paths between two commits are the union of the per-commit changes and the net tree difference, so a change introduced by a merge commit is never missed.

**3. Binding selection with unknowns.** A binding whose destination is HEAD is the latest applicable binding. Otherwise, if the applicability or the order of any candidate is unknown, the selection is unknown (local-only in portable mode, failure in strict mode) and no older binding is validated in its place; candidates known not to apply are ignored. Every binding, whatever its mode, must record a destination whose committed governed digest equals the reviewed digest and whose governed references and normative plan keep their sealed hashes.

**4. One contained-read rule for all evidence.** Every file of the change directory and every receipt or raw evidence file read by validate, status, next, preconditions, packet, bind, seal or closure must be a regular file that is not a symbolic link and that resolves inside the project root; otherwise the read is refused before any byte is read and the check fails. This generalizes the binding rule of Amendment R4 to reports, handoff manifests, plans, packets and receipts.

**5. Front matter is data, never code.** Artifact front matter is parsed only as YAML or JSON. Any other front-matter language, including JavaScript, is an error and is never evaluated.

**6. Checkout context.** Per repository, the checkout is classified against the branch recorded in the sealed evidence and the repository's base branch (read from `playbook.config.yaml` as recorded in the sealed commit of the SDD repository — the repository's `default_base`, else `github.base_branch` — never from the checkout under evaluation, whose configuration may be unreviewed; only when that recorded configuration is unavailable, the clone's origin/HEAD):
- *On the sealed branch*: the full rules apply.
- *Detached HEAD*: strict validation fails with the instruction to check out the change branch. Portable validation applies every content, ancestry and binding rule as if on the sealed branch and reports only the branch identity as local-only. Writers (packet, seal, bind) refuse a detached HEAD.
- *Another branch that is not the base branch*: failure; evidence sealed on one branch never validates a different branch.
- *The base branch* (after merge): delivered evaluation, below.
Pull-request CI checks out the pull request's exact head commit with full history (detached): every content, ancestry and binding rule applies and only the branch identity is local-only. A branch name is never trusted in pull-request CI, because a fork can name its head like the base. Validating GitHub's synthetic merge commit is not supported because it changes whenever the base branch moves.

**7. Delivered evaluation.** On the base branch, pre-merge gate freshness is not re-judged against the base branch's content, which legitimately includes other work. The evaluation requires instead: the sealed chain intact (report, stage manifest and governed hash); the covered commit in the history of HEAD, where the covered commit is the destination of the latest applicable binding, or the sealed commit itself when its committed governed digest equals the reviewed digest; and that binding fully valid under rule 3 at its destination. The comparison with the base branch's current content is reported as not applicable after delivery, never as passed. In strict mode a gate evaluated this way is eligible only with live unanimous merged delivery; `sdd-verify` then judges the merged code. Accepted limits: a merge that ignored a red pull-request CI is not detected on the base branch (branch protection with required CI is the control), and squash or rebase merges break lineage and require rerunning the gates (all LIA repositories use merge commits as of 2026-10-08).

**Refinement after the independent adversarial check (2026-10-08, approved by the user).** An independent agent confirmed ten defects in an isolated copy (probes kept as permanent tests `test/evidence-attack-*.test.js`). Decisions: (a) the base branch comes from the reviewed configuration and pull-request CI checks out the exact head commit, as stated in rule 6; a branch named like the base and validated by name outside pull-request CI is judged as delivered, which is the same accepted limit as a merge that ignored a red pull-request CI; (b) every tracked file is governed except the change's own evidence directory, `openspec/archive/` and `.specloom/` (vendored, `.env*` and `*.log` files that a repository versions are reviewed content); (c) a closure index records its raw evidence root and every retained raw reference must lie inside it as a regular file with no symbolic link on its path. Within the existing rules: a report's `source_binding` must equal the identities and hashes of the stage manifest it pins, in every mode; ADR drafts, the proposal read for delivery resolution and the packet's plan follow rule 4; Git replace objects are never applied and grafts are refused during evidence checks; malformed evidence is a reported violation, never a crash; a binding with any field outside its schema is invalid.

**8. Independent adversarial check.** Before the next `sdd-code-review`, an independent agent attacks the implementation against these rules in an isolated copy, and its confirmed findings are corrected within these rules.

### Amendment R6 — Review exit rule

Approved by the user on 2026-10-08 after the seventh `sdd-code-review` (Issues 18–25, preserved with status `failed`). It defines what blocks this change's code review so the review converges; it changes no evidence rule.

**Blocking.** A finding blocks the gate (`status: failed`) when, in any mode, it lets evidence be accepted that does not prove what it claims — false, stale, foreign, partial or unreviewed content treated as valid, or a gate or closure treated as eligible — or when it loses evidence the design requires to be kept, or when it reads a file in violation of Amendment R5 rule 4, or executes artifact content.

**Non-blocking.** A finding that fails closed (the gate or command is blocked, never wrongly passed) or that only affects the accuracy of a derived summary while the raw evidence stays intact is recorded in the report as a follow-up with an owner and does not by itself make the gate `failed`. Accepted limits written in Amendments R2–R5 are not findings.

**Scope.** The review judges the whole change surface (capture and receipts; handoff, packet and seal; binding, eligibility and validation; closure and retention; plan normalization) against Amendments R1–R6 and the permanent adversarial suites, and classifies each finding as blocking or non-blocking under this rule.

**Refinement after the subsystem audit (2026-10-08, approved by the user).** Four independent agents audited capture and receipts, handoff/packet/seal, binding/eligibility/validation and closure/retention against Amendments R1–R6. Decision: inside the change directory only derived evidence is outside the governed digest — the plan (its normative part has its own hash), packet, handoff and stage manifests, `*-report.md` files, bindings, and the audit files the plan enumerates in `handoff.audit_evidence` (never proposal, design or tasks); every other file there, tracked or not yet committed, is reviewed content. F05 as written now applies: every AC, EC and SEC maps to runtime evidence or is declared in `handoff.non_runtime` with a rationale (both is contradictory), and a sibling repository's own `playbook.config.yaml` decides its capabilities before the Hub's explicit entry. Non-blocking findings recorded as follow-ups (owner: methodology maintainer), kept as `todo` tests: summary accuracy for Laravel/PHPUnit 10 totals, display truncation disclosure, byte-bounded display, terminal control sequences in the summary, and run-store or telemetry paths through a symbolic `.specloom`.

### Amendment R7 — Bounded closure

Approved by the user on 2026-10-08 after the tenth `sdd-code-review` (Issues 26, 28, 30, 32 and 33, preserved with status `failed`) and an interrupted eleventh review. Ten reviews did not converge: R5 rule 8 and the R6 blocking definition required that no false evidence be accepted "in any mode" without stating which actor the mechanism defends against, so every remediation enlarged the surface and the next review produced a narrower variant (the eleventh moved to filesystem races). This amendment closes the change. It supersedes R5 rule 8 and the **Blocking** and **Scope** paragraphs of R6; every other rule of R1–R6 stays in force.

**1. Threat model.** In scope: honest but fallible agents and humans — evidence left stale by real edits, skipped or reordered steps, the wrong stage or report, missing adapters, paths that escape by accident, partial captures, altered exit codes, statuses declared without evidence, and verification or archive before merge. Out of scope, as accepted and documented limits: deliberate forgery by an actor with write access to the repository, its Git internals or index flags, the run store or the private evidence store (hashes can be recomputed; see SEC-5); concurrent filesystem mutation during a CLI invocation (time-of-check/time-of-use races; checks are static containment, not an OS-level atomic lock); and inputs that supported repositories do not contain (submodules, non-UTF-8 path names, Markdown containers beyond the task-plan format), which are rejected fail-closed or kept as normative content rather than modeled further — non-UTF-8 names are hashed as ordinary content, including a `.env` file under such a name inside a declared untracked path (closure follow-up 5).

**2. Closed acceptance checklist.** Completion is judged only against:

| ID | Check |
|---|---|
| C1 | `npm test` reports 0 failures; only the eight TODO tests listed in R6 remain |
| C2 | `npm run generate:check` reports no drift |
| C3 | `node --check` passes for every JavaScript file |
| C4 | Every AC-1–AC-11, EC-1–EC-6 and SEC-1–SEC-6 maps to existing passing tests, including the nine AC-10 negative canaries |
| C5 | Each of Issues 1–34 has a passing permanent regression |
| C6 | The rerun10 independent variants and the eleventh-review probes pass, except the out-of-scope race class |
| C7 | The suite passes on Node 18 and Node 20 (the CI matrix) |
| C8 | Private-clone simulation of pull-request-head and post-merge CI: `validate --ci` exits 0 |
| C9 | `playbook install --runtime all` into an isolated HOME leaves both targets identical to the generated skills |
| C10 | The three protected files and the product repositories are unchanged |
| C11 | The LIA Hub `doctor`, `validate`, `status` and `next` run with the candidate code |
| C12 | Release coherence (rule 7): the listed skills, specs, ADRs, README, CHANGELOG, version fields and consumer template exist and do not contradict the released behavior |

**3. Blocking rule.** A finding blocks only when it (a) cites a checklist item or an AC, EC or SEC; (b) describes a realistic scenario inside the threat model; and (c) reproduces in the real flow — real repositories and the real lifecycle order — not only in a synthetic adversarial fixture. Every other finding is recorded as a follow-up with an owner. The closure review has one round plus one delta round restricted to the first round's blocking findings; anything still open after that is a user decision, never a further automatic round.

**4. Disposition.** Issues 1–34 are closed by their permanent regressions; Issues 26, 28, 30, 32 and 33 were remediated in R10. The eleventh review's five boundary probes ("outside file substituted after its final lstat" for packet, capture, seal, bind and retention) are out of scope as time-of-check/time-of-use races. Follow-ups, owner methodology maintainer, not blocking: the eight TODO summary/telemetry tests; error-case navigation in the context packet; a simpler runtime-gate path for changes without a product runtime surface; and temporary-directory hygiene of the test suite (fixture directories are left in `TMPDIR`; about 6,600 were found from 2026-10-07 and 2026-10-08).

**5. Delivery outside the lifecycle gate.** This change modifies the gate that would judge it (`validate`, `status`, `next`, preconditions, seal, bind and retain), and its declared `cli` runtime surface can never pass the experimental adapter. It is therefore completed outside the SDD lifecycle gate under the bootstrap exception recorded in ADR-042: checklist evidence, a bounded closure review, pull-request CI on Node 18 and 20, human approval of the pull request and a release tag. The failed tenth `code-review-report.md` is retained as history and is not rewritten to `passed`.

**6. Version.** The release is `0.10.0`. Consumer CI and the consumer template pin `v0.9.2` and `semver:^0.9.0`; a minor version prevents silently moving consumers to the stricter lifecycle (EC-6, SEC-4). The bump is the repository-native release requirement anticipated in "Installation and review boundary", so it is not an invented version change under AC-11. Consumers adopt explicitly, following the CHANGELOG migration notes.

**7. Release coherence.** Before the release, the canonical `sdd-plan` and `sdd-runtime-gate` instructions require `handoff.runtime_coverage` or `handoff.non_runtime` for every AC, EC and SEC, and the permanent CLI and playbooks specs, ADR-042, ADR-043, README, CHANGELOG and the consumer workflow template describe the released behavior.

### F05: complete runtime coverage and delivery enforcement

Introduce a reusable runtime applicability declaration in the approved tasks frontmatter: each AC/EC/SEC that needs execution maps to configured repositories, capabilities, and evidence; each deliberately non-runtime criterion has a rationale. Resolve enabled capabilities from each affected repository's own config, otherwise explicit Hub `repos.<name>.capabilities`; an aggregate Hub capability alone is insufficient to guess a repository's capability. Missing or contradictory mapping blocks. The approved proposal's `runtime_relevant_capabilities` narrows intended coverage but cannot silently remove a mapped requirement.

For every configured/affected enabled adapter, require an entry with either a current passed observation or an explicit validated exclusion. Passed entries need mapped criteria and nonempty receipt/evidence references whose hashes and source binding validate. A bare `status: passed`, an empty findings list as sole evidence, a nonexistent receipt, or a success receipt for an unrelated command is insufficient. The validator cannot prove an adversarially fabricated real-world observation from hashes alone; correlated receipts and reviewer-visible mappings expose rather than solve that trust limit.

An exclusion carries a reason code, nonempty rationale, approving canonical authority reference, covered criteria, and any mandated substitute evidence. Disabled capabilities have their own non-applicability reason. A supported relevant adapter cannot be excluded merely because its dependency is missing. Experimental adapters remain blocked unless an already approved canonical policy explicitly permits a bounded substitute. ADR-032's CLI exception requires before/after real invocations plus a regression failing against the old implementation; record `not_applicable`, never `passed`. This design does not implement the experimental adapter or falsely remove the CLI surface. Keep `[cli]` in this change's approved proposal; represent the permitted policy exception explicitly in its runtime report.

Evaluate all gate artifact schemas, coverage, identity, and freshness before passing eligibility into the pure engine. Reuse the evaluator for `validate --precondition sdd-verify` and `sdd-archive`. Verification needs live unanimous merged delivery and a current post-merge snapshot for every impacted repository, not just an aggregate label. Conflicting duplicate observations, unknown states, an open PR, unavailable merge identity, or any unmerged member block. Retain the live resolver's existing safety precedence; do not rewrite its dirty-tree policy to fabricate delivery.

Post-merge verification records the observed merge state/merge identity and tested source snapshot, with real criterion evidence. An evidence-only write must not destroy the original verification proof: retain an external receipt, commit approved evidence when authorized, then explicitly bind an evidence-only commit if needed. If the live delivery resolver says `uncommitted`, completion remains blocked; this remediation will not push/merge just to manufacture an eligible state.

The engine may reach `verified` only with eligible current verification and unanimous merged delivery. `proposal.status: archived` alone is not an archive shortcut. An archived state requires a valid closure index referring to an eligible post-merge verification snapshot and retained evidence; contradictory delivery while active never routes to archive.

### Retention and archive

Inspection found no archive CLI module: cleanup currently lives only in `skills/sdd-archive/canonical.md`. Add a small reusable `playbook evidence retain <change-id>` operation rather than inventing a Hub script. It validates archive eligibility and copies required source artifacts, handoff, gate reports/bindings, verification, and safe evidence into `openspec/archive/<change-id>/`, using temporary staging, an integrity index, and atomic publication. Existing different closure contents are never overwritten. It does not promote specs, delete a change, stage files, commit, push, or approve cleanup.

Copy synthetic/non-sensitive raw evidence into the retained bundle with hashes. If a raw log cannot safely be committed, require an explicit private durable archive destination and content-addressed reference; the index visibly records restricted evidence and the reconstruction/access limitation. A path into the disposable active change or rotating RTK cache is not retention. Missing raw evidence, failed copying, a escaping path, or failed integrity verification blocks cleanup.

The archive skill calls retain before spec/ADR promotion and before human-confirmed cleanup. Preserve the exact pre-promotion verification/source identity; archive's approved spec promotion is a separate documented delta, not a new assertion that changed sources passed the old gate. Any additional code/config/contract mutation stops closure and requires revalidation. Archive metadata must distinguish historical verified source from promoted documentation and retain the reviewed delta. The closure index survives active-folder removal and allows inspection of archived completion without a model's memory. This session does not archive its own unmerged change.

## Module impact

| Area | Owned delta | Validation |
|---|---|---|
| `src/cli/run.js`, `src/tokens/run.js` | file-backed execution, summary/RAW API, receipt linkage | exit/large-output/stream/summary canaries |
| `src/repos/gate-check.js` | reuse lossless runner; retain per-repo command result | multi-repo synthetic execution regression |
| `src/tokens/packet.js`, `src/cli/packet.js` | reference/content hashing, complete manifest | contract/source mutation and containment |
| New `src/tokens/evidence.js`, `src/cli/evidence.js` | snapshots, explicit bindings, private retention | stale SHA, circularity, copy failure, cleanup survival |
| `src/adapters/index.js` | complete applicability/coverage validator | omitted/empty/excluded adapter negatives |
| `src/cli/status.js`, `src/cli/validate.js`, `src/lifecycle/preconditions.js` | shared eligibility evaluation and prerequisite wiring | full CLI status/next/validate canaries |
| `src/lifecycle/engine.js` | pure validated gate/delivery decisions | pre-merge verification and archive negatives |
| `src/config/artifacts.js`, `src/cli/dispatch.js` | discovery and command registration only | schema/dispatch tests, child argv passthrough |
| `schemas/` | manifest, receipt, binding, closure; versioned report/config/task extensions | valid and invalid generic fixtures |
| `skills/*/canonical.md` | changed producer/consumer/evidence/archive instructions | skill contract tests, supported generation |
| `test/` | focused generic harness/evidence/lifecycle tests | targeted and complete suite |

The three preexisting modified files remain untouched. New tests must not be placed in the user-modified `test/repos.test.js`. No database, product repository, global Claude hook, or RTK source is owned here.

## Trade-offs

File-backed capture adds IO and lifecycle/error handling but avoids arbitrary buffer loss. A bounded summary may omit ordinary verbose output; raw bytes remain available. Per-stream losslessness is provable; a precise cross-stream causal ordering is not.

Strict evidence increases artifact work and cannot certify human honesty. References and real command receipts reduce unauditable empty assertions. Explicit evidence-only rebinding adds an operation but avoids endlessly rerunning unchanged application behavior after committing reports. It does not forgive changed source or turn a pre-merge check into verification.

Use versioned artifacts rather than one project-specific extension. Legacy artifacts remain readable for inspection; absence of strict identity/freshness/coverage is an eligibility failure, not an implicit pass. Global rollout therefore requires an active-consumer inventory and explicit migration. If another consumer's active work would be unexpectedly invalidated, stop propagation and report the migration requirement; do not retain a secret permissive completion path or add a downstream fork.

## Public contracts / interfaces

HTTP contract authoring is skipped explicitly: upstream has `capabilities.http: false`; this change's public surface is CLI/files. The configured OpenAPI fixture is unchanged.

CLI additions:

```text
playbook run [--change ID] [--step STAGE] [--harness NAME]
             [--agent AGENT] [--provider PROVIDER] [--model MODEL] [--raw] -- COMMAND ARGS...
playbook packet ID [--stage STAGE] [--agent AGENT] [--provider PROVIDER] [--model MODEL]
playbook evidence bind ID REPORT
playbook evidence retain ID [--raw-destination PATH]
```

Identity flags are explicit caller declarations unless an allowlisted runtime observation supplies them; provider/model provenance remains visible. Global flags may be parsed before the child delimiter only. Arguments such as a child's `--json`, `--help`, or `--cwd` after `--` are forwarded unchanged. `--json` NORMAL emits one parseable receipt/summary result without plain-text banners; `--raw --json` is a usage error. Evidence operations fail closed and emit specific issue codes.

Handoff contract (illustrative shape, no fabricated execution values):

```yaml
schema: handoff-manifest
schema_version: 1
change_id: <id>
stage: <stage>
requirement: {repository: <name>, path: <path>, hash: <sha256>}
spec: [{repository: <name>, path: <path>, hash: <sha256>}]
acceptance_criteria: [{id: AC-1, reference: <requirement section>}]
error_cases: [{id: EC-1, reference: <requirement section>}]
security_criteria: [{id: SEC-1, reference: <requirement section>}]
repositories: [{name: <name>, branch: <branch>, commit_sha: <sha>, source_hash: <sha256>}]
design: {repository: <name>, path: <path>, hash: <sha256>}
tasks: {repository: <name>, path: <path>, hash: <sha256>, normative_hash: <sha256>}
contracts: [{repository: <name>, path: <path>, content_hash: <sha256>}]
architecture: [{repository: <name>, path: <path>, hash: <sha256>}]
required_skills: [{name: <name>, repository: <name>, path: <canonical path>, hash: <sha256>}]
required_tools: [{name: <name>, context: <repository>, purpose: <purpose>}]
runtime_coverage: [{criterion: <id>, repositories: [<name>], capabilities: [<capability>]}]
unresolved_risks: []
blockers: []
producer: {agent: <agent>, provider: unknown, model: unknown, provenance: caller_declared}
identity_issues: [PROVIDER_UNAVAILABLE, MODEL_UNAVAILABLE]
created_at: <UTC timestamp>
```

Receipt v1 carries run ID, exact command argv/display, change/spec/manifest identity, stage, repository/branch/SHA and source snapshot, actor/provenance/issues, an environment allowlist (OS/runtime version, cwd, explicitly declared container context), start/end timestamps, child exit/signal/spawn and capture status, summary, and raw-file paths/bytes/SHA-256. No wholesale environment or configured credentials are serialized. Reports v2 reference receipt IDs, governed snapshots, coverage, and bindings; schemas accept legacy shapes for inspection but eligibility explicitly rejects missing strict evidence.

## Data model changes

No database or dependency changes. Add JSON artifact schemas using existing Ajv and existing containment utilities. Keep existing `usage.json` fields and record new receipt references additively. Distinguish handoff full-content hashes from normalized gate-governance hashes by names and schema, never by an undocumented heuristic. New artifact version numbers do not imply a package version bump.

Closure index v1 lists retained files and byte hashes, verified source/merge snapshots, producer/receipts, restricted raw destinations, and the archive promotion delta. References are relative within their named repository or explicitly designated private evidence root. A partial index is not a valid closure.

## Security controls

- **SEC-001:** Execution/output formatting produces no permission decision; no shell interpolation of argv or stage/identity values. Existing independent authorization remains outside the runner.
- **SEC-002:** Canonical references use contained real-path checks and named configured repositories. Reject traversal, symlink escape, missing required source and arbitrary external artifact roots.
- **SEC-003:** Run directories mode 0700, new raw/receipt files mode 0600, metadata allowlist, synthetic regression output, no automatic raw-log commit. Failed retention never deletes originals.
- **SEC-004:** Missing identity, malformed artifacts, ambiguous coverage, stale snapshots and incompatible legacy completion fail closed with diagnostic reasons. No signed-status mutation through regenerate/bind/retain.
- **SEC-005:** Unanimous live delivery and current post-merge verification precede closure. Claiming `archived` or `passed` in YAML is insufficient. Do not auto-merge, approve or delete.
- **SEC-006:** Isolate implementation from the globally linked CLI; compare protected user-file hashes before/after. Inventory consumers and validate migration before intentional installation.

### Threat model

Assets: authoritative source identity, human approvals, command exit/raw evidence, runtime coverage, delivery eligibility, sensitive output, and unrelated projects/user edits. Threats include an optimizer hiding diagnostics, buffer truncation masquerading as a full log, an output hook granting permission, a missing adapter becoming a pass, stale contract/source identity, forged scalar reports, path traversal, raw secret persistence, evidence deletion, and accidental global rollout. Controls above protect structural integrity and boundaries. They do not cryptographically attest a model's real identity or an external browser/worker event; keep those limits visible in the final report.

## Testing strategy

F06 tests first: seven required hook/RTK/Playbook composition canaries plus exit 7, executable-not-found, signal termination, binary/non-UTF-8 output, >2.3 MB stdout and stderr, no trailing newline, long-line display bounds, concurrent stream capture, warnings/skips/counts, unknown failures, child flags after `--`, and persistence failure. Compare expected raw stream bytes and hashes, not just existence of `full.log`. Test normal compaction and RAW separately. Never use real student data or database resets.

F04 tests: incomplete manifest, missing design for a designed change, unresolved topology, escaping/broken symlinks, contract-byte mutation with unchanged metadata, architecture/skill/task mutation, SHA mutation, unavailable identity, deterministic generation, evidence-only binding with lineage, changed-source binding rejection, source mutation during execution, and retention after deleting a synthetic active folder. Force retention failure and prove originals survive.

F05 negative canaries, generic fixtures and actual CLI invocations:

1. Required runtime adapter omitted.
2. Empty/bare/fabricated structural adapter report or unrelated receipt.
3. Invalid exclusion or absent substitute evidence.
4. Stale commit SHA.
5. Contract content changed after gate.
6. Verification before all required merges.
7. Archive while a PR is open, including a scalar `verification: passed`.
8. Conflicting repository delivery states, including contradictory duplicate observations.
9. Incomplete handoff.

Include positive complete coverage, legitimate disabled/policy-excluded adapter, evidence-only rebinding, unanimous merged post-merge verification and intact closure. Pure-engine tests are supplemented with `validate`, `status`, `next`, and precondition CLI tests so there is no unvalidated scalar-status route.

Run per-file `node --check`, targeted `node --test`, full `npm test`, schema fixtures, and `npm run generate:check`. Edit only canonical skills, then `npm run generate` and repeat generation checks. Dogfood status/next on the methodology change without claiming completion. Run isolated install-target tests before `playbook install --runtime all`; validate the Hub with doctor/validate/status/next and feature-specific canaries after propagation. Do not change package version, compatibility range, or lockfile silently.

## Installation and review boundary

Before implementation create an isolated worktree so the currently linked global CLI remains unchanged. Preserve the dirty source checkout and its unrelated changes; no reset/clean/restore of whole trees. Worktree and command routing must be documented in the execution report. Stage only owned changes when eventually authorized; do not commit/push in this remediation session without stage authorization.

Keep version 0.9.2 and the compatible range unless a repository-native release requirement is discovered. Install generated skills using the supported installer and deliberately update the local CLI source/link only after tests and consumer-impact review. A same-version install does not require a lock rewrite; record source SHA/content identities to distinguish this local remediation from a released package. If compatibility migration cannot safely be propagated, report an incomplete wave rather than a successful harness.

The user approved this design and its LIA companion on 2026-10-06: "Si, apruebo ambos diseños". This records human design sign-off; it does not claim a runtime gate or completed remediation.
