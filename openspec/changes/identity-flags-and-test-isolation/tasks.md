---
schema: tasks
schema_version: 1
change_id: identity-flags-and-test-isolation
status: passed
updated: '2026-10-09'
handoff:
  specs:
    - {repository: loom, path: openspec/specs/playbooks/spec.md}
    - {repository: loom, path: openspec/specs/system.md}
  architecture:
    - {repository: loom, path: docs/doc_architecture.md}
    - {repository: loom, path: docs/doc_verification_guide.md}
  contracts: []
  required_skills:
    - {name: sdd-apply, repository: loom, path: skills/sdd-apply/SKILL.md}
  required_tools:
    - {name: playbook, context: loom, purpose: lifecycle}
    - {name: node, context: loom, purpose: test-runner}
  runtime_coverage: []
  non_runtime:
    - {criterion: AC-1, rationale: Skill instruction text; proven by the skill contract test and generate:check, no runtime surface.}
    - {criterion: AC-2, rationale: Generated skill parity and a contract test; no runtime surface.}
    - {criterion: AC-3, rationale: Test tooling only; proven by runner unit tests and a full npm test run, not by the product CLI.}
    - {criterion: AC-4, rationale: Temporary-directory count before and after a full npm test run; test tooling only.}
    - {criterion: AC-5, rationale: Runner exit-code and argument forwarding tests; test tooling only.}
    - {criterion: AC-6, rationale: CI workflow unchanged; proven by local Node 18/20 runs and the pull-request CI matrix.}
    - {criterion: EC-1, rationale: Runner test with a failing test file; test tooling only.}
    - {criterion: EC-2, rationale: Runner test sending SIGTERM; test tooling only.}
    - {criterion: EC-3, rationale: Runner test with an unusable parent temporary directory; test tooling only.}
    - {criterion: SEC-1, rationale: Runner removal-scope unit tests (refuses paths outside its own root); test tooling only.}
    - {criterion: SEC-2, rationale: Skill text and contract test; no change to receipts or CLI.}
  unresolved_risks:
    - Tests that spawn processes with an explicit env may drop TMPDIR and still use the system directory; the AC-4 count check detects them.
  blockers: []
  source_paths:
    loom:
      - test/helpers/run-tests.js
      - test/run-tests.test.js
---
# Tasks — Agent identity flags in skills and isolated test temporary directories

## Rules

- Every task has a verifiable success criterion; tests are written before the code they cover.
- Do not change CLI behavior, receipts, manifests, lifecycle rules or evidence code.
- Edit skills only in `skills/<name>/canonical.md`; regenerate `SKILL.md` with `npm run generate`.
- All commands run from the repository root.

## Preconditions (self-check)

`proposal.status == approved` (2026-10-09); design not required (all `impact` flags false).

## Phase 1 — Identity flags in skills

### Task 1.1 — Red contract test for identity flags
- **Done**: [x]
- **Files**: `test/skill-contract.test.js`
- **Success criterion**: a new test scans each skill's `canonical.md` and generated `SKILL.md`, finds every `playbook packet` / `playbook run` invocation that names `--agent`, and fails when `--provider` or `--model` is missing from the same invocation, or when a skill that shows them lacks the identity rule; it fails on the current seven skills.
- **Linked acceptance criterion**: AC-1, AC-2, SEC-2

### Task 1.2 — Update the seven skills and regenerate
- **Done**: [x]
- **Files**: `skills/{sdd-plan,sdd-apply,sdd-code-review,sdd-security-gate,sdd-runtime-gate,sdd-commit,sdd-verify}/canonical.md` and generated `SKILL.md`
- **Depends on**: 1.1
- **Success criterion**: every invocation shows `--agent <agent> --provider <provider> --model <model>`; each skill states once that the values are passed separately, only as the runtime reports them, omitted when unknown, never packed into `--agent`, and recorded as declared, not observed; `npm run generate` then `npm run generate:check` reports no drift; the test from 1.1 passes.
- **Linked acceptance criterion**: AC-1, AC-2, SEC-2

## Phase 2 — Isolated test temporary root

### Task 2.1 — Red runner tests
- **Done**: [x]
- **Files**: `test/run-tests.test.js`
- **Success criterion**: tests exercise `test/helpers/run-tests.js` with small fixture test files in a scratch directory: the child sees `TMPDIR` set to a fresh root under the parent; the root is removed after success and after a failing test, which exits non-zero (EC-1); file arguments are forwarded and the exit code preserved (AC-5); `SIGTERM` to the runner removes the root and ends with the signal status (EC-2); an unusable parent directory fails before running tests with a message (EC-3); the removal helper refuses a path that is not a direct child of the parent created by the runner (SEC-1, negative test). They fail before 2.2.
- **Linked acceptance criterion**: AC-3, AC-5, EC-1, EC-2, EC-3, SEC-1

### Task 2.2 — Implement the runner and wire `npm test`
- **Done**: [x]
- **Files**: `test/helpers/run-tests.js`, `package.json` (`scripts.test`)
- **Depends on**: 2.1
- **Success criterion**: the runner creates `fs.mkdtempSync(path.join(os.tmpdir(), 'playbook-test-run-'))`, runs `process.execPath --test` with the forwarded files or, when none, the same `test/*.test.js` list the previous script expanded, with `TMPDIR` set to the root; forwards `SIGINT`/`SIGTERM`; removes the root on every exit path; exits with the child status; `npm test` uses it; tests from 2.1 pass.
- **Linked acceptance criterion**: AC-3, AC-5, EC-1, EC-2, EC-3, SEC-1

### Task 2.3 — Prove no leftovers and CI parity
- **Done**: [x]
- **Files**: none (evidence only)
- **Depends on**: 2.2
- **Success criterion**: with a dedicated parent `TMPDIR`, a full `npm test` passes and the parent holds no entry created by the run afterwards; the same suite passes on Node 18 and Node 20; `.github/workflows/tests.yml` is unchanged.
- **Linked acceptance criterion**: AC-4, AC-6

## Phase 3 — Documentation and release

### Task 3.1 — Verification guide, README and release notes
- **Done**: [x]
- **Files**: `docs/doc_verification_guide.md`, `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`
- **Depends on**: 1.2, 2.2
- **Success criterion**: the guide shows single-file runs as `npm test -- test/<archivo>.test.js` and explains the per-run temporary root; the README test line matches; CHANGELOG has a `0.10.2` entry; version fields are `0.10.2`.
- **Linked acceptance criterion**: AC-3, AC-6

## Phase 4 — Quality gates

- **Format**: `N/A (no formatter configured)`
- **Lint/type-check**: `node --check test/helpers/run-tests.js && node --check test/run-tests.test.js && node --check test/skill-contract.test.js`
- **Feature tests**: `node test/helpers/run-tests.js test/run-tests.test.js test/skill-contract.test.js`
- **Regression**: `npm test && npm run generate:check`

## Execution Report — sdd-apply (2026-10-09)

Agent: `--agent claude --provider anthropic --model claude-opus-5-5` (declared). Commands from
the repository root through `playbook run --change identity-flags-and-test-isolation --step
apply`; receipts under `.specloom/runs/<run-id>/`. Isolated parent temporary directories under
`/mnt/data/playbook-closure/merged-delivery-identity-20261009/` (`parent-*`); extra logs in
its `logs/0102-*`.

| Task | Result | Evidence |
|---|---|---|
| 1.1 | red confirmed: the new contract test failed on all seven skills (missing `--provider`/`--model`, no identity rule); 64 other tests passed | `1791588600382-5109e8e7-d4GDlq` |
| 1.2 | seven `canonical.md` updated (rule placed under the section heading that holds the first command, outside code fences), `npm run generate` (13 skills), `generate:check` no drift, contract test 65/65 | `1791588660594-6592a9d3-6OICBk`, `1791588661354-037bbf56-vV9eAa` |
| 2.1 | red confirmed: `test/run-tests.test.js` failed to load (runner missing) | run before `test/helpers/run-tests.js` existed |
| 2.2 | runner implemented, `scripts.test` = `node test/helpers/run-tests.js`; runner tests 7/7 | `1791588749169-0be61e89-eASkWG` |
| 2.3 | full `npm test` with an empty dedicated parent: 848 tests, 840 pass, 0 fail, 8 todo; parent afterwards holds only `node-compile-cache`, which npm itself creates (`npm --version` alone creates it; a direct runner invocation leaves nothing) — no entry created by the test run remains. Node 18.20.8 and 20.20.2: 848 tests, 0 fail, 8 todo each, same single npm cache entry. `.github/workflows/tests.yml` unchanged | `1791588767186-032f41c4-S1Blqp`; `logs/0102-final-node18.log`, `logs/0102-final-node20.log` |
| 3.1 | verification guide (single-file runs through `npm test --`, per-run root explained), README line, CHANGELOG `0.10.2`, version fields `0.10.2` | diff |

Deviations: the runner fixture test initially failed on Node 18 only, because the fixture project
had no `package.json` with `"type": "module"` (Node 18 lacks ESM syntax detection); the fixture now
writes one. `sh -c` wrappers for combined gate commands were refused by the session's safety
check, so each gate ran as its own `playbook run`.

Quality gates (final state):

- Lint/type-check: `node --check` on the three files — `1791589480270-ebad3f44-Ujng3U`, `1791589480825-cd703a07-5y0Cbe`, `1791589481383-c6b8a89f-ujHQLm`
- Feature tests: `node test/helpers/run-tests.js test/run-tests.test.js test/skill-contract.test.js` — 72 tests — `1791589481941-def80810-xHYQjY`
- Regression: `npm test` — 848 tests, 0 fail, 8 todo — `1791589483521-c71af14d-KQUpdq`; `npm run generate:check` — `1791589692662-5c9e7a2c-4Id3ll`

| Criterion | Evidence |
|---|---|
| AC-1, SEC-2 | contract test "every skill command that names --agent also passes --provider and --model, with the identity rule" |
| AC-2 | same test over `canonical.md` and `SKILL.md`; `generate:check` |
| AC-3 | runner tests "AC-3: …" (fresh root under the parent; default file list) |
| AC-4 | task 2.3 leftover check |
| AC-5 | runner test "AC-5: …" |
| AC-6 | Node 18/20 full runs through the runner; workflow unchanged (pull-request CI pending) |
| EC-1 | runner test "EC-1: …" |
| EC-2 | runner test "EC-2: SIGTERM …" |
| EC-3 | runner test "EC-3: …" |
| SEC-1 | runner test "SEC-1: …" (outside, parent, unrelated, nested, symlink, traversal, `/` refused) |
