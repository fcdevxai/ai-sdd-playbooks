---
schema: tasks
schema_version: 1
change_id: harness-trust-restoration
status: passed
updated: 2026-10-08
handoff:
  audit_evidence: [session-handoff.md, protected-edits-delivery-proposal.md, tasks-history-pre-d1.md]
  specs:
    - {repository: loom, path: openspec/specs/playbooks/spec.md}
  architecture:
    - {repository: loom, path: docs/agent_architecture.md}
    - {repository: loom, path: docs/doc_architecture.md}
    - {repository: loom, path: openspec/changes/harness-trust-restoration/session-handoff.md}
    - {repository: loom, path: openspec/changes/harness-trust-restoration/tasks-history-pre-d1.md}
  contracts: []
  required_skills:
    - {name: sdd-plan, repository: loom, path: skills/sdd-plan/SKILL.md}
    - {name: sdd-apply, repository: loom, path: skills/sdd-apply/SKILL.md}
    - {name: sdd-runtime-gate, repository: loom, path: skills/sdd-runtime-gate/SKILL.md}
    - {name: sdd-archive, repository: loom, path: skills/sdd-archive/SKILL.md}
  required_tools:
    - {name: playbook, context: loom, purpose: lifecycle-and-evidence}
    - {name: Node.js, context: loom, purpose: methodology-regressions}
  runtime_coverage:
    - {criterion: AC-1, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-2, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-3, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-4, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-5, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-6, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-7, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-8, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-9, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-10, repositories: [loom], capabilities: [cli]}
    - {criterion: AC-11, repositories: [loom], capabilities: [cli]}
  unresolved_risks:
    - "The generic cli runtime adapter remains experimental; this unmerged change cannot claim a passed runtime gate."
    - "LIA consumer Hub ownership correction is applied; native catalogs/vendor preservation are observed. Actual skill activation and official update provenance remain unproven. U.D1.1–U.D1.2 remain implemented with no additional generic code change."
  blockers: []
  source_paths:
    loom:
      - schemas/closure-index.schema.json
      - schemas/evidence-binding.schema.json
      - schemas/execution-receipt.schema.json
      - schemas/handoff-manifest.schema.json
      - schemas/source-binding.schema.json
      - src/cli/evidence.js
      - src/lifecycle/eligibility.js
      - src/lifecycle/runtime-coverage.js
      - src/tokens/binding.js
      - src/tokens/capture.js
      - src/tokens/equivalence.js
      - src/tokens/evidence.js
      - src/tokens/handoff.js
      - src/tokens/receipt.js
      - src/tokens/retention.js
      - src/tokens/seal.js
      - test/closure-retention.test.js
      - test/evidence-binding.test.js
      - test/evidence-attack-binding-a.test.js
      - test/evidence-attack-binding-b.test.js
      - test/evidence-attack-binding-c.test.js
      - test/evidence-attack-capture-controls.test.js
      - test/evidence-attack-capture-outcome.test.js
      - test/evidence-attack-capture-receipt.test.js
      - test/evidence-attack-capture-summary.test.js
      - test/evidence-attack-closure.test.js
      - test/evidence-attack-handoff-malformed.test.js
      - test/evidence-attack-handoff-plan.test.js
      - test/evidence-attack-handoff-snapshot.test.js
      - test/evidence-attack-handoff-writers.test.js
      - test/evidence-round7.test.js
      - test/helpers/closure-fixture.js
      - src/util/frontmatter.js
      - test/evidence-adversarial.test.js
      - test/evidence-attack-crash.test.js
      - test/evidence-attack-delivered.test.js
      - test/evidence-attack-history.test.js
      - test/evidence-attack-reads.test.js
      - test/evidence-attack-rejected.test.js
      - test/helpers/evidence-fixture.js
      - test/evidence-run.test.js
      - test/handoff-schema.test.js
      - test/handoff.test.js
      - test/receipt.test.js
      - test/runtime-coverage.test.js
      - test/seal.test.js
      - test/source-snapshot.test.js
      - test/remediation-source.test.js
      - test/remediation-chain.test.js
      - test/remediation-runtime.test.js
      - test/remediation-variants.test.js
      - test/remediation-round10.test.js
      - test/remediation-round10-variants.test.js
      - test/remediation-round10-flow.test.js
      - test/remediation-matrix.test.js
      - src/lifecycle/report-validation.js
      - src/lifecycle/repository-capabilities.js
---
# Tasks — Evidence-preserving, source-bound SDD harness

Run commands from the methodology root. The installed CLI points at the current source checkout; edit reusable code in an isolated worktree first. Preserve the preexisting modifications to `src/repos/classify.js`, `src/repos/plan.js` and `test/repos.test.js` byte-for-byte. No task authorizes push, merge or archive. Complete F06 before consumer F03/F01/F02; resume upstream F04/F05 only after those waves.

## Phase 0 — Isolation and reproduction

### Task 0.1 — Isolate methodology development
- **Done**: [x]
- **Files**: change execution evidence; isolated worktree.
- **Depends on**: approved design.
- **Success criterion**: record original/worktree branch, HEAD, installed CLI resolution and protected hashes; protected files stay unchanged (SEC-006).
- **Linked acceptance criterion**: AC-11.

### Task 0.2 — Pin F06 failures with red tests
- **Done**: [x]
- **Files**: `test/tokens.test.js` and a focused runner test if needed.
- **Depends on**: Task 0.1.
- **Success criterion**: tests fail on current loss of counts/warnings/skips, exit 7 becoming 1, and >2.3 MB raw truncation; synthetic unknown failure and evidence-write failure cases included (SEC-003).
- **Linked acceptance criterion**: AC-1, AC-2.

## Phase 1 — F06 evidence capture

### Task 1.1 — Implement file-backed child capture
- **Done**: [x]
- **Files**: `src/cli/run.js`, `src/tokens/run.js`, focused tests.
- **Depends on**: Task 0.2.
- **Success criterion**: binary stdout/stderr files and hashes match child bytes beyond the old buffer limit; child exit/signal/spawn result retained; capture failure cannot report success; argv is never shell-interpreted (SEC-001, SEC-003).
- **Linked acceptance criterion**: AC-2.

### Task 1.2 — Add bounded NORMAL and lossless RAW modes
- **Done**: [x]
- **Files**: `src/cli/run.js`, `src/tokens/run.js`, CLI tests.
- **Depends on**: Task 1.1.
- **Success criterion**: NORMAL includes observed test/assertion counts, warnings, skips and unknown diagnostics within disclosed bounds; `--raw` forwards each stream exactly; `--raw --json` fails and child flags after `--` survive (SEC-001).
- **Linked acceptance criterion**: AC-1, AC-2.

### Task 1.3 — Apply lossless capture to `gate-check`
- **Done**: [x]
- **Files**: `src/repos/gate-check.js`, focused tests.
- **Depends on**: Task 1.1.
- **Success criterion**: large synthetic output and exit 7 yield complete raw files and the original exit; missing executable and persistence failure are distinct errors (SEC-003).
- **Linked acceptance criterion**: AC-2, AC-5.

### Task 1.4 — Validate F06 before later waves
- **Done**: [x]
- **Files**: English execution evidence under this change.
- **Depends on**: Tasks 1.1–1.3 plus consumer global-hook canaries.
- **Success criterion**: all seven approved canaries, large-output fidelity and permission neutrality pass; any failure stops F03/F04/F05 (SEC-001, SEC-004).
- **Linked acceptance criterion**: AC-1, AC-11.

## Phase 2 — F04 generic handoff and evidence

### Task 2.1 — Define generic artifact schemas
- **Done**: [x]
- **Files**: new handoff/receipt/binding/closure schemas and relevant existing schemas; schema tests.
- **Depends on**: Task 1.4 and completed consumer F03/F01/F02.
- **Success criterion**: valid fixtures pass; missing refs/identity/repository SHA, malformed hashes and paths fail; no LIA-specific identifiers (SEC-002, SEC-004).
- **Linked acceptance criterion**: AC-3, AC-5.

### Task 2.2 — Generate source-bound handoff
- **Done**: [x]
- **Files**: `src/tokens/packet.js`, `src/cli/packet.js`, packet tests.
- **Depends on**: Task 2.1.
- **Success criterion**: AC/EC/SEC, spec/design/tasks, repo identity, architecture, canonical skills/tools and producer are present; changing contract bytes with unchanged metadata invalidates freshness; escaping paths reject (SEC-002).
- **Linked acceptance criterion**: AC-3, AC-4.

### Task 2.3 — Record identity and governed snapshots
- **Done**: [x]
- **Files**: `src/tokens/run.js`, `src/repos/gate-check.js`, new evidence helper, tests.
- **Depends on**: Task 2.1.
- **Success criterion**: receipts record agent/provider/model provenance, stage/change, repo/branch/SHA, normative/contract/source hashes, allowlisted environment, command/time/status and raw reference; unknown agent blocks strict eligibility, no credential dump (SEC-003, SEC-004).
- **Linked acceptance criterion**: AC-5, AC-8.

### Task 2.4 — Bind evidence-only commits explicitly
- **Done**: [x]
- **Files**: evidence helper/CLI, `src/cli/dispatch.js`, binding tests.
- **Depends on**: Task 2.3.
- **Success criterion**: changed SHA fails until explicit binding; identical governed bytes and enumerated evidence-only delta bind with lineage; changed source/contract/tasks or missing ancestry rejects (SEC-004).
- **Linked acceptance criterion**: AC-4, AC-8.

### Task 2.5 — Retain archive proof outside the active change
- **Done**: [x]
- **Files**: evidence helper/CLI, closure schema/tests, `skills/sdd-archive/canonical.md`.
- **Depends on**: Tasks 2.2–2.4.
- **Success criterion**: complete integrity-indexed evidence survives synthetic change-folder deletion; unsafe path, absent raw log and partial copy block cleanup while preserving originals (SEC-002, SEC-003, SEC-005).
- **Linked acceptance criterion**: AC-6.

## Phase 3 — F05 machine-enforced lifecycle

### Task 3.1 — Reject incomplete runtime coverage
- **Done**: [x]
- **Files**: `src/adapters/index.js`, `src/cli/validate.js`, relevant schemas/tests.
- **Depends on**: Tasks 2.1–2.3.
- **Success criterion**: omitted applicable adapter, empty report, unrelated receipt, missing criterion mapping, invalid exclusion and missing substitute evidence all fail closed (SEC-004).
- **Linked acceptance criterion**: AC-7, AC-10.

### Task 3.2 — Share source freshness across CLI decisions
- **Done**: [x]
- **Files**: evidence helper, `src/cli/validate.js`, `src/cli/status.js`, `src/lifecycle/preconditions.js`, CLI tests.
- **Depends on**: Tasks 2.4 and 3.1.
- **Success criterion**: `validate`, `status`, `next` and stage preconditions agree; stale SHA and changed contract/source/normative plan invalidate prior gates; generated evidence does not self-stale (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task 3.3 — Bind verification/archive to unanimous delivery
- **Done**: [x]
- **Files**: `src/lifecycle/engine.js`, status/precondition modules, engine/CLI tests.
- **Depends on**: Task 3.2.
- **Success criterion**: pre-merge verification, open PR with scalar `verification: passed`, conflicting repo delivery and `proposal.status: archived` without closure are rejected; valid post-merge verification remains routable (SEC-005).
- **Linked acceptance criterion**: AC-9, AC-10.

### Task 3.4 — Align canonical stage skills
- **Done**: [x]
- **Files**: affected `skills/*/canonical.md`, generated `SKILL.md`, `test/skill-contract.test.js`.
- **Depends on**: Tasks 2.5 and 3.3.
- **Success criterion**: skills use enforced CLI contracts; `npm run generate` and `npm run generate:check` pass; no generated file is manually edited or human approval bypassed (SEC-004, SEC-005).
- **Linked acceptance criterion**: AC-3, AC-6, AC-7, AC-9.

## Phase 4 — Quality gates and supported propagation

### Task 4.1 — Run generic regressions
- **Done**: [x]
- **Files**: focused tests and English execution evidence.
- **Depends on**: Tasks 1.1–3.4.
- **Success criterion**: old-code-red/new-code-green targeted tests, all nine lifecycle negative cases, JS syntax, complete `npm test`, schema and generation checks pass; user-file hashes unchanged (SEC-006).
- **Linked acceptance criterion**: AC-10, AC-11.

### Task 4.2 — Assess consumers and propagate safely
- **Done**: [x]
- **Files**: execution evidence and supported installed skill targets after impact review.
- **Depends on**: Task 4.1.
- **Success criterion**: active consumer migration impact documented; `playbook install --runtime all` updates both agent targets only when safe; Hub doctor/validate/status/next and feature canaries pass; unexpected invalidation stops propagation (SEC-006).
- **Linked acceptance criterion**: AC-11.

## Phase 5 — Quality gates

- **Format**: no formatter is configured; preserve repository ESM conventions.
- **Lint/type-check**: `node --check` for each changed JavaScript file from the methodology root.
- **Feature tests**: `node --test test/tokens.test.js test/adapters.test.js test/engine.test.js test/lifecycle-cli.test.js test/validate.cli.test.js` plus new focused test files.
- **Regression**: `npm test` and `npm run generate:check` from the methodology root.


## D1 prerequisite — New cross-repository alias source inventory

The user authorized sdd-plan only for this reconciliation. Original completed
tasks and execution reports above/below are preserved. This section adds two
pending generic tasks within F04 source inventory/propagation; it performs no
implementation. Read the consumer planning-report.md and approved D1 first.
The consumer has 13 corrective tasks ready; live migration depends on these
prerequisites. No LIA-specific name or downstream hash workaround is permitted.

Planning reproduced this in temporary synthetic Git repositories: a declared
untracked alias to an owning sibling source fails resolveContainedPath, while
the same alias when tracked is hashed by its link bytes and detects mutation.
This requires generic source identity support, not an exception allowing
canonical file reads outside their owning repository.

### Task U.D1.1 — Regress and correct declared alias inventory upstream
- **Done**: [x]
- **Files**: `src/tokens/evidence.js`, `test/source-snapshot.test.js`; `test/handoff.test.js` or `test/handoff-schema.test.js` for owning-source binding coverage.
- **Depends on**: current preservation/isolation preflight, approved companion F04 contract and consumer D1.0. Confirm the correction fits the approved design before implementation; otherwise stop for a precise design delta.
- **Success criterion**: in an isolated worktree, add a generic red-first regression for a newly declared workspace alias; correct only inventory behavior so the alias identity is governed without following it to read outside its root. Link-byte mutation and owning canonical/resource-content mutation invalidate the corresponding source-bound handoff. Canonical-reference containment, forbidden secret/escaping source descriptors and existing broken-reference checks continue to fail closed. Unknown ownership or unsafe target never becomes an implicit external read. No LIA-specific policy, security-control weakening, generated-skill edit or production implementation during this plan (SEC-002, SEC-004, SEC-006).
- **Linked acceptance criterion**: AC-3, AC-4, AC-8, AC-10.

### Task U.D1.2 — Validate and propagate corrected generic inventory safely
- **Done**: [x]
- **Files**: methodology and consumer execution evidence, generated handoffs, supported local installation state only.
- **Depends on**: U.D1.1 and original Task 4.2 consumer-impact safeguards.
- **Success criterion**: targeted `rtk proxy node --test test/source-snapshot.test.js test/handoff.test.js test/handoff-schema.test.js`, complete `rtk proxy npm test`, `rtk proxy npm run generate:check` and changed artifact/schema checks pass in isolation; all protected user-file hashes remain unchanged. Assess active consumers before a narrowly reconciled source rollout and supported `rtk proxy playbook install --runtime all`. If generated sources change, edit canonical.md and run generation first; this task proposes none. Preserve 0.9.2/range/lock unless an existing contract requires an explicit migration. Refresh both current manifests and run consumer doctor/validate/status/next plus the new alias/resource canary. Unsafe rollout, unrelated-file drift or retained negative-test failure blocks propagation; global CLI linkage must not cause premature rollout (SEC-003, SEC-004, SEC-006).
- **Linked acceptance criterion**: AC-4, AC-8, AC-10, AC-11.

## Review remediation — sdd-code-review findings (2026-10-07)

The first `sdd-code-review` of this change returned `failed` (code-review-report.md, preserved). The user approved correcting Issues 1–6 through a bounded `sdd-apply` in the isolated worktree, and approved the Issue 1 rule in design.md Amendment R1. Completed tasks, execution reports and the failed review remain historical evidence. Every task below needs a regression that fails first on the current code. Protected files `src/repos/classify.js`, `src/repos/plan.js` and `test/repos.test.js` stay byte-identical, and the worktree copies of those three files are never copied back. No consumer-local workaround, review rerun, staging, commit, push, merge or archive is part of these tasks.

### Task R.1 — Record the approved rebind decision in the design
- **Done**: [x]
- **Files**: `openspec/changes/harness-trust-restoration/design.md`.
- **Depends on**: user decision on Issue 1.
- **Success criterion**: design.md carries Amendment R1 with the seven approved conditions and the two clarifications for Issues 2 and 6, before any implementation of R.7; original text and the previous copy are preserved (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-9.

### Task R.2 — Treat capture failures as ineligible evidence (Issue 3)
- **Done**: [x]
- **Files**: `src/tokens/receipt.js`, `src/tokens/retention.js`, `test/receipt.test.js`, `test/evidence-run.test.js`.
- **Depends on**: R.1.
- **Success criterion**: red-first regression with an injected fsync/close failure shows a receipt carrying `capture_error` and `exit_code: 0` is accepted today; after the fix `validateReceiptReference`, seal, runtime coverage and retention reject it, as they reject a non-null signal, while the wrapper still reports an evidence error (EC-1, SEC-004).
- **Linked acceptance criterion**: AC-5, AC-10.

### Task R.3 — Make stage preconditions agree with status and next (Issue 4)
- **Done**: [x]
- **Files**: `src/cli/validate.js`, `src/lifecycle/preconditions.js`, `test/lifecycle-cli.test.js`.
- **Depends on**: R.1.
- **Success criterion**: red-first CLI fixture with only a sealed runtime gate shows `validate --precondition sdd-commit` returns met while `next` routes to `sdd-code-review`; after the fix the commit, verify and archive preconditions derive from the same evaluator as `next` (state and evidence issues) and the two agree on the same fixture (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.4 — Implement the approved exit-code contract (Issue 5)
- **Done**: [x]
- **Files**: `src/tokens/capture.js`, `test/evidence-run.test.js`.
- **Depends on**: R.1.
- **Success criterion**: red-first tests show a non-executable command exits 1 and SIGSEGV/SIGUSR1 exit 128; after the fix a non-executable command exits 126, executable-not-found 127, signal termination `128 + signal number` for any signal known to the platform, and a normal exit such as 7 is preserved (SEC-003).
- **Linked acceptance criterion**: AC-2.

### Task R.5 — Resolve capability applicability per repository (Issue 6)
- **Done**: [x]
- **Files**: `src/lifecycle/runtime-coverage.js`, `test/runtime-coverage.test.js`.
- **Depends on**: R.1.
- **Success criterion**: red-first tests show a multi-repository change silently inherits aggregate Hub capabilities and a criterion mapped to a capability the repository declares disabled is accepted; after the fix explicit `repos.<name>.capabilities` is required for multi-repository changes, and a mapping to a disabled capability is a specific blocking issue. Single-repository fixtures keep working (SEC-004).
- **Linked acceptance criterion**: AC-7, AC-10.

### Task R.6 — Validate runtime exclusions as designed (Issue 2)
- **Done**: [x]
- **Files**: `src/lifecycle/runtime-coverage.js`, `src/lifecycle/eligibility.js`, `schemas/runtime-gate-report.schema.json`, `test/runtime-coverage.test.js`, `skills/sdd-runtime-gate/canonical.md` and its generated skill only if the exclusion fields need to be documented.
- **Depends on**: R.5.
- **Success criterion**: red-first test shows an exclusion with any reason string and any exit-0 receipt is accepted today for an enabled, mapped adapter; after the fix an exclusion also needs an approving authority reference matching a governed canonical reference and covered criteria that include every criterion mapping that adapter; missing, unknown or non-matching authority and incomplete criteria reject, and the previous accepting test becomes negative cases (AC-7, SEC-004, SEC-005).
- **Linked acceptance criterion**: AC-7, AC-10.

### Task R.7 — Rebind evidence across an identical implementation commit (Issue 1)
- **Done**: [x]
- **Files**: `src/tokens/evidence.js`, `src/tokens/handoff.js`, `src/tokens/seal.js`, `src/tokens/binding.js`, `schemas/handoff-manifest.schema.json`, `schemas/source-binding.schema.json`, `schemas/evidence-binding.schema.json`, `test/evidence-binding.test.js`, `test/seal.test.js`, `test/source-snapshot.test.js`, `test/handoff-schema.test.js`, `skills/sdd-commit/canonical.md` and its generated skill.
- **Depends on**: R.1, R.2.
- **Success criterion**: red-first real-order regression (dirty implementation, approved gates, identical commit, bind, next) shows the gates go stale today; after the fix `evidence bind` accepts it only under the seven conditions of Amendment R1, using a Git-tree digest recorded at gate time and recomputed at the destination commit, with lineage recorded and the original report untouched. Negative regressions: changed bytes, extra committed file, partial commit that leaves the working tree identical, deletion not committed, mode change, symlink change, changed normative or contract content, non-ancestor target, `failed` report, receipt with a capture error, missing receipt, and a report sealed before the digest existed all reject. The skill text tells the commit stage to run `evidence bind` per gate report (SEC-004, SEC-005).
- **Linked acceptance criterion**: AC-8, AC-9.

### Task R.8 — Validate and propagate the remediation safely
- **Done**: [x]
- **Files**: execution evidence, generated handoffs, supported local installation state only.
- **Depends on**: R.2–R.7.
- **Success criterion**: targeted tests, complete `npm test`, schema validation, `npm run generate:check` and `node --check` pass in the isolated worktree; generated skills (if any) come from canonical.md and `playbook install --runtime all` leaves both agent targets identical; only owned validated files are copied to the canonical checkout, protected-file hashes are unchanged, version 0.9.2 range and lock are unchanged; the LIA Hub validates as consumer without a local patch (SEC-003, SEC-006).
- **Linked acceptance criterion**: AC-10, AC-11.

## Review remediation, round 2 — second sdd-code-review (2026-10-07)

The second `sdd-code-review` returned `failed` (report preserved). The user approved the rules recorded in design.md Amendment R2 and authorized a bounded `sdd-apply` for Issues 7, 8 and 9. Completed tasks, execution reports and both failed reviews remain history. Each task needs a regression that fails first on the current code. The three protected files `src/repos/classify.js`, `src/repos/plan.js` and `test/repos.test.js` stay byte-identical, the worktree versions of them are never copied back, and their separate delivery is still undecided. No consumer-local patch, review, gate sealing, staging, commit, push, merge, verification or archive is part of these tasks; synthetic commits inside temporary fixtures are allowed.

### Task R.9 — Record the content-freshness and binding decision in the design
- **Done**: [x]
- **Files**: `openspec/changes/harness-trust-restoration/design.md`.
- **Depends on**: user decision on Issues 7 and 8.
- **Success criterion**: Amendment R2 carries the five freshness and CI conditions and the five binding conditions before any implementation; the previous copy is preserved privately (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-9.

### Task R.10 — Fresh by committed content, not by exact HEAD (Issue 7a)
- **Done**: [x]
- **Files**: `src/tokens/equivalence.js` (new, shared), `src/tokens/binding.js`, `src/tokens/handoff.js`, `src/tokens/receipt.js`, `src/tokens/seal.js`, `src/lifecycle/eligibility.js`, `src/cli/validate.js`, `test/handoff.test.js`, `test/evidence-binding.test.js`.
- **Depends on**: R.9.
- **Success criterion**: red-first test shows a committed manifest is stale at its own commit; after the fix it is fresh when ancestry, the committed tree digest, governed semantics and committed reference hashes match, and stale for changed bytes, a partial commit, a non-ancestor, an unavailable digest or a legacy manifest. The saved manifest and its stage copies are untouched, and `seal`/receipts still require a manifest generated at the current HEAD (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-9.

### Task R.11 — Immutable versioned bindings with verifiable lineage (Issue 8)
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, `schemas/evidence-binding.schema.json`, `src/cli/evidence.js`, `test/evidence-binding.test.js`.
- **Depends on**: R.10.
- **Success criterion**: red-first test shows a second bind or a later evidence commit has no way forward; after the fix bindings are keyed by report, repository and destination SHA, never overwritten, validated from the sealed snapshot, normative artifacts and original receipts, repeatable idempotently, contradictory ones fail, and an ancestral binding covers a later HEAD with identical governed content without writing another versioned file. Manipulated lineage, a real code or contract change, corrupt evidence, an incomplete inventory and an unverifiable ancestry reject. The flow seal, implementation commit, bind, binding commit, second evidence commit validates locally and terminates (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-9.

### Task R.12 — Portable CI validation with explicit local-only checks (Issue 7b)
- **Done**: [x]
- **Files**: `src/cli/validate.js`, `src/lifecycle/eligibility.js`, `src/tokens/handoff.js`, `src/tokens/binding.js`, `.github/workflows/playbook-validation.yml`, `templates/project/github/workflows/playbook-validation.yml`, `test/validate.cli.test.js`, `test/lifecycle-cli.test.js`.
- **Depends on**: R.10, R.11.
- **Success criterion**: red-first clean-clone test shows `validate --ci` fails today; after the fix a clean clone without private receipts or sibling repositories passes with `local-only` entries that name the reason, a corrupted portable artifact (schema, stage manifest hash, binding lineage, governed content) fails, a shallow clone reports ancestry as `local-only` and never valid, a present receipt is still validated, and `--ci` combined with a precondition is evaluated strictly and cannot satisfy it. Workflows fetch full history. Local `validate`, `status`, `next` and preconditions remain strict (SEC-004, SEC-005).
- **Linked acceptance criterion**: AC-8, AC-9, AC-10.

### Task R.13 — Correct the sdd-commit rebind commands (Issue 9)
- **Done**: [x]
- **Files**: `skills/sdd-commit/canonical.md` and its generated `SKILL.md`, `test/skill-contract.test.js`.
- **Depends on**: R.11, R.12.
- **Success criterion**: the skill names `playbook packet <change-id> --stage sdd-commit --agent <agent>` (plus observed provider and model), explains that an ancestral binding needs no new file, and that CI shows `local-only` entries; a skill-contract assertion fails on the old text. Generated skills come from canonical.md only (SEC-004).
- **Linked acceptance criterion**: AC-3, AC-9.

### Task R.14 — Validate and propagate round 2 safely
- **Done**: [x]
- **Files**: execution evidence, generated handoffs, supported local installation state only.
- **Depends on**: R.10–R.13.
- **Success criterion**: targeted tests, complete `npm test`, schema validation, `npm run generate:check` and `node --check` pass in the isolated worktree; only owned validated files are copied to the checkout; `playbook install --runtime all` changes only the regenerated skill; protected-file hashes, version, range and lock are unchanged; the LIA Hub validates as consumer without a local patch and its packets and handoffs are refreshed. The separate-delivery decision for the protected edits is documented and no delivery eligibility is claimed (SEC-003, SEC-006).
- **Linked acceptance criterion**: AC-10, AC-11.

## Review remediation, round 3 — third sdd-code-review (2026-10-07)

The third `sdd-code-review` returned `failed` (report preserved; the Hub failed only through this dependency). The user authorized a bounded `sdd-apply` for Issues 10 and 11 with the rules in design.md Amendment R3. The base is now the commit that includes the formerly protected edits, delivered separately; no protected edit remains in the working tree. Each task needs a regression that fails first on the current code. No consumer-local patch, review, gate sealing, staging, commit, push, merge, verification or archive is part of these tasks.

### Task R.15 — Record the receipt-path and lineage rules in the design
- **Done**: [x]
- **Files**: `openspec/changes/harness-trust-restoration/design.md`.
- **Depends on**: user authorization for Issues 10 and 11.
- **Success criterion**: Amendment R3 states the receipt-path shape and containment rule and the field-by-field binding and predecessor-chain rules before implementation; the previous design copy is preserved privately (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-9.

### Task R.16 — Reject malformed or escaping receipt references in every mode (Issue 10)
- **Done**: [x]
- **Files**: `src/lifecycle/eligibility.js`, `schemas/source-binding.schema.json`, `test/evidence-binding.test.js`, `test/receipt.test.js`.
- **Depends on**: R.15.
- **Success criterion**: red-first clean-clone test shows a receipt reference that escapes the project root or has extra segments passes `validate --ci` as `local-only` today; after the fix shape and containment are checked first, such a reference fails in CI and in strict mode, the schema accepts only one run directory, and only a well-formed contained absent receipt is `local-only`. Traversal, extra-segment, absolute and wrong-suffix references each have a regression (SEC-002, SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.17 — Verify every binding field and the complete predecessor chain (Issue 11)
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, `schemas/evidence-binding.schema.json`, `test/evidence-binding.test.js`.
- **Depends on**: R.15.
- **Success criterion**: red-first tests show that deleting `supersedes`, deleting `equivalence` or changing `governed_hash` or `evidence_only_paths` still validates today, including in portable validation; after the fix each fails in strict and portable validation, a missing predecessor and a non-predecessor entry fail, an honest chain passes, and unverifiable ancestry stays `local-only` in portable mode (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.18 — Validate and propagate round 3 safely
- **Done**: [x]
- **Files**: execution evidence, generated handoffs; no installed skill is expected to change.
- **Depends on**: R.16, R.17.
- **Success criterion**: targeted tests, complete `npm test`, `npm run generate:check`, `node --check` and schema validation pass in the isolated worktree; only owned validated files are copied to the checkout; version, range, lock and the committed base are unchanged; the LIA Hub validates as consumer without a local patch and both packets and handoffs are refreshed; nothing is staged or committed (SEC-003, SEC-006).
- **Linked acceptance criterion**: AC-10, AC-11.

## Review remediation, round 4 — fourth sdd-code-review (2026-10-07)

The fourth `sdd-code-review` returned `failed` (report preserved; the Hub failed only through this dependency). The user authorized a bounded `sdd-apply` for Issues 12, 13 and 14 with the rules in design.md Amendment R4. Each task needs a regression that fails first on the current code. No consumer-local patch, review, gate sealing, staging, commit, push, merge, verification or archive is part of these tasks.

### Task R.19 — Record binding identity, precedence and contained reads in the design
- **Done**: [x]
- **Files**: `openspec/changes/harness-trust-restoration/design.md`.
- **Depends on**: user authorization for Issues 12–14.
- **Success criterion**: Amendment R4 states the exact-expected-binding comparison, the deterministic precedence and the contained regular-file rule before implementation; the previous design copy is preserved privately (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-9.

### Task R.20 — Read only contained regular binding files (Issue 14)
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, `test/evidence-binding.test.js`.
- **Depends on**: R.19.
- **Success criterion**: red-first tests show a binding file replaced by a symlink to identical JSON outside the repository, and a `supersedes` path that is a symlink, absolute or contains `..`, still validate; after the fix each fails in strict and portable validation before any read, an honest chain still passes, and `bind` refuses to read such a candidate (SEC-002, SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.21 — Compare the complete expected binding (Issue 12)
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, `test/evidence-binding.test.js`.
- **Depends on**: R.20.
- **Success criterion**: red-first tests show a binding whose report repository or report path is altered (and one with an unknown extra field) validates in strict, portable and clean-clone CI; after the fix the recomputed expected record is compared field by field and each alteration fails in all three, with the earlier field-specific messages preserved (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.22 — Validate the latest applicable binding without falling back (Issue 13)
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, `test/evidence-binding.test.js`.
- **Depends on**: R.21.
- **Success criterion**: red-first tests show a valid older binding masks a contradictory later one in strict, portable and clean-clone CI, and that a repeated `bind` ignores it; after the fix only the latest applicable binding is validated, a contradictory one fails, non-linear history fails as ambiguous, bindings for destinations outside the HEAD history are ignored, a damaged predecessor that was superseded still passes, and `bind` follows the same selection (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.23 — Validate and propagate round 4 safely
- **Done**: [x]
- **Files**: execution evidence, generated handoffs; no installed skill is expected to change.
- **Depends on**: R.20–R.22.
- **Success criterion**: targeted tests, complete `npm test`, `npm run generate:check`, `node --check` and schema validation pass in the isolated worktree; only owned validated files are copied to the checkout; version, range, lock and the committed base are unchanged; the LIA Hub validates as consumer without a local patch and both packets and handoffs are refreshed; nothing is staged or committed (SEC-003, SEC-006).
- **Linked acceptance criterion**: AC-10, AC-11.

## Review remediation, round 5 — class-level correction (2026-10-08)

The fifth `sdd-code-review` returned `failed` (Issue 15; the Hub failed only through this dependency). Probes confirmed the same weakness in other inputs and two larger gaps: executable front matter and CI or post-merge contexts that could never pass. The user authorized a class-level correction with the rules in design.md Amendment R5, delivered evaluation on the base branch, and an independent adversarial check before the next review. Each task needs a regression that fails first. No consumer-local patch, review, gate sealing, staging, commit, push, merge, verification or archive is part of these tasks.

### Task R.24 — Record the evaluation model, checkout context and delivered evaluation
- **Done**: [x]
- **Files**: `openspec/changes/harness-trust-restoration/design.md`.
- **Depends on**: user authorization of Amendment R5.
- **Success criterion**: Amendment R5 states rules 1–8 before implementation; the previous design copy and the probe file are preserved privately (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-9.

### Task R.25 — Three-valued history and aggregated evaluation (Issue 15 and variants)
- **Done**: [x]
- **Files**: `src/tokens/equivalence.js`, `src/tokens/binding.js`, `src/tokens/handoff.js`, tests.
- **Depends on**: R.24.
- **Success criterion**: red-first tests show a nonexistent-SHA candidate masking a corrupt binding, a rewritten sealed commit passing CI without any binding, a history unknown in one repository masking a defect in another, and governed drift hidden behind unknown history; after the fix each fails in a complete clone and in strict mode, a shallow clone reports only genuinely undecidable checks as local-only while still failing any provable defect, and merge-introduced paths are classified (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.26 — Contained regular reads for every evidence file
- **Done**: [x]
- **Files**: `src/util/fs-safe.js`, `src/config/artifacts.js`, `src/cli/validate.js`, `src/tokens/handoff.js`, `src/tokens/binding.js`, `src/lifecycle/eligibility.js`, `src/tokens/receipt.js`, `src/tokens/seal.js`, `src/tokens/packet.js`, `src/tokens/retention.js`, tests.
- **Depends on**: R.24.
- **Success criterion**: red-first tests show a symlinked `handoff-manifest.json` with identical bytes outside the repository validates; after the fix every evidence file kind (proposal, tasks, design, reports, handoff and stage manifests, packet, bindings, receipts) replaced by an external symlink, an internal symlink or a directory fails in strict and portable validation without reading the target (SEC-002, SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.27 — Front matter is parsed as data only
- **Done**: [x]
- **Files**: `src/util/frontmatter.js` and every `src/` importer of `gray-matter`, tests.
- **Depends on**: R.24.
- **Success criterion**: red-first test shows `---js` front matter is executed by `playbook validate`; after the fix JavaScript and other non-YAML/JSON front matter is reported as an error and never executed by validate, status, next, packet or bind, and no `src/` module imports `gray-matter` directly (SEC-002).
- **Linked acceptance criterion**: AC-10.

### Task R.28 — Checkout context: detached HEAD, pull-request CI and foreign branches
- **Done**: [x]
- **Files**: `src/tokens/evidence.js`, `src/tokens/equivalence.js`, `src/tokens/handoff.js`, `src/tokens/binding.js`, both `playbook-validation.yml` workflows, tests.
- **Depends on**: R.25.
- **Success criterion**: red-first tests show a detached checkout of the reviewed head crashes `validate --ci`; after the fix portable validation of a detached head applies all content rules and reports only branch identity as local-only, strict validation fails with the remedy, writers refuse detached HEAD, evidence evaluated on another non-base branch fails, and both workflows check out the pull-request head branch with full history (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.29 — Delivered evaluation on the base branch
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, `src/tokens/handoff.js`, `src/lifecycle/eligibility.js`, `src/cli/validate.js`, `skills/sdd-verify/canonical.md`, `skills/sdd-commit/canonical.md`, generated skills, tests.
- **Depends on**: R.25, R.28.
- **Success criterion**: red-first tests show the base branch after a merge commit fails `validate --ci` and blocks the `sdd-verify` precondition; after the fix the base branch reports content comparison as not applicable after delivery (never passed), still fails a corrupt chain, an undelivered covered commit or an invalid latest binding, and strict eligibility on the base branch requires live merged delivery (SEC-004, SEC-005).
- **Linked acceptance criterion**: AC-8, AC-9, AC-10.

### Task R.30 — Permanent adversarial matrix
- **Done**: [x]
- **Files**: `test/evidence-adversarial.test.js`.
- **Depends on**: R.25–R.29.
- **Success criterion**: a table-driven suite applies every provable defect (per evidence file kind and per history manipulation) to strict validation, a complete clean clone, a shallow clone, a detached head and the base branch after merge, and asserts that every provable defect fails in every mode and that local-only or not-applicable entries never appear alone when a provable defect exists (SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.31 — Independent adversarial check
- **Done**: [x]
- **Files**: private evidence; any correction stays within Amendment R5.
- **Depends on**: R.30.
- **Success criterion**: an independent agent attacks the implementation in an isolated copy using rules 1–8; each confirmed finding is fixed with a regression or recorded with the reason it is out of scope (SEC-004).
- **Linked acceptance criterion**: AC-10.

### Task R.32 — Validate and propagate round 5 safely
- **Done**: [x]
- **Files**: execution evidence, generated handoffs, installed skills.
- **Depends on**: R.25–R.31.
- **Success criterion**: targeted tests, complete `npm test`, `npm run generate:check`, `node --check` and schema validation pass in the isolated worktree; only owned validated files are copied to the checkout; installed skills match the generated ones; version, range, lock and the committed base are unchanged; the LIA Hub validates as consumer without a local patch and both packets and handoffs are refreshed; nothing is staged or committed (SEC-003, SEC-006).
- **Linked acceptance criterion**: AC-10, AC-11.

## Review remediation, round 6 — sixth sdd-code-review (2026-10-08)

The sixth `sdd-code-review` returned `failed` (Issues 16 and 17; the Hub failed only through this dependency). Both are places where the code does not yet apply rules already approved in design.md Amendment R5; a sweep found one more instance of the same class (the contract read in `packet.js`). The user authorized this bounded `sdd-apply` without new design decisions. Each task needs a regression that fails first. No consumer-local patch, review, gate sealing, staging, commit, push, merge, verification or archive is part of these tasks.

### Task R.33 — Evaluate every repository independently when the SDD root is delivered (Issue 17)
- **Done**: [x]
- **Files**: `src/tokens/handoff.js`, `src/tokens/binding.js`, `test/evidence-adversarial.test.js`.
- **Depends on**: user authorization of round 6.
- **Success criterion**: red-first tests show that, with the SDD root on its base branch, a context repository still on its sealed branch can change governed content while the handoff manifest, the gate bindings and clean-clone `validate --ci` pass; after the fix that change fails in strict, portable and clean-clone validation, the reverse control (context delivered, SDD root on its change branch) and an honest mixed state behave as specified, and the after-delivery exemption applies only to repositories classified on their base branch (Amendment R5 rules 1, 6, 7; SEC-004).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.34 — Apply the contained-read rule to change-local references, the packet contract and closure copies (Issue 16)
- **Done**: [x]
- **Files**: `src/util/fs-safe.js`, `src/tokens/evidence.js`, `src/tokens/packet.js`, `src/tokens/retention.js`, `test/evidence-adversarial.test.js`, `test/closure-retention.test.js`.
- **Depends on**: user authorization of round 6.
- **Success criterion**: red-first tests show a declared reference, a configured contract and a closure artifact inside `openspec/changes/<id>/` that are internal symbolic links are read and accepted; after the fix each is refused before reading in packet, strict and portable validation and retention, while references outside the change directory (such as native skill-directory aliases) keep their behavior; a valid closure index with `raw_root` validates and one with a symbolic link on a raw path fails (Amendment R5 rule 4; SEC-002, SEC-004).
- **Linked acceptance criterion**: AC-4, AC-10.

### Task R.35 — Sweep for remaining instances of both classes
- **Done**: [x]
- **Files**: execution evidence.
- **Depends on**: R.33, R.34.
- **Success criterion**: every place that treats a delivered repository specially and every read of a path that can lie in a change directory or the run store is listed with its disposition in the execution report.
- **Linked acceptance criterion**: AC-10.

### Task R.36 — Validate and propagate round 6 safely
- **Done**: [x]
- **Files**: execution evidence, generated handoffs.
- **Depends on**: R.33–R.35.
- **Success criterion**: targeted tests, complete `npm test`, `npm run generate:check` and `node --check` pass in the isolated worktree; only owned validated files are copied; version, range, lock and the committed base are unchanged; the LIA Hub validates as consumer without a local patch and both packets and handoffs are refreshed; nothing is staged or committed (SEC-003, SEC-006).
- **Linked acceptance criterion**: AC-10, AC-11.

## Review remediation, round 7 — seventh sdd-code-review (2026-10-08)

The seventh `sdd-code-review` returned `failed` with Issues 18–25 (the Hub failed only through this dependency). Four are variants of classes already worked (20, 22, 24, 25) and four lie in subsystems not attacked before (18, 19 capture; 21 plan normalization; 23 closure). The user approved a written exit rule (design.md Amendment R6), the correction of all eight, and an independent audit of the whole surface by subsystem before the next review. Each fix needs a regression that fails first. No consumer-local patch, review, gate sealing, staging, commit, push, merge, verification or archive is part of these tasks.

### Task R.37 — Record the review exit rule
- **Done**: [x]
- **Files**: `openspec/changes/harness-trust-restoration/design.md`.
- **Depends on**: user approval of Amendment R6.
- **Success criterion**: Amendment R6 states what blocks, what is a follow-up and the review scope; the previous design copy is preserved privately (SEC-004).
- **Linked acceptance criterion**: AC-9.

### Task R.38 — Capture parses each stream independently and keeps the child outcome (Issues 18, 19)
- **Done**: [x]
- **Files**: `src/tokens/capture.js`, `src/repos/gate-check.js`, tests.
- **Depends on**: R.37.
- **Success criterion**: red-first tests show a partial stdout line merged with a stderr warning hides the warning and totals, and a persistence failure after the child exits replaces its exit code with 1; after the fix each stream is parsed on its own with counters aggregated, and every post-execution error keeps the child's exit code, signal and spawn status separate from the capture error (AC-1, AC-2, EC-1).
- **Linked acceptance criterion**: AC-1, AC-2.

### Task R.39 — Normative plan hash keeps every section after an Execution Report (Issue 21)
- **Done**: [x]
- **Files**: `src/tokens/evidence.js`, tests.
- **Depends on**: R.37.
- **Success criterion**: red-first test shows a new task section after an Execution Report leaves the normative hash unchanged; after the fix only Execution Report sections themselves and completion checkboxes are excluded, and task text, files, criteria or commands added before or after a report change the hash (AC-8).
- **Linked acceptance criterion**: AC-8.

### Task R.40 — Context repositories on their base branch prove their reviewed content (Issue 20)
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, `src/tokens/handoff.js`, tests.
- **Depends on**: R.37.
- **Success criterion**: red-first test shows a context repository reviewed with uncommitted content is accepted once on its base branch; after the fix a delivered context repository needs a commit in its history whose committed governed digest equals the reviewed digest and whose references keep their sealed hashes, without requiring it to deliver the consumer change (R5 rules 6–7).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.41 — Every reference is judged per available unit when a sibling is absent (Issue 25)
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, `src/tokens/handoff.js`, tests.
- **Depends on**: R.37.
- **Success criterion**: red-first test shows a changed available architecture reference is accepted when an unrelated sibling is absent; after the fix every saved reference and declaration in an available repository is checked and an absent repository only adds its own local-only note (R5 rule 1).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.42 — Report and stage manifest must match exactly (Issue 24)
- **Done**: [x]
- **Files**: `src/tokens/binding.js`, tests.
- **Depends on**: R.37.
- **Success criterion**: red-first test shows a code-review report carrying a security-gate `source_binding` passes portable CI; after the fix the pinned manifest must be schema-valid, belong to this change and carry the stage of its report in every mode, before any private check (AC-8).
- **Linked acceptance criterion**: AC-8, AC-10.

### Task R.43 — Existing immutable stage files are read only when contained and regular (Issue 22)
- **Done**: [x]
- **Files**: `src/tokens/handoff.js`, tests.
- **Depends on**: R.37.
- **Success criterion**: red-first test shows the writer reads an existing stage file through a symbolic link; after the fix every existing stage-file read in the writer uses the contained-read rule and a non-regular or symbolic-link file is refused (R5 rule 4).
- **Linked acceptance criterion**: AC-4, AC-10.

### Task R.44 — Closure retains the complete evidence graph and rejects partial indexes (Issue 23)
- **Done**: [x]
- **Files**: `src/tokens/retention.js`, `schemas/closure-index.schema.json`, tests.
- **Depends on**: R.37.
- **Success criterion**: red-first tests show retention omits a declared change-local reference and a reduced index (proposal only, no raw, foreign commit) validates; after the fix every change-local reference pinned by the handoff manifest is retained, the index must contain the verification report, its stage manifest, the gate reports and their receipts' raw links, and the verified commit must match the verification's sealed commit (AC-6, AC-9, AC-10).
- **Linked acceptance criterion**: AC-6, AC-9.

### Task R.45 — Independent audit of the whole surface
- **Done**: [x]
- **Files**: private evidence; corrections within Amendments R1–R6.
- **Depends on**: R.38–R.44.
- **Success criterion**: independent agents, one per subsystem, attack an isolated copy against Amendments R1–R6 and classify findings under the exit rule; every blocking finding is fixed with a regression and every non-blocking one is recorded as a follow-up (SEC-004).
- **Linked acceptance criterion**: AC-10.

### Task R.46 — Validate and propagate round 7 safely
- **Done**: [x]
- **Files**: execution evidence, generated handoffs.
- **Depends on**: R.45.
- **Success criterion**: complete `npm test`, `npm run generate:check` and `node --check` pass in the isolated worktree; only owned validated files are copied; version, range, lock and the committed base unchanged; the LIA Hub validates as consumer; nothing is staged or committed (SEC-003, SEC-006).
- **Linked acceptance criterion**: AC-10, AC-11.

## Execution Report — F06 interim

- **Result**: VALIDATED for the scoped LIA/methodology roots.
- **Evidence**: `f06-execution-report.md`: five initial red regressions, then 94 focused and 457 installed-checkout tests passed; full raw suite evidence is linked there. The three unrelated modified files retained baseline hashes. F04/F05 tasks remain open.

## Execution Report — D1 prerequisite (U.D1.1–U.D1.2), 2026-10-06

- **Result**: both prerequisite tasks applied; all tasks in this plan are marked complete and status is passed. This is an apply result only: no code-review, gate, commit, push, merge or archive ran; delivery stays uncommitted.
- **Approved-design fit**: the correction is inventory-only and fits F04 source binding (design.md: referenced symlinks resolve within their authorized repository boundary; required inventory that cannot be established blocks binding). No design delta, ADR or LIA-specific code was needed.
- **Red first**: a new `test/source-snapshot.test.js` case for a declared untracked alias failed with `refusing to resolve path outside the project root` before the change.
- **Change (isolated worktree, then three owned files copied to the installed checkout)**: `src/tokens/evidence.js` validates a declared symlink through its parent directory and governs it by link bytes (target never read); non-link declared paths keep full realpath containment. Tests added in `test/source-snapshot.test.js` (alias identity, owning-resource mutation, unsafe descriptors, rejected alias read) and `test/handoff.test.js` (alias retarget and owning canonical/resource mutation each stale the manifest).
- **Verification**: targeted `node --test test/source-snapshot.test.js test/handoff.test.js test/handoff-schema.test.js` 17/17; isolated worktree `npm test` 499/499; installed checkout through `playbook run` `npm test` 501/501; `npm run generate:check` no drift (13 skills); `node --check` on changed JavaScript. Receipts are under `.specloom/runs/` of this repository (targeted, full suite and generate runs of 2026-10-06).
- **Preservation**: `src/repos/classify.js` a6f864d4…, `src/repos/plan.js` 4164e8eb…, `test/repos.test.js` ccb6807e… are byte-identical to the baseline. Version 0.9.2, compatible range and lock unchanged. `playbook install` was not needed: no canonical or generated skill changed, and the global link already resolves to this checkout.
- **Consumer impact**: only this change and the LIA companion declare `handoff.source_paths`; the correction only widens what a declared symlink may be. Both consumers' packets were regenerated and validate; the consumer canaries (alias identity, resource mutation, freshness) pass.
- **Limits**: caller-declared agent, provider and model unknown. The generic CLI runtime adapter remains experimental; no runtime gate exists for this change.

## Execution Report — consumer Hub ownership compatibility, 2026-10-07

No methodology code, generated skill, version or lock changed in this corrective
consumer session. `npm test` passed 501/501 and `npm run generate:check` found no
drift. Receipts: `.specloom/runs/1791383158891-22df460a-pv6dkt/` and
`.specloom/runs/1791383159096-d4f4c9ff-PUl6La/`; raw copies are retained under the
consumer private hub-skill-centralization-20261007T141451Z evidence directory.
Provider is caller-declared, model unknown. Companion handoff metadata updated;
current packet regenerated through the existing CLI. No review or later gate ran.

## Execution Report — review remediation R.1–R.8 (2026-10-07)

- **Result**: R.1–R.8 applied; all tasks of this plan are marked complete and status is passed. `code-review-report.md` (status `failed`) and every earlier report stay untouched as history. No `sdd-code-review`, gate, staging, commit, push, merge, verification or archive ran; delivery stays uncommitted. A new `sdd-code-review` is still required before any later stage.
- **Identity**: agent claude, provider and model unknown (caller-declared).
- **Authorization**: the user approved the Issue 1 rule with seven conditions (recorded in design.md Amendment R1) and approved correcting Issues 1–6 through `sdd-apply` in the isolated worktree. No other design decision was needed.
- **Red first**: the new regressions were written before each fix and failed on the original code. Raw output of the final comparison (new tests against the unmodified source: 21 failures, including the fsync-injection, signal, EACCES, aggregate-capability, exclusion-authority, precondition-agreement and real-order rebind cases) is in `/home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/review-remediation-20261007/red-first-against-original-source.txt`.

### Changes by task

| Task | Change | Regression |
|---|---|---|
| R.2 (Issue 3) | `receiptIneligibility` in `src/tokens/receipt.js`, used by `validateReceiptReference` and `retention.js`: a non-null `capture_error` or `signal` is ineligible. | `test/receipt.test.js` (injected fsync failure, signalled child), `test/seal.test.js` (seal refuses). |
| R.3 (Issue 4) | `src/cli/validate.js` computes the `sdd-commit`, `sdd-verify` and `sdd-archive` preconditions from `computeState` (the evaluator behind `next`) plus evidence issues; `SKILL_PRECONDITIONS` also names the review and security gates. | `test/lifecycle-cli.test.js` (only-runtime-sealed fixture; precondition met exactly when `next` routes to commit). |
| R.4 (Issue 5) | `childExitCode` in `src/tokens/capture.js`: 126 for EACCES/EPERM/ENOEXEC, 127 for ENOENT, `128 + os.constants.signals[signal]`, child status preserved. | `test/evidence-run.test.js` (126; SIGTERM, SIGUSR2, SIGABRT). |
| R.5 (Issue 6) | `src/lifecycle/runtime-coverage.js`: multi-repository changes need explicit `repos.<name>.capabilities`; a mapping to a disabled capability is a blocking issue; single-repository changes may use the aggregate. | `test/runtime-coverage.test.js`. |
| R.6 (Issue 2) | Exclusions need an `authority` reference governed by the handoff (requirement, design, spec, architecture or contract; same repository, path, hash) and `covered_criteria` including every criterion that maps the adapter; schema and `sdd-runtime-gate` canonical text updated, generated skill regenerated. | `test/runtime-coverage.test.js` (the previous accepting test became a complete-exclusion case plus negatives). |
| R.7 (Issue 1) | `tree_hash` (Git-comparable digest: file or symlink, executable bit, bytes, deletions as absence) recorded per repository in manifests and sealed source bindings, and `commitTreeDigest` for the destination commit (`src/tokens/evidence.js`). `evidence bind` accepts an implementation commit only when the destination tree digest equals the reviewed digest, the working tree digest agrees, governed references (requirement, design, spec, architecture, skills, contracts, normative plan) keep their sealed hashes in the destination commit, ancestry holds, the report is `passed`/`not_applicable` and its original receipts validate (`binding.js`). The governed manifest hash uses `tree_hash` when present. The binding records lineage (`equivalence`: both digests, committed governed paths, intervening commits, original receipts). `sdd-commit` canonical text gained step 5a. | `test/evidence-binding.test.js` (real order dirty -> gates -> commit -> bind -> next; partial commit; uncommitted deletion; unrecorded mode; extra file; missing normative artifact; changed bytes/normative; non-ancestor; failed, missing, corrupt and capture-failed evidence; legacy report; not delivery), `test/source-snapshot.test.js` (digest equality across commit, deletions, modes, symlinks, submodule -> unavailable). |

### Verification (through `playbook run`, step apply)

| Check | Result | Receipt |
|---|---|---|
| Isolated worktree `node --test` (before copying) | 526/526 | worktree run, same suite |
| Installed checkout `npm test` | 528/528 (includes the protected user test file) | `.specloom/runs/1791390151454-dc9e7777-2YdLnI` |
| `npm run generate:check` | no drift (13 skills) | `.specloom/runs/1791390170363-226f8b59-iEQJ1I` |
| Targeted `node --test` on receipt, evidence-run, runtime-coverage, lifecycle-cli, evidence-binding, source-snapshot, seal, handoff, handoff-schema, closure-retention, skill-contract | 148/148 | `.specloom/runs/1791390171017-2b6997d5-PJvRXP` |
| `node --check` on every changed JavaScript file | exit 0 | worktree, before copy |
| `playbook validate harness-trust-restoration` (methodology) | 8/8 valid after regenerating the packet | CLI output |

### Preservation and propagation

- Protected files `src/repos/classify.js` (a6f864d4…), `src/repos/plan.js` (4164e8eb…) and `test/repos.test.js` (ccb6807e…) are byte-identical to the baseline; the worktree copies of those three files were never copied back.
- Only 25 owned files were copied from the isolated worktree to the canonical checkout (4 schemas, 4 skill files, 10 source files, 7 test files).
- `playbook install --runtime all` changed exactly the two regenerated skills (`sdd-commit`, `sdd-runtime-gate`) in both agent targets; both targets are byte-identical to `skills/*/SKILL.md`. Version 0.9.2, compatible range and lock are unchanged.
- Consumer impact: manifests now carry `tree_hash`, so every existing packet and manifest regenerates; no gate had been sealed in either change, so nothing is invalidated. Only the LIA Hub change consumes these APIs; it is validated separately in its own report. Reports sealed before this change cannot be rebound across an implementation commit and must be rerun.

### Limits

- A rebind is rejected when Git normalizes line endings or filters content differently from the working tree (the digests then differ); the remedy is rerunning the gate on the committed SHA.
- Entries Git cannot compare consistently (submodule pointers) make the digest unavailable, which also rejects a rebind.
- Partial delivery, such as committing only owned files while leaving the protected user edits dirty, correctly rejects the rebind; delivery planning must resolve that before `sdd-commit`.

## Execution Report — review remediation round 2, R.9–R.14 (2026-10-07)

- **Result**: R.9–R.14 applied; all tasks of this plan are complete and status is passed. The two failed `code-review-report.md` versions are preserved (private copies). No `sdd-code-review`, gate, staging, commit, push, merge, verification or archive ran in a real repository; commits happened only inside temporary fixtures. Delivery stays uncommitted and no delivery eligibility is claimed.
- **Identity**: agent claude, provider and model unknown (caller-declared).
- **Authorization**: the user approved Issue 7 (freshness by content plus local-only CI), Issue 8 (immutable bindings by destination SHA), the separate delivery strategy for the protected edits, and a bounded upstream `sdd-apply`. The decisions are recorded in design.md Amendment R2.
- **Red first**: the new regressions failed on the original source (13 failures; raw output `review-remediation-20261007/round2/red-first-round2-against-original-source.txt`; two of those are artefacts of the scratch copy, which had no README or add-ons).

### Changes

| Task | Change | Regression |
|---|---|---|
| R.10 (Issue 7a) | New `src/tokens/equivalence.js` (ancestry, committed tree digest, governed references at the commit, typed unavailable-history and unavailable-repository errors) shared by `binding.js` and `handoff.js`. `validateHandoffManifest` accepts a later commit only after verifying ancestry, the committed `tree_hash`, governed semantics and committed reference hashes; `validate`, `status`, `next` and preconditions use it, `seal` and receipts keep requiring a manifest generated at the current HEAD. The saved manifest and stage copies are never rewritten. | `test/handoff.test.js` (identical commit stays fresh; changed bytes, partial commit, non-ancestor, legacy manifest and tampered hash stay stale). |
| R.11 (Issue 8) | Bindings are `evidence-binding-<report>-<repository>-<sha>.json`, immutable, validated against the sealed snapshot, normative artifacts and original receipts; `supersedes` records earlier bindings with hashes; repeating `bind` is idempotent; a contradictory binding fails; an ancestral binding covers a later HEAD with identical governed content, so validating writes nothing. | `test/evidence-binding.test.js` (seal, implementation commit, bind, binding commit, second evidence commit, empty commit and packet refresh all validate; idempotence, contradiction, six lineage manipulations, superseded lineage, real code and architecture change, non-ancestor history). |
| R.12 (Issue 7b) | `validate --ci` judges only what a clean checkout proves and lists the rest under `local_only` with the reason: private receipts that are absent, repositories that are not checked out, history that is unavailable. Present receipts are still validated; `--ci` never satisfies a precondition; both workflows fetch full history. | `test/evidence-binding.test.js` (clean clone without receipts or sibling passes with local-only; four provable defects fail; shallow clone reports ancestry local-only and a full clone does not; precondition bypass and altered receipt; workflows fetch full history). |
| R.13 (Issue 9) | `sdd-commit` canonical text and generated skill: packet command with `--stage sdd-commit --agent <agent>` in both places, explanation of immutable bindings, idempotence, ancestral coverage, and CI local-only limits. | `test/skill-contract.test.js`. |

### Verification (through `playbook run`, step apply)

| Check | Result | Receipt |
|---|---|---|
| Isolated worktree `node --test` | 540/540 | worktree |
| Installed checkout `npm test` | 542/542 (includes the protected user test file) | `.specloom/runs/1791394026195-cdae6a0f-knSVIw` |
| `npm run generate:check` | no drift | `.specloom/runs/1791394066140-16d5f068-xXZ1uu` |
| Targeted handoff, binding, schema, snapshot, seal, receipt, lifecycle-cli, skill-contract, retention tests | 136/136 | `.specloom/runs/1791394066812-7687f9cc-Dm6Anj` |
| `playbook validate` and `validate --ci` (methodology and Hub, local) | exit 0 / exit 0, 0 failed | `review-remediation-20261007/round2/ci-*.json` |

### Preservation and propagation

- Protected files `src/repos/classify.js` (a6f864d4…), `src/repos/plan.js` (4164e8eb…) and `test/repos.test.js` (ccb6807e…) unchanged; worktree copies of them were never copied. Fourteen owned files were propagated from the isolated worktree; `playbook install --runtime all` changed only `sdd-commit` in both agent targets (byte-identical to the generated skill). Version 0.9.2, range and lock unchanged.
- The new untracked source `src/tokens/equivalence.js` is declared in `handoff.source_paths` here and in the LIA Hub change, which is the only consumer-side metadata edit.
- `protected-edits-delivery-proposal.md` documents the separate delivery of the three protected edits. No file of them was staged or removed.

### Limits

- A merge-ref checkout in CI whose governed files differ from the sealed snapshot (the base branch advanced) is correctly reported as changed content and needs a rebase and revalidation.
- Git line-ending conversion or content filters make digests differ and reject a rebind; the remedy is rerunning the gate on the committed SHA.
- CI green accredits only what CI ran; local `status`, `next`, preconditions and verification stay strict. The Hub's own workflow still installs a tagged release that predates these checks until that pin moves.
- Commits in real repositories, rerunning `sdd-code-review`, sealing gates and the protected-edits delivery decision remain open.

## Execution Report — review remediation round 3, R.15–R.18 (2026-10-07)

- **Result**: R.15–R.18 applied; all tasks of this plan are complete and status is passed. The third failed `code-review-report.md` is preserved (private copy). No `sdd-code-review`, gate, staging, commit, push, merge, verification or archive ran in a real repository. The committed base (which already contains the formerly protected edits) was not modified; the three files match HEAD.
- **Identity**: agent claude, provider and model unknown (caller-declared).
- **Authorization**: the user approved a bounded upstream `sdd-apply` for Issues 10 and 11 with the rules recorded in design.md Amendment R3.
- **Red first**: five of the new regressions failed on the previous source (raw output `review-remediation-20261007/round3/red-first-round3-against-previous-source.txt`).

### Changes

| Task | Change | Regression |
|---|---|---|
| R.16 (Issue 10) | `schemas/source-binding.schema.json` accepts exactly `.specloom/runs/<one run directory>/execution-receipt.json` (no `.`/`..` segment, no nesting). `RECEIPT_REFERENCE_PATH` in `src/tokens/receipt.js` is used by `validateReceiptReference`. `src/lifecycle/eligibility.js` judges shape and containment first: only a well-formed, contained reference whose private file is absent is `local-only`; a malformed or escaping one is a defect in CI and strict mode. | schema accepts one run directory and rejects traversal, dot, nested, wrong-suffix and absolute paths; `validate --ci` and strict validation fail for each bad reference; a well-formed absent receipt stays `local-only`. |
| R.17 (Issue 11) | `bindingIssues` recomputes the destination from the sealed snapshot and compares `governed_hash` (the sealed digest), `evidence_only_paths`, the mandatory `equivalence` section (reviewed and committed digests, committed governed paths, intervening commits, original receipts) and rejects `equivalence` on an evidence-only destination. `supersedes` must list exactly the bindings of the same report and repository whose destination is a proper ancestor (omitted, foreign or altered entries fail); `bind` writes only proper-ancestor predecessors and records the sealed digest as `governed_hash`. Same in strict and portable validation. | six field mutations, evidence-only equivalence, omitted and foreign predecessors, honest chain, and a clean-clone `validate --ci` with an altered governed digest. |

### Verification (through `playbook run`, step apply)

| Check | Result | Receipt |
|---|---|---|
| Isolated worktree `node --test` | 549/549 | worktree |
| Installed checkout `npm test` | 549/549 | `.specloom/runs/1791402100995-9a4447c1-r3a95R` |
| `npm run generate:check` | no drift | `.specloom/runs/1791402153395-b1d6b30f-7IfII1` |
| Targeted binding, receipt, seal, handoff, schema, lifecycle-cli, retention, runtime-coverage tests | 82/82 | `.specloom/runs/1791402154040-7a67ff2b-xfoIOV` |

### Preservation and propagation

- Five owned files were copied from the isolated worktree (two sources, one more source, the schema and the test file). No canonical or generated skill changed, so no installation ran; installed skills are unchanged. Version 0.9.2, range and lock unchanged.
- The worktree copies of `src/repos/classify.js`, `src/repos/plan.js` and `test/repos.test.js` were refreshed from the committed base (they are no longer protected edits).

### Limits

- A binding written before this round (for example by round 2 code) records `governed_hash` as the working-tree digest at binding time and fails the new check; bindings must be recreated by rerunning `evidence bind` (new files are named by destination SHA, so the old ones stay as history). No real binding exists in the repositories yet.
- Real-repository commits, rerunning `sdd-code-review`, gate sealing and the Hub CI release pin remain open.

## Execution Report — review remediation round 4, R.19–R.23 (2026-10-07)

- **Result**: R.19–R.23 applied; all tasks of this plan are complete and status is passed. The fourth failed `code-review-report.md` is preserved (private copy). No `sdd-code-review`, gate, staging, commit, push, merge, verification or archive ran in a real repository; the committed base was not modified.
- **Identity**: agent claude, provider and model unknown (caller-declared).
- **Authorization**: the user approved a bounded upstream `sdd-apply` for Issues 12, 13 and 14 with the rules recorded in design.md Amendment R4.
- **Red first**: four of the new regressions failed on the previous source (raw output `review-remediation-20261007/round4/red-first-round4-against-previous-source.txt`); the predecessor-path shape test is a guard because the schema already rejected traversal and absolute paths.

### Changes (all in `src/tokens/binding.js`)

| Task | Change | Regression |
|---|---|---|
| R.20 (Issue 14) | Every binding file, candidate or predecessor, must be an exact change-local `evidence-binding-*.json` name, a regular file that is not a symbolic link, and inside the project root; the check uses `lstat` and runs before any read or hash. An unsafe candidate fails strict and portable validation and makes `bind` refuse. | symlinked candidate (also for `bind`), symlinked predecessor, traversal, absolute and other-directory predecessor paths. |
| R.21 (Issue 12) | The complete expected binding is recomputed from the sealed report and the destination (change, repository, report repository, exact change-local report path and hash, commits, sealed digest, evidence paths, equivalence, predecessor list with current file hashes) and compared field by field, creation time excluded; an unknown field is a difference. The earlier field-specific messages remain. | altered report repository, report path (foreign and same-change), unknown field, in strict, portable and clean-clone CI. |
| R.22 (Issue 13) | Of the bindings whose destination is the HEAD or a proper ancestor, only the latest (not a proper ancestor of another applicable one) is validated; zero applicable or more than one fails as ambiguous; validation never falls back to an older valid binding; predecessors are checked by their lineage hashes. `bind` uses the same selection: idempotent when the latest is valid, a new binding when it is not, failure on a contradictory binding for the same destination. | contradictory later binding in strict, portable, `bind` and clean-clone CI; binding for a destination outside the HEAD history ignored; non-linear history ambiguous; honest chain with a superseded damaged predecessor passes. |

### Verification (through `playbook run`, step apply)

| Check | Result | Receipt |
|---|---|---|
| Isolated worktree `node --test` | 555/555 | worktree |
| Installed checkout `npm test` | 555/555 | `.specloom/runs/1791406142491-5b4d6ae4-IWp59J` |
| `npm run generate:check` | no drift | `.specloom/runs/1791406212972-06ee2b1a-aWtIQ3` |
| Targeted binding, handoff, receipt, seal, lifecycle-cli, retention tests | 72/72 | `.specloom/runs/1791406213636-d4ce2e8b-rYWfRh` |

### Preservation and limits

- Two owned files were propagated (`src/tokens/binding.js`, `test/evidence-binding.test.js`). No skill or schema changed, so no installation ran. The three formerly protected files match the committed base; version 0.9.2, range and lock unchanged.
- A binding whose destination commit does not exist in the checkout is reported as unavailable history (a failure in strict mode, `local-only` in portable mode), never as ignored.
- Each review round has found further gaps in the binding validator; the exact-record comparison and the contained-read rule are meant to close the class, but a fifth adversarial review may still find more.
- Real-repository commits, rerunning `sdd-code-review`, gate sealing and the Hub CI release pin remain open.

## Execution Report — review remediation round 5, R.24–R.32 (2026-10-08)

- **Result**: R.24–R.32 applied; all tasks of this plan are complete and status is passed. The fifth failed `code-review-report.md` is preserved (private copy). No `sdd-code-review`, gate, staging, commit, push, merge, verification or archive ran in a real repository; the committed base was not modified except by the files listed below in the working tree.
- **Identity**: agent claude, provider and model unknown (caller-declared).
- **Authorization**: the user approved a class-level correction (design.md Amendment R5), delivered evaluation on the base branch, an independent adversarial check, and then three decisions on its findings (reviewed base plus pull-request CI by commit; every tracked file governed; closure raw root containment).
- **Diagnosis**: the recurring findings shared three causes — an "unknown" history raised as an exception and caught at the top, cancelling every other check; "unknown" defined too broadly (an absent commit in a complete clone was treated as possibly shallow); and containment rules applied per file type. Probes also confirmed executable front matter (`---js` evaluated by `validate`) and that pull-request CI (detached checkout) and the base branch after a merge could never pass, so Issue 7 was not solved in practice.
- **Red first**: on the previous source 15 of the new or changed tests failed (raw output `review-remediation-20261007/round5/red-first-round5-against-previous-source.txt`; two are artefacts of the scratch copy, which has no README or add-ons). The independent check's 19 defect probes failed before its fixes (`round5/independent-check/attack-run-before-fixes.txt`).

### Changes

| Task | Change | Regression |
|---|---|---|
| R.25 | `equivalence.js`: three-valued `ancestry` (absent commit in a complete history is "no"; unknown only when shallow), `assertAncestry` with a definitive message for rewritten or foreign history, tree-digest difference checked before history, changed paths include merge commits (`git log` plus `git diff`). `binding.js` and `handoff.js` rewritten around per-unit verdicts (repository, binding, lineage) aggregated so a failure always wins and an unknown never stops another unit; binding selection is decided only when every candidate is placeable, and a binding at HEAD is always the latest. | Issue 15, rewritten sealed commit without bindings, multi-repository masking, merge-introduced change (`test/evidence-adversarial.test.js`). |
| R.26 | `readEvidenceFile`/`unsafeEvidenceReason` (regular file, not a symbolic link, contained) used for every evidence read: artifacts, ADR drafts, plan, proposal for delivery, handoff and stage manifests, reports, packet, bindings, receipts, raw evidence, closure files. Symlinked change entries are reported and never followed. | Matrix rows for each evidence kind (external and internal symlink, directory), attack probes R1–R4, C3. |
| R.27 | `src/util/frontmatter.js` parses YAML or JSON only and refuses executable front matter; every `src/` module uses it (17 imports rewired, import line only). Unreadable artifacts are violations and block `next`. | `---js`/`---javascript` never executed by validate, status, next; reported as violation. |
| R.28 | `snapshotRepository` reports a detached HEAD as no branch; writers refuse it; strict validation fails with the remedy; portable validation applies every content rule and reports only branch identity local-only; another non-base branch fails. Pull-request CI checks out the exact head commit with full history (both workflows). The base branch is read from `playbook.config.yaml` recorded at the sealed SDD commit, never from the evaluated checkout. Git replace objects are never applied and grafts are refused. | Detached, renamed-branch, self-declared base (A2), head named like the base (A2b), replace refs (H2). |
| R.29 | Delivered evaluation on the base branch: chain intact, covered commit in HEAD history holding the reviewed digest and references, latest binding valid; content comparison reported under `after_delivery` (never passed); strict eligibility then requires live merged delivery. A report's `source_binding` must equal the identities and hashes of the stage manifest it pins, in every mode. `sdd-commit` and `sdd-verify` describe this. | Base branch after merge passes with `after_delivery` notes; forged report identities (A1) fail; strict delivered requires merged delivery. |
| R.30 | Permanent matrix: 15 defects × strict, complete clone, shallow clone, detached head and base branch after merge, plus a clean baseline. | `test/evidence-adversarial.test.js`. |
| R.31 | Independent check (a Claude agent with a clean context; Codex could not start: model not supported for the account) confirmed ten defects, all fixed: base self-declaration, report identities on the base branch, governed digest exclusions (vendored, `.env*`, `*.log` tracked files are governed now; an untracked `.env*` still cannot be declared), ADR and proposal and packet reads, closure raw root (`raw_root` in the closure index, schema extended), replace refs, crashes on malformed evidence, `__proto__` field. Probes kept as `test/evidence-attack-*.test.js`; findings in `round5/independent-check/FINDINGS.md`. | 25/25 attack tests. |

### Verification (through `playbook run`, step apply)

| Check | Result | Receipt |
|---|---|---|
| Isolated worktree `node --test` | 602/602 | worktree |
| Installed checkout `npm test` | 602/602 | `.specloom/runs/1791478280866-d3ca7d3e-eiq1O9` |
| `npm run generate:check` | no drift | `.specloom/runs/1791478440553-c08ebe87-ayPqNx` |
| Evidence, attack, binding, handoff, receipt, seal, retention, snapshot tests | 115/115 | `.specloom/runs/1791478441236-629e099e-cMDXKB` |

### Preservation, propagation and limits

- 41 owned files propagated by explicit list from the isolated worktree; `playbook install --runtime all` changed only `sdd-commit` and `sdd-verify` in both agent targets, byte-identical to the generated skills. Version 0.9.2, range, lock and package files unchanged.
- Governed digests changed (rule F3), so every earlier manifest and binding is stale and must be regenerated; no gate is sealed in a real repository yet.
- Accepted limits: a merge that ignored a red pull-request CI, or a branch named like the base validated by name outside pull-request CI, is judged as delivered; squash or rebase merges break lineage (all LIA repositories use merge commits); shallow clones report history-dependent checks as local-only; private receipts are local-only in CI. The Hub workflow still pins a release without these checks.

## Execution Report — review remediation round 6, R.33–R.36 (2026-10-08)

- **Result**: R.33–R.36 applied; all tasks are complete and status is passed. The sixth failed `code-review-report.md` is preserved (private copy). No review, gate, staging, commit, push, merge, verification or archive ran in a real repository.
- **Identity**: agent claude, provider and model unknown (caller-declared).
- **Authorization**: the user authorized this bounded `sdd-apply` for Issues 16 and 17 and the packet-contract variant found by the sweep, with no new design decisions (both issues are places where the code did not yet apply approved Amendment R5 rules).
- **Red first**: on the previous source the three defect tests failed; the raw-root symlink test and the reverse control passed there and are guards (raw output `review-remediation-20261007/round6/red-first-round6-against-previous-source.txt`).

### Changes

| Task | Change | Regression |
|---|---|---|
| R.33 (Issue 17) | A delivered SDD root no longer ends the handoff check: `perRepositoryCheck` (formerly the portable-only check) evaluates every repository that is not itself on its base branch, with its references, and returns history unknowns to the caller's mode. Gate bindings evaluate every context repository as its own unit (`contextRepositoriesVerdict`): delivered → after-delivery note plus ancestry; sealed branch → content and references; other branch → failure; detached → strict failure or portable branch-identity note. Only an impacted repository's after-delivery note demands live merged delivery; a context repository on its own base branch never does. | Delivered Hub with a drifted context repository fails in strict, portable and clean-clone validation; honest mixed state passes; reverse control (context delivered, Hub on its branch) keeps full rules for the Hub and does not demand merged delivery. |
| R.34 (Issue 16) | `readReference` in `fs-safe.js`: a reference inside `openspec/changes/` must be a regular, non-symlink, contained file; elsewhere a contained path may still resolve through an internal symlink (native skill-directory aliases). Used by `hashReference`, so manifests, packets and validation share it, and by the packet's contract read. Closure copies read each artifact through `readEvidenceFile` and write those exact bytes. | Change-local reference and contract as internal symlinks refused by packet, strict and clean-clone validation; closure refuses an internal `OWNER.md` symlink and publishes nothing; a valid `raw_root` validates and a symlink on a raw path fails. |

### R.35 sweep (dispositions)

- Delivered special cases: `classifyCheckouts` (note plus ancestry, per repository) — correct; `validateHandoffManifest` delivered root — fixed (R.33); `perRepositoryCheck` skips only delivered repositories and their references, and the plan only when the SDD root is delivered — correct; manifest comparisons substitute only delivered entries — correct; `normativeVerdict` skipped for a delivered root — normative sources are verified at the covered commit for impacted repositories and per context repository by `contextRepositoriesVerdict`; `portableReferences` excludes delivered roots — correct; eligibility merged-delivery rule — limited to impacted repositories (R.33).
- Reads that can reach a change directory or the run store: `hashReference` and packet contract — fixed (R.34); closure artifact copies — fixed (R.34); closure receipt and raw copies — read only after `validateReceiptReference` checked them with `readEvidenceFile`, then copied from the same paths (local time-of-check gap only, documented); declared untracked symlinks in `snapshotRepository` — hashed by link bytes and never followed, by approved design; `cli/repos.js` canonical contract path — configuration path for repository planning, not evidence validation.

### Verification (through `playbook run`, step apply)

| Check | Result | Receipt |
|---|---|---|
| Isolated worktree `node --test` | 607/607 | worktree |
| Installed checkout `npm test` | 607/607 | `.specloom/runs/1791482941791-23ad29fc-akexdm` |
| `npm run generate:check` | no drift | `.specloom/runs/1791483127782-94d9fc39-geIh0h` |
| Adversarial, retention, binding, handoff, attack tests | 83/83 | `.specloom/runs/1791483128449-28fc2c7c-rEOqJg` |

Nine owned files propagated; no skill or schema changed, so no installation ran. Version 0.9.2, range, lock and package files unchanged.

## Execution Report — review remediation round 7, R.37–R.46 (2026-10-08)

- **Result**: R.37–R.46 applied; all tasks of this plan are complete and status is passed. The seventh failed `code-review-report.md` is preserved (private copy). No review, gate, staging, commit, push, merge, verification or archive ran in a real repository.
- **Identity**: agent claude, provider and model unknown (caller-declared).
- **Authorization**: the user approved the review exit rule (design.md Amendment R6), the correction of Issues 18–25, a parallel subsystem audit before the next review, and the change-directory decision recorded in Amendment R6's refinement.
- **Red first**: the eleven Issue 18–25 regressions failed on the previous source (`review-remediation-20261007/round7/red-first-round7-against-previous-source.txt`); the subsystem audit probes failed 40 times on it, the other 35 being controls (`round7/red-first-round7-audit-against-previous-source.txt`).

### Issues 18–25

| Issue | Change |
|---|---|
| 18 | Both captures parse stdout and stderr with separate collectors and aggregate the counters; the synchronous capture writes each stream straight to its own file (no pipe, so nothing is lost when the child exits early) and builds `full.log` as stdout then stderr (cross-stream order is an accepted limit). |
| 19 | Every error after the child ran keeps its exit code, signal and spawn error in `childOutcome`, separate from the capture error. |
| 20 | `proveDeliveredContent`: a repository on its base branch must have the reviewed digest in a commit from the sealed commit to HEAD, with references intact (handoff and context repositories). |
| 21 | `normativeTasksHash` drops only Execution Report sections (CommonMark headings, fenced code and front matter respected) and checkboxes. |
| 22 | Existing stage files are read only when contained and regular; writers (stage, handoff manifest, packet, seal) never write through a symbolic link (`writeEvidenceFile`). |
| 23 | Closure retains change-local references the manifest pins, requires every gate cleared with a valid binding, and validation requires mandatory membership, a passed merged verification, retained gates pinning their stage manifests, the verified proposal and plan, and receipts that agree with the retained chain. |
| 24 | A report's pinned manifest must be schema-valid, of this change and of the report's own stage, before any private check. |
| 25 | Portable validation rebuilds the manifest with unavailable repositories kept at their sealed entries, so every available reference is compared. |

### Subsystem audit (R.45)

Four independent agents (closure, capture, handoff/packet/seal, binding/validation) confirmed 14 blocking and 14 non-blocking findings with probes, now permanent tests (`test/evidence-attack-{closure,capture-*,handoff-*,binding-*}.test.js`). Blocking, all fixed: closure accepting an altered archive, a failed verification or failed gates, and lifecycle `archived` with a failed gate; receipts recorded with a stale or changing manifest; tracked directories, submodules and non-UTF-8 names outside the digest; plan-hash parsing gaps; writers through symbolic links; foreign-repository receipts hidden as local-only; bindings that claim the sealed report but contradict it when the sibling is absent; change-directory files outside the digest (user decision); EC/SEC without mapping or rationale; a sibling's own capabilities ignored. Non-blocking fixed because cheap or self-introduced: raw-path collisions and symbolic archive root at closure, spawn errors written into `stderr.raw`, a success mark for failed capture, precondition and runtime-report crashes, and comparisons that treated a different umask as a content change. Non-blocking follow-ups kept as `todo` tests and listed in design.md.

### Verification (through `playbook run`, step apply)

| Check | Result | Receipt |
|---|---|---|
| Isolated worktree `node --test` | 698 pass, 0 fail, 8 todo | worktree |
| Installed checkout `npm test` | 707 tests, 0 failures | `.specloom/runs/1791492690389-858c36be-7fT9xP` |
| `npm run generate:check` | no drift | `.specloom/runs/1791492891428-179b4c43-gg0lpK` |

35 owned files propagated by explicit list; no skill changed. Schemas extended: `handoff-manifest` (`non_runtime_criteria`). Version 0.9.2, range, lock and package files unchanged. This plan now declares `handoff.audit_evidence` (session handoff, delivery proposal, task history). Consumer consequence: before its runtime gate, each change must map or justify every EC and SEC.
## Phase R8 — Ninth-review remediation (2026-10-08)

- [x] R8.26 (R1/R5/R6, AC-3/8): Reject initialized dirty submodules recursively, including tracked edits, additions, deletions and changes during capture. Verify snapshot, handoff, receipt and bind.
- [x] R8.27 (R6, AC-3/8): Match audit exclusions by exact filename bytes in working and committed trees, with distinct UTF-8 and invalid-byte names present.
- [x] R8.28 (R1/R5/R6, AC-8): Preserve literal fenced and indented task commands, heredocs, blank lines and checkbox-shaped text while retaining administrative equivalence and later tasks.
- [x] R8.29 (R5/R6, AC-5/10): Enforce expected report schema, version, identity, required fields and sealed manifest across validate, status, next, preconditions, seal and bind.
- [x] R8.30 (R5/R6, AC-5/6/9): Reject rehashed contradictory retained reports and failed receipts using live semantic checks at archive roots.
- [x] R8.31 (R6, AC-6): Retain every prerequisite gate receipt and raw stream; reconstruct after deleting active change and run store in a private fixture.
- [x] R8.32 (R5/R6, AC-4): Refuse outside-resolving change artifact reads through parent and final symlinks while preserving authorized skill aliases.
- [x] R8.33 (R6, AC-7): Reject experimental CLI passed coverage in direct evaluation, eligibility and clone CI; preserve bounded substitute rules.
- [x] R8.34 (R6, AC-7): Fail on present invalid repository capability config and permit fallback only when legitimately absent.

## Execution Report — review remediation round 8, R8.26–R8.34 (2026-10-08)

- **Result**: The nine remediation tasks are implemented upstream. The preserved methodology and Hub `code-review-report.md` files remain `failed`; no independent review or later lifecycle gate ran.
- **Identity and evidence**: Codex, OpenAI, GPT-6, caller-declared. All verification commands were captured with `playbook run --change harness-trust-restoration --step apply --agent codex`. Private red and green probes, receipts, raw streams, and baseline are in `/home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/remediation-20261008/`.
- **Red first**: The independent Issue 26–34 probes failed on the pre-remediation source. The permanent remediation suite then failed 12 tests against that source before implementation. Positive controls were retained.
- **Changes**: byte-exact Git path exclusion; recursive fail-closed submodule snapshots; literal task command hashing; shared report and repository-capability validators; complete retained semantic and receipt graph validation; contained change-artifact reads; experimental CLI support enforcement. See `remediation-round8-report.md` for the issue matrix, variants and file list.
- **Verification**: `npm test` registered 735: 727 passed, 0 failed, 0 skipped, 8 TODO (`.specloom/runs/1791497571485-165fd65e-FgJpdN`). `npm run generate:check` passed without drift (`1791497741169-7a27db76-54145d`). Changed and new JavaScript syntax checks and installed skill parity passed (`1791497738338-1346052b-hTU2DC`). Independent adapted whole-flow, chain, runtime and eligibility probes passed 5/5, 7/7, 2/2 and 2/2; private clone and attack probes passed 2/2.
- **Limits**: The eight pre-existing TODO tests remain TODO. The generic CLI adapter is experimental; a future runtime gate requires its approved bounded substitute. Real app/API browser, HTTP and worker runtime evidence and the Hub's ten EC/SEC declarations remain pending. No real repository was staged, committed, pushed, merged, archived or installed globally.

## Phase R10 — Bounded reopening after the tenth independent review

The user explicitly authorized reopening only these remediation tasks under the existing approved R1–R6 rules. Earlier completed tasks and Execution Reports remain historical. Proposal, design and both failed review verdicts are unchanged. The new tasks start ready; strict sdd-apply preconditions must pass before in_progress. Implementation and fixture evidence are isolated before explicit owned-file propagation.

- [x] R10.26 (R1/R5/R6, AC-3/8/10, EC-4): Prove actual direct/nested submodule contents independently of index hints. Success: assume-unchanged and skip-worktree cannot conceal edits, deletion, type or executable changes before/during capture; clean and ignored-file controls preserve the approved scope.
- [x] R10.28 (R1/R5/R6, AC-8/10, EC-4): Preserve command literals in Markdown containers. Success: list-first, nested-list, quote, tab and continuation/heredoc variants produce distinct executed output and normative hashes; genuine administrative updates remain equivalent.
- [x] R10.30 (R5/R6, AC-6/9/10, EC-3/5): Join prerequisite and verification normative identities across the full retained graph. Success: independently and jointly contradictory proposal/design/tasks/canonical references reject despite coherent per-stage hashes; live, retained and portable controls and legitimate delivery equivalence pass without rewriting originals.
- [x] R10.32 (R5/R6, AC-4/10, SEC-2): Enforce change-artifact read safety for raw Git filenames. Success: tracked/untracked invalid-byte names cannot bypass parent/final symlink checks in snapshot and its consumers; private sentinels prove no external read/readlink before rejection; valid regular files and authorized skill aliases remain valid.
- [x] R10.33 (R5/R6, AC-7/10, EC-3): Validate every declared runtime adapter before required coverage. Success: extra unknown, disabled, experimental or unrelated receipt claims reject with actual fixture config; HTTP and authority/criterion/receipt-bound CLI not_applicable controls pass.

- [x] R10.31 (R5/R6, AC-5/6/10, EC-1/5): Preserve every required report receipt edge, including additional adapter, substitute and coverage references outside source_binding.receipts. Success: original additional receipt and raw survive active/run-store disposal; invalid runtime coverage prevents retention publication; valid bounded substitutes remain reconstructible. This bounded class variant was reproduced during the authorized sweep; no new design rule.

## Execution Report — tenth-review remediation, R10.26/28/30/31/32/33 (2026-10-08)

- **Result**: Five independent-review blockers and the additional receipt-graph/retention variants are corrected upstream under existing R1–R6. New remediation tasks alone are completed; prior execution history remains intact. Both failed review reports are unchanged. No review or later gate ran.
- **Authorization and preparation**: Bounded reopening made both task plans ready, checked strict sdd-apply preconditions, entered in_progress, and regenerated/read/validated apply packets. Agent `codex`, provider `openai`, model `gpt-6` are caller-declared. Final TMPDIR is private. Generic implementation was isolated and 17 identified files propagated with hashes/modes and diffs; three new owned tests were declared in both inventories.
- **Red first**: Independent variants 8 registered / 1 passed / 7 failed; permanent initial matrix 66 / 8 / 58; old-source entry replay 14 / 5 / 9. Additional experimental retention publication and an additional adapter receipt omission were reproduced. See `remediation-round10-report.md` for controls, adaptations and all diagnostic failures.
- **Verification**: Final installed `npm test`: 817 registered, 809 passed, 0 failed, 0 skipped, 8 TODO (`1791503997827-aae80fa3-FOkvUZ`). Generation check passed (`1791503999174-77aa19ce-WIMAxT`); all 17 changed/new JS files passed node --check (`1791504020276-2305d8c2-FP7tdD`). Final isolated affected suites passed 100 (`1791503948869-61271c61-rNNwof`). Final independent probes passed 25 (`1791504120079-1c1b1033-GZIIeI`), then dependent eligibility controls passed 2 (`1791504167895-40a6b868-QslQjA`). Private rsync/commit/clone checks passed 82 with complete history and 22 with shallow history (`1791504121707-5e5d1992-fYXVkO`); private originals/streams remain retained.
- **Preservation and evidence**: `/home/ubuntu/.local/share/playbook/evidence/harness-trust-restoration/remediation-rerun10-20261008/` contains baseline, current failed-report copies, original/adapted probes, red/green raw/receipts, exact propagation ledger, command outcomes and final audit. All four HEADs/branches/indexes, protected contents/modes/links, app/API and inventoried global state match baseline. No product, vendor, permanent spec, dependency/version/lock/configuration or global installation changed.
- **Pending**: Twelve methodology EC/SEC declarations and ten Hub EC/SEC declarations; future app/API browser/HTTP/worker observations; bounded experimental CLI substitute; eight existing TODO; packet navigation/instructions; separate Hub release/workflow migration. Responsible owners and recommended actions are in the technical report. Runtime coverage is not claimed passed.
