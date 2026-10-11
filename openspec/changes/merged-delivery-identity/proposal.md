---
schema: proposal
schema_version: 1
change_id: merged-delivery-identity
title: Prove post-merge delivery by merge-commit ancestry
status: approved
owner: pending
created: '2026-10-09'
updated: '2026-10-09'
impact:
  public_contract: false
  data_model: false
  architecture_boundary: false
  external_integration: true
  cross_repository: false
  authentication: false
  authorization: true
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: elevated
  triggers: [authorization, external_integration]
runtime_relevant_capabilities: []
---
# Prove post-merge delivery by merge-commit ancestry

## Objective

After a pull request is merged, `sdd-verify` and `sdd-archive` run on the base branch and
write evidence there. Release `0.10.0` accepts that evidence-only working-tree state as
`merged` only when `HEAD` equals the pull request's head commit. That is true only after a
fast-forward merge. After a merge commit, a squash or a rebase merge, the base branch never
sits on the pull-request head, so delivery becomes `unknown`
(`MERGED_HEAD_IDENTITY_UNPROVEN`) as soon as the mandatory stage packet is generated. Every
consumer of delivery then blocks: `validate` (including `--precondition sdd-verify`),
`status`, `next`, `evidence seal` and `evidence retain`.

Reproduced on 2026-10-09 in the LIA Hub: pull request `liacopilot/playbook-ai#24` was merged
with a merge commit (`main` at `16d65ab`, pull-request head `d389476`, identical trees). The
precondition passed on the clean checkout, failed after `playbook packet --stage sdd-verify`,
and `evidence seal` refused the verification report ("verification seal requires unanimous
merged delivery").

The evidence layer already answers the same question correctly: delivered evidence is
accepted when the sealed commit is in the history of `HEAD` (design Amendment R5, rule 7 of
`harness-trust-restoration`). This change makes delivery use the same proof.

## Guiding principle

One rule, decided from facts GitHub and Git already provide: the merged result is delivered
to a checkout when the pull request's merge commit is `HEAD` or an ancestor of `HEAD`. No
merge-strategy detection, branch names or commit identifiers are hardcoded. Every case that
cannot be decided stays `unknown`.

## Impacted modules

Delivery resolution (`src/github/`), the three-valued ancestry helper (`src/tokens/equivalence.js`),
their tests, the CLI and playbooks specs, the CHANGELOG and version fields. Skills change only
if their text contradicts the corrected behavior.

## Impacted repos

- playbook-ai (this repository only)

## Files touched

- src/github/pull-request.js
- src/github/index.js
- src/tokens/equivalence.js
- test/delivery.test.js
- test/post-merge-delivery.test.js
- openspec/specs/cli/spec.md
- openspec/specs/playbooks/spec.md
- CHANGELOG.md
- package.json
- package-lock.json
- openspec/changes/merged-delivery-identity/

Only if release coherence (design, checklist C9) requires it: `skills/sdd-verify/canonical.md`,
`skills/sdd-archive/canonical.md` and their generated `SKILL.md`, and `README.md`.

## Expected behavior

### Happy path (Given/When/Then)

Given a change whose pull request is merged with any strategy, when `sdd-verify` or
`sdd-archive` runs on a base-branch checkout whose `HEAD` is the merge commit or a
descendant of it, and only evidence of that change is uncommitted, then delivery is `merged`,
the stage precondition passes and the report can be sealed.

### Edge cases

`HEAD` on the pull-request head (the change branch after merge) stays `merged`. A checkout
that does not contain the merge commit, a local history that lacks it, a shallow history that
cannot decide, or a merged pull request without a merge commit is `unknown` with a reason
that says what to do. Non-evidence changes keep delivery `uncommitted`.

## Acceptance criteria

- **AC-1:** With evidence-only changes and a merged pull request, delivery is `merged` when the pull request's merge commit reported by GitHub is `HEAD` or an ancestor of `HEAD`, for merge-commit, squash and rebase merges and when the base branch advanced after the merge.
- **AC-2:** `HEAD` equal to the pull-request head remains `merged` (behavior of `0.10.0` preserved).
- **AC-3:** The rule lives in one place, delivery resolution, so `validate`, `validate --precondition`, `status`, `next`, `evidence seal` and `evidence retain` agree without per-command logic.
- **AC-4:** Ancestry is decided by the same three-valued implementation as delivered evidence (Amendment R5, rule 2); no second ancestry rule is introduced.
- **AC-5:** An end-to-end test with real Git repositories reproduces the LIA case: merge commit on the base branch, stage packet generated, verification report written; the `sdd-verify` precondition passes and the report seals. GitHub responses are test doubles.
- **AC-6:** Run by explicit path from the candidate worktree against the real LIA Hub (`main` at `16d65ab` with the uncommitted verification evidence), `validate --precondition sdd-verify` passes, `status` reports `loom=merged` and `next` routes to the verification step.

## Error cases

- **EC-1:** `HEAD` does not contain the merge commit (another branch, an older commit): `unknown`, `MERGED_HEAD_IDENTITY_UNPROVEN`.
- **EC-2:** The merge commit is absent from a complete local history (base branch not pulled): `unknown`, with a reason that names the missing commit and the fix.
- **EC-3:** A shallow history cannot decide ancestry: `unknown`, with a reason that asks for full history.
- **EC-4:** GitHub reports a merged pull request without a merge commit and `HEAD` is not the pull-request head: `unknown`.
- **EC-5:** Any change outside the change's evidence paths keeps delivery `uncommitted`, as in `0.10.0`.

## Security considerations

- **SEC-1:** Fail closed. A dirty-evidence checkout becomes `merged` only with an equality or ancestry proof; every undecidable case is `unknown`, never `merged`.
- **SEC-2:** The merge-commit identifier from GitHub is validated as a full hexadecimal object name before it reaches a Git argument vector, so it cannot be read as an option or revision expression.
- **SEC-3:** No merge strategy, branch name or commit identifier is hardcoded; the base branch keeps coming from configuration or GitHub.
- **SEC-4:** The evidence-path allowlist (`evidenceOnlyDirty`) and the clean-tree behavior are unchanged; this change widens nothing except the identity proof described in AC-1.

## Constraints and non-goals

No change to the evidence binding, sealing, freshness or retention rules beyond the delivery
input they receive. No new state, lock field or persisted delivery value. No change to the
consumer workflow templates (`semver:^0.10.0` already admits `0.10.1`). Loop prevention
(planned `0.11.0`) and the other `0.10.0` follow-ups are out of scope. The global `playbook`
stays on the released `v0.10.0` checkout until `v0.10.1` is tagged (ADR-042, rule 4). No push,
pull request, merge, tag or install without explicit user approval.

## Open technical decisions

None. The user approved the approach on 2026-10-09 ("apruebo el enfoque") and approved this
proposal and the closure contract in `design.md` on 2026-10-09 ("Apruebo el contrato"), with
the instruction to implement test-first, collect the checklist evidence, run the bounded
closure review and stop before push, pull request, tag or install.
