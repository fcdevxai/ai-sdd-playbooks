---
schema: tasks
schema_version: 1
change_id: bounded-review-loops
status: passed
updated: '2026-10-11'
handoff:
  specs:
    - {repository: loom, path: openspec/specs/playbooks/spec.md}
    - {repository: loom, path: openspec/specs/system.md}
    - {repository: loom, path: openspec/specs/cli/spec.md}
  architecture:
    - {repository: loom, path: docs/doc_architecture.md}
    - {repository: loom, path: docs/doc_verification_guide.md}
  contracts: []
  required_skills:
    - {name: sdd-apply, repository: loom, path: skills/sdd-apply/SKILL.md}
  required_tools:
    - {name: playbook, context: loom, purpose: lifecycle}
    - {name: node, context: loom, purpose: test-runner}
    - {name: git, context: loom, purpose: read-only provenance check in playbook doctor}
  runtime_coverage: []
  non_runtime:
    - {criterion: AC-1, rationale: Skill instruction text (blocking rule in sdd-code-review and sdd-security-gate); proven by the skill contract test and generate:check, no runtime surface.}
    - {criterion: AC-2, rationale: Skill report templates (Follow-ups section); proven by the skill contract test, no runtime surface.}
    - {criterion: AC-3, rationale: Existing sdd-code-review failing conditions kept in the skill text; proven by the skill contract test, no runtime surface.}
    - {criterion: AC-4, rationale: Skill instruction text (one full round plus one delta round in three gates); proven by the skill contract test, no runtime surface.}
    - {criterion: AC-5, rationale: Skill instruction text (stop with convergence analysis, no third round); proven by the skill contract test, no runtime surface.}
    - {criterion: AC-6, rationale: Skill report templates (Review rounds section); proven by the skill contract test, no runtime surface.}
    - {criterion: AC-7, rationale: Skill instruction text in sdd-apply; proven by the skill contract test, no runtime surface.}
    - {criterion: AC-8, rationale: Skill instruction text in sdd-design, sdd-code-review and sdd-security-gate (threat model and closed negative cases); proven by the skill contract test, no runtime surface.}
    - {criterion: AC-9, rationale: Skill instruction text in sdd-design (numbered amendments, at most two); proven by the skill contract test, no runtime surface.}
    - {criterion: AC-10, rationale: Skill instruction text in sdd-runtime-gate (exclusion recipe); proven by the skill contract test, no runtime surface.}
    - {criterion: AC-11, rationale: Documentation and README text; proven by content assertions in the readme test, no runtime surface.}
    - {criterion: AC-12, rationale: Observable behavior of playbook doctor, a CLI surface excluded by the criterion of ADR-032; proven by unit tests with an injected git runner (at least one fails against the pre-change code) plus a recorded doctor invocation before and after.}
    - {criterion: AC-13, rationale: Test coverage of AC-1 to AC-12; proven by running the test files, no runtime surface.}
    - {criterion: AC-14, rationale: Version, changelog and template pins; proven by the readme test, npm test and generate:check, no runtime surface.}
    - {criterion: EC-1, rationale: doctor behavior when git fails; unit test with an injected failing runner, CLI surface excluded by ADR-032.}
    - {criterion: EC-2, rationale: doctor behavior when HEAD lacks the release tag; unit test with an injected runner, CLI surface excluded by ADR-032.}
    - {criterion: EC-3, rationale: Skill instruction text (an unreproducible finding is a follow-up); proven by the skill contract test, no runtime surface.}
    - {criterion: SEC-1, rationale: Skill instruction text plus a negative contract assertion that the always-blocking classes are never demoted; no runtime surface.}
    - {criterion: SEC-2, rationale: Skill instruction text plus a negative contract assertion that a failing report is never sealed at the round stop; no runtime surface.}
    - {criterion: SEC-3, rationale: Skill report templates (follow-ups carry owner and destination); proven by the skill contract test, no runtime surface.}
    - {criterion: SEC-4, rationale: doctor runs git with a fixed argument array, no shell and a timeout; proven by unit tests on the runner arguments, CLI surface excluded by ADR-032.}
    - {criterion: SEC-5, rationale: Skill instruction text keeps the never-lower-risk rule; proven by the skill contract test, no runtime surface.}
  unresolved_risks:
    - The doctor warning also appears in CI and in any methodology worktree, because those CLIs are not a clean release checkout; it is advisory by design and never changes the exit code.
    - The review and design rules are skill text, so an agent can ignore them; accepted risk, as in ADR-011.
  blockers: []
---
# Tasks — Bounded review loops, bounded sensitive designs and a released global CLI

## Rules

- Every task has a verifiable success criterion; tests are written before the code or text they cover.
- Do not change the lifecycle engine, validators, schemas, receipts, handoff manifests or the evidence model. `src/cli/doctor.js` is the only source file that changes.
- Edit skills only in `skills/<name>/canonical.md`; regenerate `SKILL.md` with `npm run generate`.
- Any task implementing a `SEC-N` entry names its negative test as part of its success criterion.
- Never edit `proposal.md` or the `adr-*.md` drafts to make a check pass; permanent specs and ADRs change at archive time, not here.
- All commands run from the repository root of the worktree.
- The `Regression` entry in the quality-gates phase is mandatory.

## Preconditions (self-check)

`proposal.status == approved` (2026-10-11); design not required (all `impact` flags are false).

## Phase 1 — Review-loop rules in the skills

### Task 1.1 — Red contract assertions for the skill rules
- [x] Complete.
- **Files**: `test/skill-contract.test.js`
- **Success criterion**: new tests read the `canonical.md` and generated `SKILL.md` of the five skills and fail on the current text: the blocking rule with its three conditions and the `## Follow-ups` section in `sdd-code-review` and `sdd-security-gate`; the existing failing conditions of `sdd-code-review` still present; one full round plus one delta round, the stop with a convergence analysis and the `## Review rounds` section in `sdd-code-review`, `sdd-security-gate` and `sdd-runtime-gate`; `sdd-apply` fixing only the round's blocking findings; `sdd-design` threat model, `NC-N` list and the `## Amendments` rule with a maximum of two; the exclusion recipe in `sdd-runtime-gate`. Negative assertions: the security gate text keeps its always-blocking classes and states they are never demoted to follow-ups (SEC-1), and no gate text tells the agent to seal a failing report at the stop (SEC-2).
- **Linked acceptance criterion**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-13, EC-3, SEC-1, SEC-2, SEC-3, SEC-5

### Task 1.2 — `sdd-code-review` and `sdd-security-gate`
- [x] Complete.
- **Files**: `skills/sdd-code-review/canonical.md`, `skills/sdd-security-gate/canonical.md`
- **Depends on**: 1.1
- **Success criterion**: both skills state the three-condition blocking rule, carry `## Follow-ups` and `## Review rounds` in their report templates (follow-ups with finding, unmet condition, owner and destination, never changing the status), state the round cap, the delta-round scope and the stop with the convergence analysis, and treat an adversarial variant outside the design's `NC-N` list as a follow-up unless it is an always-blocking defect present in the code or shows the threat model is wrong; `sdd-code-review` keeps its three failing conditions; `sdd-security-gate` keeps its always-blocking classes (never demoted) and "may raise, never lowers"; the 1.1 tests for these two skills pass after 1.6.
- **Linked acceptance criterion**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-8, EC-3, SEC-1, SEC-2, SEC-3, SEC-5

### Task 1.3 — `sdd-runtime-gate` rounds and exclusion recipe
- [x] Complete.
- **Files**: `skills/sdd-runtime-gate/canonical.md`
- **Depends on**: 1.1
- **Success criterion**: the skill states the same round cap, delta scope (failed or blocked adapters and criteria), stop with convergence analysis and `## Review rounds` section; it adds a step-by-step recipe for an enabled capability the change does not touch (`not_applicable` with `NOT_RELEVANT_TO_CHANGE`, a specific reason, the proposal as authority with path and hash from the handoff, `covered_criteria` including every criterion mapped to the adapter, substitute receipts from real runs), states that disabled capabilities are omitted from the frontmatter and that no other reason code is valid for an exclusion; the 1.1 tests for this skill pass after 1.6.
- **Linked acceptance criterion**: AC-4, AC-5, AC-6, AC-10, SEC-2

### Task 1.4 — `sdd-apply` fixes only the round's findings
- [x] Complete.
- **Files**: `skills/sdd-apply/canonical.md`
- **Depends on**: 1.1
- **Success criterion**: the skill states that when fixing a failed gate round it fixes only that round's blocking findings, does not widen scope, and stops for a human decision when a fix needs a new decision; its existing TDD cap and security rules are unchanged; the 1.1 test for this skill passes after 1.6.
- **Linked acceptance criterion**: AC-7

### Task 1.5 — `sdd-design` bounded threat model and amendments
- [x] Complete.
- **Files**: `skills/sdd-design/canonical.md`
- **Depends on**: 1.1
- **Success criterion**: the skill requires a threat model (actors in scope, what they can do, what is out of scope) and a closed `NC-N` list mapped to `SEC-N` when the proposal declares `security.risk: elevated` or any `security.triggers`, or the design sets `threat_model_required: true`; it states that an approved `design.md` changes only through a numbered `## Amendments` entry (`A-N`: date, reason, decision, human approver), that at most two are admitted, and that a third stops the skill and sends the new decision to a new change; the design template shows the new sections; the 1.1 tests for this skill pass after 1.6.
- **Linked acceptance criterion**: AC-8, AC-9

### Task 1.6 — Regenerate and prove the skill text
- [x] Complete.
- **Files**: `skills/{sdd-code-review,sdd-security-gate,sdd-runtime-gate,sdd-apply,sdd-design}/SKILL.md` (generated)
- **Depends on**: 1.2, 1.3, 1.4, 1.5
- **Success criterion**: `npm run generate` then `npm run generate:check` reports no drift, and the tests from 1.1 pass.
- **Linked acceptance criterion**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-13

## Phase 2 — `playbook doctor` release-provenance warning

### Task 2.1 — Red doctor tests
- [x] Complete.
- **Files**: `test/doctor.test.js`
- **Success criterion**: tests for an exported `releaseProvenance({ root, version, runGit })` with an injected runner fail before 2.2: a clean checkout at `v<version>` gives no warning; a checkout with tracked or untracked-not-ignored changes gives a warning; a checkout whose `HEAD` has no `v<version>` tag gives a warning naming the tags found and the expected tag (EC-2); a root that is not a git checkout gives neither warning nor note; a git top-level that is not the package root (the package inside another repository) gives no warning; a git failure or timeout gives no warning and a note with the reason (EC-1); the runner is called only with fixed read-only argument arrays (SEC-4, negative: no argument comes from the input). An integration test through `doctorCommand` with an injected runner shows the warning in text and `--json` while `healthy` and the exit code are unchanged (AC-12). At least one of these tests fails against the pre-change `doctor`.
- **Linked acceptance criterion**: AC-12, AC-13, EC-1, EC-2, SEC-4

### Task 2.2 — Implement the advisory check
- [x] Complete.
- **Files**: `src/cli/doctor.js`
- **Depends on**: 2.1
- **Success criterion**: `releaseProvenance` runs `git` through `execFileSync` with an argument array, no shell, a timeout and `GIT_ENV` from `src/tokens/equivalence.js`, on `PACKAGE_ROOT` from `src/install/skills.js`, using only `rev-parse --show-toplevel`, `rev-parse --short HEAD`, `tag --points-at HEAD` and `status --porcelain`; it compares the real paths of the top level and the package root; its output carries only the path, the short commit, tag names and whether the tree has changes; `doctorCommand` adds the result to `warnings` or `notes` and to the JSON output without touching `healthy` or the exit code; the tests from 2.1 pass.
- **Linked acceptance criterion**: AC-12, EC-1, EC-2, SEC-4

### Task 2.3 — Record the before and after behavior
- [x] Complete.
- **Files**: none (evidence only)
- **Depends on**: 2.2
- **Success criterion**: through `playbook run --change bounded-review-loops --step runtime`, `playbook doctor --cwd .` is recorded once with the released global CLI (0.10.2, no warning code) and once with `node bin/playbook.js doctor` from this worktree (the warning appears), as the evidence the `cli` exclusion criterion of ADR-032 requires for a change in observable CLI behavior.
- **Linked acceptance criterion**: AC-12

## Phase 3 — Documentation, README and release

### Task 3.1 — Red docs, README and release tests
- [x] Complete.
- **Files**: `test/readme.test.js`
- **Success criterion**: the install assertion expects `npm install -g github:fcdevxai/ai-sdd-playbooks#semver:` (today it requires the former `lablab-outplacement` repository, so correcting the README would otherwise break the suite); new assertions require the released-CLI rule in `docs/agent_architecture.md` and `docs/doc_verification_guide.md` (release tag or detached clean checkout, one worktree per change, a human go to move the global CLI) and require both CI templates to pin `semver:^<major.minor of package.json>`; they fail before 3.2 and 3.3.
- **Linked acceptance criterion**: AC-11, AC-14

### Task 3.2 — Docs and README
- [x] Complete.
- **Files**: `docs/agent_architecture.md`, `docs/doc_verification_guide.md`, `README.md`
- **Depends on**: 3.1
- **Success criterion**: both docs state the released-CLI and worktree rule; the README install command points at `github:fcdevxai/ai-sdd-playbooks` and keeps its private-repository note; the 3.1 docs and README tests pass.
- **Linked acceptance criterion**: AC-11

### Task 3.3 — Release files
- [x] Complete.
- **Files**: `CHANGELOG.md`, `package.json`, `package-lock.json`, `templates/project/github/workflows/playbook-validation.yml`, `templates/project/github/workflows/contract-drift-check.yml`
- **Depends on**: 3.1
- **Success criterion**: `CHANGELOG.md` has a `0.11.0` entry, both version fields are `0.11.0`, and both templates install `semver:^0.11.0`; the 3.1 pin test passes.
- **Linked acceptance criterion**: AC-14

## Phase 4 — Quality gates

- **Format**: `N/A (no formatter configured)`
- **Lint/type-check**: `node --check src/cli/doctor.js && node --check test/doctor.test.js && node --check test/skill-contract.test.js && node --check test/readme.test.js`
- **Feature tests**: `node test/helpers/run-tests.js test/skill-contract.test.js test/doctor.test.js test/readme.test.js`
- **Regression**: `npm test && npm run generate:check && node bin/playbook.js validate --ci`

## Execution Report

- **Result:** Tasks 1.1–3.3 implemented; AC-1–AC-14, EC-1–EC-3 and SEC-1–SEC-5 have passing checks. Format: N/A (no formatter configured).
- **Red first:** skill contract test failed before canonical edits (`.specloom/runs/1791740952569-6d20f397-ngfuu8/full.log`); doctor test failed before `releaseProvenance` existed (`.specloom/runs/1791741066426-2b77b283-jhvTGi/full.log`); README/release tests failed before doc and version edits (`.specloom/runs/1791741134610-a4834a2b-9PNyrU/full.log`).
- **Skill evidence (AC-1–AC-10, AC-13, EC-3, SEC-1–SEC-3, SEC-5):** `npm run generate`, `npm run generate:check`; 66 skill contract tests passed at `.specloom/runs/1791741034057-424d213e-B9cCvV/full.log`.
- **Doctor evidence (AC-12, AC-13, EC-1, EC-2, SEC-4):** 25 doctor tests passed at `.specloom/runs/1791741154304-62e6ebd5-MN59Jk/full.log`. Released global `playbook` 0.10.2 doctor was healthy with no provenance warning at `.specloom/runs/1791741165207-23969050-EuWmiC/full.log`; worktree CLI doctor was healthy with a provenance warning at `.specloom/runs/1791741166166-bc8b4fa0-ASjDcu/full.log` (both captured with `--step runtime`).
- **Docs and release evidence (AC-11, AC-14):** 4 README/release tests passed at `.specloom/runs/1791741153578-e2c2b8d8-09Ec0r/full.log`.
- **Quality commands:** syntax checks passed at `.specloom/runs/1791741167171-14b7d029-G5pi1a/full.log`; combined feature tests passed (95 tests) at `.specloom/runs/1791741167839-bf27fdf2-iOkz7v/full.log`; `npm test` passed (854 tests) at `.specloom/runs/1791741172744-8b508c80-UuAhrq/full.log`; `npm run generate:check` passed at `.specloom/runs/1791741393719-43135e23-mfjTqv/full.log`.
- **Validation:** The first `node bin/playbook.js validate --ci` run found only a stale derived handoff manifest after source edits (`.specloom/runs/1791741394547-a5582881-rtUbZE/full.log`). After regenerating the handoff, `validate --ci` passed at `.specloom/runs/1791741430010-2431cfa4-aQt1YX/full.log`.
- **F-2 remediation (SEC-4):** Added a negative doctor test proving that inherited Git repository selectors never reach any of the four fixed Git calls. It failed first because `GIT_DIR` reached the runner (`.specloom/runs/1791747231529-247a74d6-cTUfi7/full.log`). `releaseProvenance` now filters inherited `GIT_*` variables while retaining `GIT_NO_REPLACE_OBJECTS`; the doctor tests pass (26 tests, `.specloom/runs/1791747246038-914f0c71-iUWrjo/full.log`), the combined feature tests pass (96 tests, `.specloom/runs/1791747258979-0d29bb81-0OaUJt/full.log`), and `npm test` passes (855 tests, `.specloom/runs/1791747262379-a2c710db-ve77EF/full.log`). A real Git reproduction with `GIT_DIR` and `GIT_WORK_TREE` pointing to another checkout now reports this worktree's `749bc97` commit.
- **Post-remediation gates:** `npm run generate:check` passed at `.specloom/runs/1791747485113-e3922cff-MN5tQ6/full.log`. `validate --ci` found only that the signed code-review report's governed source changed after its execution (`.specloom/runs/1791747485990-ef7b501c-dZqhhN/full.log`). The review must be rerun against this fix before that gate can clear; the report was not edited or rebound.
