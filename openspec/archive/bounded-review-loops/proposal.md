---
schema: proposal
schema_version: 1
change_id: bounded-review-loops
title: Bounded review loops, bounded sensitive designs and a released global CLI
status: approved
owner: pending
created: '2026-10-11'
updated: '2026-10-11'
impact:
  public_contract: false
  data_model: false
  architecture_boundary: false
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: []
runtime_relevant_capabilities: []
---
# Bounded review loops, bounded sensitive designs and a released global CLI

## Objective

Make the ten-round review loop of the LIA Hub change `harness-trust-restoration` impossible
to repeat in any project that uses the methodology, and release it as `0.11.0`. That change
went through ten review rounds and 34 issues without converging, because:

1. every finding blocked, however it was found, even when it only appeared in a synthetic
   adversarial fixture or fell outside the change's threat model;
2. nothing capped the review↔apply cycle (ADR-011 caps other loops, not this one);
3. the design declared no threat model or closed list of negative cases, and was amended
   during execution, so each class-level fix opened a wider class;
4. the global `playbook` CLI pointed at the checkout under development, so the code under
   review judged its own gates.

The loop ended only with ad-hoc stop rules (RP-1, RP-2, RP-3, RP-5). This change turns them
into methodology rules, and adds a step-by-step recipe for the runtime-gate exclusion that
cost several attempts on `0.10.2`.

## Guiding principle

A review is bounded before it starts: what blocks, how many rounds, and which adversarial
cases count are declared in advance, and anything beyond that bound goes to a human or to a
follow-up, never to another automatic round. Security rules stay stronger than any loop cap.

## Impacted modules

- Skills (`canonical.md` and the generated `SKILL.md`): `sdd-code-review`,
  `sdd-security-gate`, `sdd-runtime-gate`, `sdd-apply`, `sdd-design`.
- `src/cli/doctor.js`: an advisory release-provenance check.
- Tests: `test/skill-contract.test.js` (content assertions) and `test/doctor.test.js`.
- Docs: `docs/agent_architecture.md`, `docs/doc_verification_guide.md`, `README.md`.
- Release: `CHANGELOG.md`, `package.json`, `package-lock.json`, and the install pin in
  `templates/project/github/workflows/playbook-validation.yml` and
  `templates/project/github/workflows/contract-drift-check.yml`.

## Impacted repos

## Files touched

## Expected behavior

### Happy path (Given/When/Then)

Given a code review or security gate with findings, when the reviewer classifies them, then
only findings that cite a criterion or checklist item, describe a realistic scenario within
the declared threat model and reproduce in the change's real code path block; the rest are
listed as follow-ups with an owner and a destination, and do not change the status.

Given a gate round that fails, when `sdd-apply` fixes its blocking findings and the gate runs
again, then that second run is a delta round limited to those findings and the diff of their
fixes; if it still fails, the gate stops with a convergence analysis and waits for a human
decision instead of starting a third round.

Given a proposal with elevated risk, a security trigger or a required threat model, when
`sdd-design` writes `design.md`, then it declares the threat model and a closed list of
negative cases mapped to `SEC-N`, and after approval it changes only through numbered
amendments, at most two.

Given a methodology developer whose global `playbook` runs from a git checkout, when they run
`playbook doctor`, then doctor warns if that checkout is not clean at the tag `v<version>`,
without changing the exit code.

### Edge cases

- A gate passes in its first round: no delta round; the report records one round.
- A change in flight whose failing gate report predates this rule: that report counts as one
  full round, so the next run is the delta round.
- A human authorizes another round after a stop: the report records the authorization and the
  count restarts consciously (ADR-011).
- `design.md` is still a draft: edits are free; amendments are counted only after approval.
- The global CLI is a package install (not a git checkout): doctor does not check provenance.
- `playbook doctor` runs from a development worktree: the warning appears; the exit code does
  not change.

## Acceptance criteria

- **AC-1:** `sdd-code-review` and `sdd-security-gate` state the blocking rule: a finding blocks only when it cites a checklist item or an `AC-N`/`EC-N`/`SEC-N`, describes a realistic scenario within the change's declared threat model (the `design.md` threat model when present, otherwise the proposal's `## Security considerations` and `docs/security-checklist.md`), and reproduces in the change's real code path (a test, command or concrete trace through the implementation), not only in a synthetic fixture that bypasses the project's own invariants.
- **AC-2:** Both reports' templates carry a `## Follow-ups` section; each follow-up records the finding, the blocking condition it does not meet, an owner and a destination (new change, issue, or accepted as-is), and follow-ups never change the report status.
- **AC-3:** `sdd-code-review` keeps its existing failing conditions (a criterion without passing evidence, a file changed outside scope, a required quality gate not executed) as blocking.
- **AC-4:** `sdd-code-review`, `sdd-security-gate` and `sdd-runtime-gate` each state that a change gets at most one full round and one delta round per gate; the delta round re-checks only the previous round's blocking findings (for the runtime gate, its failed or blocked adapters and criteria) and the diff of their fixes, and a new finding in it blocks only when it meets the blocking rule and is caused by the fix diff.
- **AC-5:** When the delta round still has blocking findings, each of the three gates stops without a third round: the report keeps its failing status, adds a convergence analysis (per round: blocking count, persisted findings, new findings, findings introduced by fixes, suspected structural cause) and asks the human to choose between one more authorized fix-and-delta round, accepting named findings as follow-ups, or re-scoping or splitting the change.
- **AC-6:** Each of the three reports' templates carries a `## Review rounds` section (round, full or delta, date, commit reviewed, blocking findings, result) that is kept across rounds, and each skill states that a failing report without that section counts as one full round.
- **AC-7:** `sdd-apply` states that, when fixing a failed gate round, it fixes only that round's blocking findings, does not widen scope, and stops for a human decision when a fix needs a new decision.
- **AC-8:** `sdd-design` states that, when the proposal declares `security.risk: elevated` or any `security.triggers`, or the design sets `threat_model_required: true`, `design.md` declares a threat model (actors in scope, what they can do, what is out of scope) and a closed list of negative cases `NC-N`, each mapped to a `SEC-N`; and `sdd-code-review` and `sdd-security-gate` state that an adversarial variant outside that list is a follow-up unless it is an always-blocking defect present in the code or it shows the threat model is wrong, in which case the gate stops and asks the human.
- **AC-9:** `sdd-design` states that an approved `design.md` changes only through a numbered `## Amendments` entry (`A-N`: date, reason, decision, human approver), that a change admits at most two amendments, and that when a third would be needed the skill stops and the new decision goes to a new change.
- **AC-10:** `sdd-runtime-gate` includes a step-by-step recipe for an enabled capability that the change does not touch: adapter `not_applicable` with `NOT_RELEVANT_TO_CHANGE`, a specific reason, the proposal as authority (path and hash from the handoff), covered criteria including every criterion mapped to that adapter, and substitute receipts from real runs; it states that disabled capabilities are omitted from the frontmatter and that no other reason code is valid for an exclusion.
- **AC-11:** `docs/agent_architecture.md` and `docs/doc_verification_guide.md` state that the global `playbook` CLI runs a released version (installed from a release tag, or a checkout detached at the release tag with no local changes), that each methodology change is developed in its own git worktree where its tests and `node bin/playbook.js` run, and that moving the global CLI to a new release needs a human go; the README install command points at `github:fcdevxai/ai-sdd-playbooks`, like the CI templates.
- **AC-12:** `playbook doctor` adds an advisory warning when the running CLI's package root is a git checkout whose `HEAD` does not carry the tag `v<package version>` or that has uncommitted changes (tracked, or untracked and not ignored); it adds none when the package root is not a git checkout or is clean at that tag; the warning appears in text and `--json` output and never changes `healthy` or the exit code.
- **AC-13:** `test/skill-contract.test.js` asserts the skill texts of AC-1 to AC-10 and fails if any is removed; `test/doctor.test.js` covers the AC-12 cases with an injected `git` runner, and at least one of those tests fails against the pre-change `doctor`.
- **AC-14:** The version is `0.11.0` in `package.json` and `package-lock.json`, `CHANGELOG.md` has a `0.11.0` entry, the two CI templates install `semver:^0.11.0`, and `npm test`, `npm run generate:check` and `node bin/playbook.js validate --ci` pass.

## Error cases

- **EC-1:** `git` is unavailable, fails or times out while doctor checks provenance: doctor adds no warning, adds a note that release provenance could not be checked with the reason, and its exit code is unchanged.
- **EC-2:** `HEAD` carries tags but none is `v<package version>` (for example `v0.10.2` while `package.json` says `0.11.0`): the warning names the tags found and the expected tag.
- **EC-3:** A reviewer cannot reproduce a finding in the real code path: the finding is a follow-up, not a blocking finding, unless it belongs to an always-blocking security class and the defect is visible in the change's code (SEC-1).

## Security considerations

- **SEC-1:** The blocking rule never demotes the security gate's always-blocking classes (missing, client-side-only or broader-than-specified authorization, cross-tenant data access, unsanitized input reaching a query, command or template, sensitive data exposed in a response, log or error, a committed secret): such a defect present in the change's code blocks, and the agent can never record it as a follow-up; only a human can accept it explicitly as an accepted risk.
- **SEC-2:** The round cap never turns a failing gate into a cleared one: at the stop the report keeps its failing status, is not sealed, and the lifecycle stays blocked until a human decides.
- **SEC-3:** Follow-ups are recorded, never dropped: each has an owner and a destination, and a security follow-up keeps its severity in the report.
- **SEC-4:** The doctor check runs `git` with a fixed argument array, no shell and a timeout, on the package root derived from the module location (never from arguments, environment variables or project files); it only reads, and its output contains only that path, the short `HEAD` commit, tag names and whether the tree has changes.
- **SEC-5:** The security gate keeps "may raise, never lowers" for risk; neither the blocking rule nor the round cap changes risk classification.

## Constraints and non-goals

- No change to the lifecycle engine, the validators, the schemas, receipts, handoff manifests
  or the evidence model (`src/lifecycle/**`, `src/schema/**`, `schemas/**` stay unchanged).
  `src/cli/doctor.js` is the only source file that changes.
- The CLI does not count rounds or amendments. Enforcing them in the validator is gate code
  (ADR-042) and is a possible follow-up change.
- The runtime-gate validator is not relaxed; the "simple path" is the documented recipe of
  AC-10. Relaxing the validator for changes with no runtime surface is a follow-up change
  under ADR-042.
- The design-required computation does not change: a sensitive change whose `impact` flags
  are all `false` still has no `design.md`, so AC-8 applies only when a design exists.
- Doctor does not check provenance for a package install (not a git checkout).
- `sdd-plan`, `sdd-commit`, `sdd-verify`, `sdd-archive` and the consumer templates other than
  the install pin do not change. Consumer projects (the LIA Hub, EduAssistant) adopt this by
  upgrading.
- Permanent specs and the ADRs are updated at archive time, not in this change's commit.
- `cli` stays excluded per the criterion of ADR-032 (playbooks spec, "The `cli` runtime
  adapter is excluded"): the runtime gate records `playbook doctor` before and after the
  change, and AC-13 requires a unit test that fails against the pre-change code.

## Open technical decisions

None. The user closed the decisions on 2026-10-11: the blocking rule applies to the code
review and the security gate without touching the always-blocking classes; the round cap
applies to the code review, the security gate and the runtime gate, counted in the report
body; the runtime-gate simple path is a recipe in the skill with the validator unchanged; the
released-CLI rule goes in docs and an ADR, with the README fixed and an advisory warning in
`playbook doctor`. Two ADR drafts carry the decisions: `adr-bounded-review-rounds.md` and
`adr-released-cli-development-worktree.md`.
