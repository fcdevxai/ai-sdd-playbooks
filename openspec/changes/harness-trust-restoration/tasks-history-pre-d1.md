---
schema: tasks
schema_version: 1
change_id: harness-trust-restoration
status: in_progress
updated: 2026-10-06
handoff:
  specs:
    - {repository: loom, path: openspec/specs/playbooks/spec.md}
  architecture:
    - {repository: loom, path: docs/agent_architecture.md}
    - {repository: loom, path: docs/doc_architecture.md}
    - {repository: loom, path: openspec/changes/harness-trust-restoration/session-handoff.md}
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
    - "LIA consumer D1 is approved but its corrective plan is draft; native discovery and vendor-aware parity still require revalidation. The latest current-session ceiling is sdd-design."
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
      - src/tokens/evidence.js
      - src/tokens/handoff.js
      - src/tokens/receipt.js
      - src/tokens/retention.js
      - src/tokens/seal.js
      - test/closure-retention.test.js
      - test/evidence-binding.test.js
      - test/evidence-run.test.js
      - test/handoff-schema.test.js
      - test/handoff.test.js
      - test/receipt.test.js
      - test/runtime-coverage.test.js
      - test/seal.test.js
      - test/source-snapshot.test.js
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

## Execution Report — F06 interim

- **Result**: VALIDATED for the scoped LIA/methodology roots.
- **Evidence**: `f06-execution-report.md`: five initial red regressions, then 94 focused and 457 installed-checkout tests passed; full raw suite evidence is linked there. The three unrelated modified files retained baseline hashes. F04/F05 tasks remain open.
