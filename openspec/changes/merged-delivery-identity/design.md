---
schema: design
schema_version: 1
change_id: merged-delivery-identity
title: Prove post-merge delivery by merge-commit ancestry
status: approved
created: '2026-10-09'
updated: '2026-10-09'
security:
  risk: elevated
  threat_model_required: true
  controls: [SEC-001, SEC-002, SEC-003, SEC-004]
---
# Technical design — Prove post-merge delivery by merge-commit ancestry

## Approach

`resolveDelivery` (`src/github/index.js`) handles a merged pull request with evidence-only
working-tree changes. Today it requires `git rev-parse HEAD === pr.headRefOid`. The
corrected rule:

1. `prForBranch` also requests `mergeCommit` from `gh pr view` and returns
   `mergeCommitOid` (or `null`).
2. If `HEAD === headRefOid`, delivery is `merged` (unchanged, AC-2).
3. Otherwise, if `mergeCommitOid` is a valid full object name and the three-valued ancestry
   of `mergeCommitOid → HEAD` is `yes`, delivery is `merged` (AC-1). `HEAD` equal to the
   merge commit counts as ancestry (`git merge-base --is-ancestor X X` succeeds).
4. Otherwise delivery is `unknown` with one of these reasons:

| Situation | `blocked_reason` | Error case |
|---|---|---|
| merge commit present, not an ancestor of `HEAD` | `MERGED_HEAD_IDENTITY_UNPROVEN` | EC-1 |
| merge commit absent from a complete local history | `MERGE_COMMIT_NOT_IN_HISTORY` | EC-2 |
| shallow history cannot decide | `MERGED_HISTORY_UNAVAILABLE` | EC-3 |
| no (or malformed) merge commit from GitHub | `MERGED_HEAD_IDENTITY_UNPROVEN` | EC-4 |

The clean-tree path and the evidence-path allowlist are not touched (EC-5, SEC-004).

### One ancestry implementation (AC-4)

`ancestry(root, ancestor, descendant)` in `src/tokens/equivalence.js` already returns
`yes`/`no`/`unknown` with shallow-history detection. It is refactored so the decision is
written once over an injected Git runner (`ancestryWith(runGit, ancestor, descendant)`), and
`ancestry(root, …)` delegates to it with the existing `execFileSync` runner. Delivery calls
`ancestryWith` with its own injected runner, which keeps `resolveDelivery` testable with
doubles. The exported behavior and messages of `ancestry`/`assertAncestry` do not change.
To report EC-2 distinctly from EC-1, the delivery code checks object existence with the same
helper the ancestry decision uses; it does not re-implement the decision.

### Why this is not a workaround

- It reuses the rule the evidence layer already applies after delivery (Amendment R5,
  rule 7), so delivery and evidence stop disagreeing about the same checkout.
- GitHub reports `mergeCommit` for merge-commit, squash and rebase merges, so no strategy is
  detected or assumed.
- Every input that is not proven stays `unknown` (SEC-001).

### Alternatives rejected

- **Compare trees of `HEAD` and the pull-request head.** Fails as soon as the base branch
  advances after the merge, and proves content rather than delivery.
- **Check out the pull-request head (detached) to verify and seal.** A process workaround
  that contradicts the `sdd-verify` instruction to run on the base branch.
- **Require fast-forward merges.** Hardcodes one merge strategy into the methodology.
- **Drop the identity check for evidence-only dirt.** Would accept a checkout that does not
  contain the merged change.

## Module impact

| Module | Change |
|---|---|
| `src/github/pull-request.js` | request and return `mergeCommitOid`; validate the object-name shape |
| `src/github/index.js` | identity proof by equality or merge-commit ancestry; distinct `unknown` reasons |
| `src/tokens/equivalence.js` | runner-based three-valued ancestry; `ancestry`/`assertAncestry` delegate |
| `test/delivery.test.js` | unit cases for AC-1, AC-2, EC-1–EC-5, SEC-002 |
| `test/post-merge-delivery.test.js` | end-to-end with real Git repositories (AC-3, AC-5) |
| specs, CHANGELOG, version | release coherence (C9) |

## Trade-offs

- Delivery now needs the merge commit in the local history. A base branch that was not
  pulled reports `unknown` (EC-2) instead of `merged`; this is intended, because evidence
  must describe the merged code.
- One more field in the `gh pr view` request; no extra network call.
- The refactor of `ancestry` touches a helper used by evidence binding. Its exported
  behavior is pinned by the existing binding tests (C1).

## Public contracts / interfaces

No CLI flag, schema or file format changes. New `blocked_reason` values
`MERGE_COMMIT_NOT_IN_HISTORY` and `MERGED_HISTORY_UNAVAILABLE` appear in `status --json`
and `next` output; existing values keep their meaning.

## Data model changes

None. Delivery stays derived on every call and is never persisted.

## Security controls

| Control | Proposal | Mechanism |
|---|---|---|
| SEC-001 | SEC-1 | `merged` only on equality or `ancestry === 'yes'`; every other branch returns `unknown` |
| SEC-002 | SEC-2 | merge-commit identifier must match `^[0-9a-f]{40}([0-9a-f]{24})?$` before any Git call; passed as a separate argv element after `--is-ancestor` |
| SEC-003 | SEC-3 | no strategy, branch or commit literal in code; tests cover three strategies through the same path |
| SEC-004 | SEC-4 | `evidenceOnlyDirty` and the clean-tree return path unchanged; regression tests kept |

### Threat model

Same honest-error model as ADR-043 and Amendment R7, rule 1, of `harness-trust-restoration`.
In scope: verifying on a base branch that was not pulled, on the wrong branch or an older
commit, in a shallow CI clone, after any merge strategy, or after the base branch advanced.
Out of scope, as accepted limits: deliberate forgery by an actor with write access to the
repository, its Git internals, GitHub responses or the evidence store; concurrent filesystem
mutation during a CLI invocation; history rewritten after the merge (the merge commit then
disappears and EC-2 fails closed).

## Testing strategy

Red first: the new unit and end-to-end cases fail on `v0.10.0` with
`MERGED_HEAD_IDENTITY_UNPROVEN` for the merge-commit, squash, rebase and advanced-base cases.
The end-to-end test builds a bare remote and a clone in a temporary directory, creates the
change branch, merges it into the base branch with each strategy, writes evidence-only
files, and calls `resolveDelivery`, `validate --precondition sdd-verify` and `evidence seal`
through their modules with a GitHub double that returns the real merge-commit object name.
Temporary directories are removed by the test (hygiene follow-up of `0.10.0`).

## Closure contract (ADR-042)

This change modifies code that decides eligibility (`validate`, `status`, `next`,
preconditions, seal and retain all consume delivery). It is delivered outside the SDD
lifecycle gate under the bootstrap exception. This contract is the only completion
criterion. The user approved it on 2026-10-09 ("Apruebo el contrato").

**1. Threat model.** As stated above.

**2. Closed acceptance checklist.**

| ID | Check |
|---|---|
| C1 | `npm test` reports 0 failures; only the eight TODO tests recorded in `0.10.0` remain |
| C2 | `npm run generate:check` reports no drift |
| C3 | `node --check` passes for every changed JavaScript file |
| C4 | Every AC-1–AC-6, EC-1–EC-5 and SEC-1–SEC-4 maps to a passing test or recorded check |
| C5 | The new tests fail on `v0.10.0` and pass on the candidate (red-first evidence recorded) |
| C6 | The suite passes on Node 18 and Node 20 (the CI matrix) on the pull request |
| C7 | Private-clone simulation of pull-request-head and post-merge CI of this repository: `playbook validate --ci` exits 0 |
| C8 | AC-6 run against the real LIA Hub by explicit path: precondition passes, `status` shows `loom=merged`, `next` routes to verification; no file outside the Hub change folder changes |
| C9 | Release coherence: CHANGELOG `0.10.1` entry, `package.json`/`package-lock.json` at `0.10.1`, CLI and playbooks specs describe the rule; skills and README changed only where their text contradicted the behavior |
| C10 | If a skill changed: `playbook install --runtime all` into an isolated HOME leaves both targets identical to the generated skills; otherwise `N/A` |

**3. Blocking rule.** A finding blocks only when it (a) cites a checklist item or an AC, EC
or SEC; (b) describes a realistic scenario inside the threat model; and (c) reproduces in
the real flow, not only in a synthetic adversarial fixture. Everything else is a follow-up
with an owner. One closure review plus one delta round restricted to the blocking findings;
anything still open after that is a user decision.

**4. Delivery.** Checklist evidence in `closure-report.md`, a bounded closure review
(`closure-review-prompt.md`), pull-request CI on Node 18 and 20, human approval and merge of
the pull request, and the tag `v0.10.1`. No push, pull request, merge, tag or global install
without explicit user approval. Pushes to `fcdevxai/*` use the `fcdevxai` GitHub account;
the active account is restored afterwards.

**5. Version.** `0.10.1`, a patch: it removes a false negative only where a proof exists and
changes no contract. Consumers on `semver:^0.10.0` receive it; the CHANGELOG states the new
`blocked_reason` values.

**6. Consumer follow-through (not part of this checklist).** After `v0.10.1` is tagged and
installed globally, the LIA Hub decides whether to move `playbook.lock` and its CI pin to
`0.10.1`, then seals `verification-report.md` of `harness-trust-restoration` on `main` and
continues to `sdd-archive`.
