# Closure report — merged-delivery-identity

Date: 2026-10-09
Agent: claude, provider anthropic, model claude-opus-5-5 (declared)
Worktree: `/home/ubuntu/ai-sdd-playbooks-merged-delivery-identity`, branch `merged-delivery-identity` from `v0.10.0` (`1f72e2d`), uncommitted.
Scratch directory (`TMPDIR`) and logs: `/mnt/data/playbook-closure/merged-delivery-identity-20261009/` (`logs/`).
Global `playbook` unchanged: `/home/ubuntu/ai-sdd-playbooks` at `v0.10.0` (ADR-042, rule 4).

## Candidate

| File | sha256 (prefix) |
|---|---|
| `src/github/index.js` | `fc644c337155e03d` (comment reorder after C1, C6, C7; focused tests 48/48 and `node --check` rerun) |
| `src/github/pull-request.js` | `32347d8973c724b5` |
| `src/tokens/equivalence.js` | `fcbacdac23efed12` |
| `test/delivery.test.js` | `ec06a45febc9f873` |
| `test/post-merge-delivery.test.js` | `55b61fabfaba6c8c` |
| `CHANGELOG.md` | `122630e8b6ff7473` |
| `openspec/specs/cli/spec.md` | `1b0c22b5c1cef7bc` |
| `package.json` | `cedd60d343d235e1` |
| `package-lock.json` | `4f936dc4bd16191a` |

Full hashes: `logs/candidate-hashes.txt`. Not changed: skills, generated `SKILL.md`, README,
`openspec/specs/playbooks/spec.md` (no statement contradicted the corrected behavior).

Implementation summary: `prForBranch` requests `mergeCommit` and returns `mergeCommitOid`;
`resolveDelivery` proves post-merge identity in `mergedHeadIdentity` (HEAD equals the
pull-request head, or the validated merge commit is HEAD or an ancestor of HEAD through
`ancestryWith`); `ancestry`/`commitExists` in `equivalence.js` now delegate to the runner-based
`ancestryWith`/`commitExistsWith`. Delivery's Git runner sets `GIT_NO_REPLACE_OBJECTS=1`
(`GIT_ENV`), like evidence checks.

## Checklist

| ID | Result | Evidence |
|---|---|---|
| C1 | verified | `npm test` (Node 22.22.0), final state: exit 0, 840 tests, 832 pass, 0 fail, 8 todo — the eight `AUD-O3`, `AUD-O4`, `AUD-S1`–`AUD-S5`, `AUD-S1b` TODO tests of `0.10.0`. `logs/c1-npm-test.log` |
| C2 | verified | `npm run generate:check`: exit 0, "No drift — 13 skill(s) in sync". `logs/c2-generate-check.log` |
| C3 | verified | `node --check` exit 0 for the five changed JavaScript files. `logs/c3-node-check.log` |
| C4 | verified | Mapping below; all mapped tests pass in C1 and C6 |
| C5 | verified | `node --test test/delivery.test.js test/post-merge-delivery.test.js` on `v0.10.0` source: 48 tests, 15 fail (`logs/c5-red-v0.10.0.log`); on the candidate: 48 pass (`logs/c5-green-candidate.log`). Three end-to-end cases (AC-2, EC-1, EC-4) fail red only because the `v0.10.0` lookup does not request `mergeCommit` (the GitHub double asserts it); their outcomes guard `0.10.0` behavior. One test assertion was corrected during the red run (it flagged the legitimate `rev-parse HEAD` call); the code under test was unchanged at that point |
| C6 | verified locally; pull-request CI pending | `npx node@18` (v18.20.8): 840 tests, 0 fail, 8 todo (`logs/c6-node18.log`); `npx node@20` (v20.20.2): same (`logs/c6-node20.log`). The GitHub matrix runs only when the pull request exists (needs user approval to push) |
| C7 | verified | Private clone `ci-sim/` of the local repository, candidate committed only there: pull-request head `a2f5a87` `node bin/playbook.js validate --ci` exit 0, 0 invalid, `--version` 0.10.1 (`logs/c7-ci-sim-prhead.log`); after `merge --no-ff` into `main` (`3019262`) exit 0, 0 invalid (`logs/c7-ci-sim-postmerge.log`) |
| C8 | verified | Candidate by explicit path against the LIA Hub (`main` `16d65ab`, uncommitted `sdd-verify` packet and unsealed report): `status` `loom=merged · api=merged · app=merged`, lifecycle `runtime_cleared`; `validate` shows the three gates valid (after-delivery notes) and only `verification-report.md: source_binding missing` (`logs/c8-hub-as-is.log`). With the unsealed report set aside: `validate --precondition sdd-verify` exit 0 and `next` = `sdd-verify`; the global `v0.10.0` in the same state fails (`delivery is unknown`) (`logs/c8-hub-precondition.log`). Report restored byte-identical (`sha256 -c` OK) and Hub `git status --porcelain` identical before/after |
| C9 | verified | CHANGELOG `0.10.1` entry; `package.json` and `package-lock.json` (root entries) at `0.10.1`; CLI spec states the rule and reasons; consumer templates unchanged (`semver:^0.10.0`); skills, README and playbooks spec contain no contradicting statement (`sdd-verify` still says "run it on the base branch after the merge", which is now true for merge commits) |
| C10 | N/A | No skill changed (C2 shows no drift) |

## Criteria mapping (C4)

| Criterion | Tests |
|---|---|
| AC-1 | `delivery.test.js` "AC-1: evidence-only dirt is delivered…"; `post-merge-delivery.test.js` "AC-1: after a merge commit / squash / rebase merge…", "AC-1: the base branch advanced…" |
| AC-2 | `delivery.test.js` "AC-2: HEAD equal to the pull-request head…"; `post-merge-delivery.test.js` "AC-2: the change branch checked out…"; pre-existing "post-merge evidence-only dirt is accepted only with matching merged PR head identity" |
| AC-3 | Single implementation in `resolveDelivery`, consumed by `resolveMultiRepoDelivery` (`validate`, preconditions, `status`, `next`, `seal`, `retain`); `post-merge-delivery.test.js` "AC-5…" exercises delivery, the precondition evaluator and `sealReport` through that one resolver |
| AC-4 | `equivalence.js`: `ancestry` delegates to `ancestryWith`; existing binding/equivalence tests pass unchanged (C1) |
| AC-5 | `post-merge-delivery.test.js` "AC-5: sdd-verify on the base branch after a merge commit passes its precondition and seals" (`runtime_cleared` → seal → `verified`, next `sdd-archive`) |
| AC-6 | C8 |
| EC-1 | `delivery.test.js` "EC-1…"; `post-merge-delivery.test.js` "EC-1…" |
| EC-2 | `delivery.test.js` "EC-2…"; `post-merge-delivery.test.js` "EC-2: a base branch that was not pulled…" |
| EC-3 | `delivery.test.js` "EC-3…"; `post-merge-delivery.test.js` "EC-3: a shallow history…" |
| EC-4 | `delivery.test.js` "EC-4…" (null, undefined, `{}`, `{oid: null}`); `post-merge-delivery.test.js` "EC-4…" |
| EC-5 | `post-merge-delivery.test.js` "EC-5…"; pre-existing `openspec/specs/system.md` case in `delivery.test.js` |
| SEC-1 | every `unknown` case above; `mergedHeadIdentity` returns null only on equality or `ancestry === 'yes'` |
| SEC-2 | `delivery.test.js` "SEC-2: a malformed merge-commit identifier never reaches Git…" (option, revision expressions, short, uppercase, newline, non-hex) and "SEC-2: a 64-hexadecimal…" |
| SEC-3 | no strategy/branch/SHA literal in `src/`; three strategies pass through the same path (AC-1 end-to-end) |
| SEC-4 | `delivery.test.js` "SEC-4: a clean tree after merge keeps the 0.10.0 result without any identity call"; EC-5 |

## Findings and follow-ups (none blocking)

1. **Squash and rebase merges still fail at the evidence layer.** Reproduced with the gated
   fixture (`squash_probe.mjs` in the scratch directory): after a merge commit,
   `inspectEvidence` reports no issue; after a squash merge it reports "the reviewed content is
   not recorded at the sealed commit and no applicable evidence binding records the commit
   that holds it" for every gate, because the sealed commits are not in the base branch's
   history (design Amendment R5, rule 7 of `harness-trust-restoration`). This change fixes
   delivery for all strategies (AC-1 holds) but, by its constraints, not the evidence rule.
   The proposal's happy-path sentence ("the stage precondition passes and the report can be
   sealed" for any strategy) is therefore true today only for merge-commit and fast-forward
   merges; the LIA case is a merge commit and is fully unblocked (C8). Owner: methodology
   maintainer — a separate change for delivered evidence after squash/rebase (for example,
   binding by the merge commit's tree). Until then, consumers should merge SDD pull requests
   with merge commits.
2. **`sdd-verify` shows `--agent <agent>` only.** Passing `claude/anthropic/<model>` as one
   value records provider and model as `unknown` in receipts (observed in the LIA session).
   Owner: methodology maintainer; documentation follow-up.
3. **Test-suite temporary directories.** A full `npm test` still leaves about 1,080 entries in
   `TMPDIR` (pre-existing `0.10.0` follow-up). The new `post-merge-delivery.test.js` removes
   its own directories (0 left).

## Not done (requires user approval)

No commit in the worktree, push, pull request, merge, tag `v0.10.1` or global install.
