# Closure report — harness-trust-restoration (methodology)

Date: 2026-10-08. Operation: bounded closure under design Amendment R7, delivered outside the
SDD lifecycle gate (ADR-042). This report records the checklist evidence for the closure
review; it is not a gate report and does not change any earlier verdict. The tenth
`code-review-report.md` stays `failed` as history.

## State and scope

- Repository `/home/ubuntu/ai-sdd-playbooks`, branch `harness-trust-restoration`, HEAD
  `27044053983fea54e5d08350fc62b19f2a33739d`, empty index, nothing committed yet.
- Closure scratch and evidence (outside the root filesystem, which was full):
  `/mnt/data/playbook-closure/harness-trust-restoration-20261009T012631Z/`
  (`backup/` verified tarballs of the four repositories, `baseline/baseline.json`,
  `checklist/`, `c6/`, `c7/`, `c8/`, `c9home/`, `tmp/`). Use `tmp/` as `TMPDIR` when
  re-running commands.
- Closure edits: this change's `design.md` (Amendment R7),
  `proposal.md` (closure note), `closure-review-prompt.md`, this report;
  `skills/sdd-plan` and `skills/sdd-runtime-gate` canonical and generated files; permanent
  specs `openspec/specs/cli/spec.md` and `openspec/specs/playbooks/spec.md`; ADR-042,
  ADR-043 and the ADR index; `README.md`; `CHANGELOG.md`; `docs/security-checklist.md`;
  version `0.10.0` in `package.json` and `package-lock.json`; consumer templates
  `playbook-validation.yml` and `contract-drift-check.yml` (`semver:^0.10.0`). The C7
  correction below adds the only code changes: `src/cli/dispatch.js`, `src/cli/validate.js`,
  and regressions in `test/dispatch.test.js` and `test/lifecycle-cli.test.js`.

## Checklist results

| ID | Result | Evidence |
|---|---|---|
| C1 | verified | After the C7 correction: `npm test` 819 registered, 811 passed, 0 failed, 8 TODO; exit 0 (`checklist/c1b-npm-test.log`). Before it: 817/809/0/8 (`checklist/c1-npm-test.log`). The TODO tests are exactly the R6 list (AUD-O3, AUD-O4, AUD-S1, AUD-S1b, AUD-S2, AUD-S3, AUD-S4, AUD-S5) |
| C2 | verified | `npm run generate:check`: no drift, 13 skills; exit 0. `checklist/c2-generate-check.log` |
| C3 | verified | `node --check` on 144 tracked and new JavaScript files: 0 failures (`checklist/c3.exit`); the four files changed by the C7 correction re-checked after it |
| C4 | verified | Criterion map below; every mapped test passed in C1 |
| C5 | verified | Issue map below; every mapped test passed in C1 |
| C6 | verified, with classified exceptions | See "C6 replays" below |
| C7 | verified after correction | Docker `node:18` (18.20.8) and `node:20` (20.20.2), the `tests.yml` steps (`npm ci`, `npm test`, `generate:check`, `--version`), no installed skills and no GitHub authentication: 819/811/0/8 on both, no drift, `0.10.0` (`c7b/`). The first run failed two tests on both versions (`c7/`); see "C7 finding and correction" |
| C8 | verified | Private clone with full history: pull-request head (detached, change folder archived) and post-merge `main` both give `validate --ci` exit 0; only the pre-existing `contract.path_in_loom` warning. Re-run after the C7 correction: `c8b/pr-head-validate.log`, `c8b/post-merge-validate.log` |
| C9 | verified | `playbook install --runtime all` with an isolated `HOME` and target overrides: 13 skills × 2 targets, 26 of 26 byte-identical to `skills/*/SKILL.md`; nothing written outside the isolated home. `checklist/c9-install.log`, `checklist/c9.result` |
| C10 | verified | Protected `src/repos/classify.js`, `src/repos/plan.js`, `test/repos.test.js` and the Hub prompt keep their baseline hashes; Hub, `api` and `app` HEAD, index, working-tree diff and untracked files equal the baseline; the methodology diff against the backup is exactly the closure edits listed above (`checklist/c10.json`, `checklist/c10-methodology-diff.txt`, refreshed after the C7 correction) |
| C11 | verified | Hub `doctor` exit 4 (the preserved failed review; Playwright note), `validate` exit 1 only because the Hub handoff references methodology files edited by this closure (the coupling the Hub decouples in its own closure), `status` implemented/uncommitted, `next` routes to review remediation. The commands wrote nothing in the Hub. `checklist/c11-hub-cli.log` |
| C12 | for review | Artifacts listed under "State and scope"; the closure reviewer checks them against the code |

### C4 — criterion map

| Criterion | Passing tests (file:line) |
|---|---|
| AC-1 | `evidence-run.test.js:33` (exit and unrecognized diagnostics), `:43` (recognized failure), `:51` (success counts), `:62` (warning-only, incomplete), `:85` (RAW bytes); hook and RTK permission-neutral composition is consumer evidence: Hub `f06_hook_canaries.py` (11/11 in the Hub's tenth-review checks) |
| AC-2 | `evidence-run.test.js:51`, `:62`, `:71` (large raw complete), `:123`, `:177`, `:187` (exit mapping), `:143` (gate-check without buffer limit); summary-accuracy gaps are the R6 TODO tests |
| AC-3 | `handoff.test.js:75`, `handoff-schema.test.js:32`, `:36` |
| AC-4 | `handoff.test.js:75` (contract-byte bound), `:91`, `:101`; `tokens.test.js:275`; `source-snapshot.test.js:38` (containment escape, missing file) |
| AC-5 | `receipt.test.js:24`, `handoff.test.js:91`, `handoff-schema.test.js:51` |
| AC-6 | `closure-retention.test.js:14`, `:28`, `:43` |
| AC-7 | `runtime-coverage.test.js:24`, `:31`, `:40`, `:52`, `:84`, `:135`, `:142` |
| AC-8 | `seal.test.js:38`, `source-snapshot.test.js:23`, `:47`, `handoff.test.js:219` |
| AC-9 | `engine.test.js:137`, `:148`, `lifecycle-cli.test.js:157`, `seal.test.js:57`, `:68` |
| AC-10 (1) adapter omitted | `runtime-coverage.test.js:24` |
| AC-10 (2) empty, fabricated or unrelated evidence | `runtime-coverage.test.js:31`, `:52` |
| AC-10 (3) invalid exclusion or missing substitute | `runtime-coverage.test.js:40`, `:142` |
| AC-10 (4) stale commit | `evidence-binding.test.js:104` (stale until explicit bind), `handoff.test.js:219` |
| AC-10 (5) contract changed after gate | `tokens.test.js:275`, `handoff.test.js:75`, `seal.test.js:38` |
| AC-10 (6) verification before merges | `seal.test.js:57`, `lifecycle-cli.test.js:157` |
| AC-10 (7) archive with open PR, scalar verification | `engine.test.js:137`, `closure-retention.test.js:28`, `lifecycle-cli.test.js:157` |
| AC-10 (8) conflicting delivery | `engine.test.js:148`; unanimity is `per_repo.every(state === 'merged')` (`src/lifecycle/engine.js:48`), so a duplicate same-repository observation that is not merged also blocks; no separate duplicate fixture (follow-up) |
| AC-10 (9) incomplete handoff | `handoff.test.js:101` |
| AC-11 | C1, C2, C9, C10, C11 and the version rationale in R7 rule 6 |
| EC-1 | `receipt.test.js:78`, `seal.test.js:104`, `evidence-round7.test.js:45` |
| EC-2 | `handoff.test.js:91`, `receipt.test.js:24`, `handoff-schema.test.js:36`; the `PROVIDER_UNAVAILABLE`/`MODEL_UNAVAILABLE` issue codes are implemented but not asserted directly (follow-up 8) |
| EC-3 | `runtime-coverage.test.js:84`, `:103`, `handoff.test.js:91`, `engine.test.js:148` |
| EC-4 | `seal.test.js:38`, `handoff.test.js:219`, `evidence-binding.test.js:71` |
| EC-5 | `closure-retention.test.js:43` |
| EC-6 | Process control: version `0.10.0` does not match `^0.9.0` or `v0.9.x` pins (R7 rule 6), preservation audit C10, no global installation before the user's go |
| SEC-1 | Consumer evidence: Hub `f06_hook_canaries.py` (no permission fields from optimizer hooks); `playbook run` itself emits no permission decision |
| SEC-2 | `source-snapshot.test.js:38`, `:115`, `closure-retention.test.js:62`, `evidence-binding.test.js:659`, `remediation-round10-flow.test.js:70`, `:100` |
| SEC-3 | `receipt.test.js:24` (private receipt; environment keys limited to `container`, `platform`, `runtime` at `:39`) |
| SEC-4 | `lifecycle-cli.test.js:55`, `evidence-binding.test.js:234`, `handoff.test.js:219` |
| SEC-5 | `runtime-coverage.test.js:31`, `:52`; limit stated in ADR-043 |
| SEC-6 | `skill-contract.test.js:160` (no auto-merge); every integration test runs in temporary fixtures |

### C5 — issue map

| Issues | Passing regression tests (file:line) |
|---|---|
| 1 | `evidence-binding.test.js:104`, `:145`, `:234` |
| 2 | `runtime-coverage.test.js:40`, `:128` |
| 3 | `seal.test.js:104`, `receipt.test.js:104` |
| 4 | `lifecycle-cli.test.js:200`, `:256` |
| 5 | `evidence-run.test.js:177`, `:187` |
| 6 | `runtime-coverage.test.js:84`, `:59` |
| 7 | `handoff.test.js:194`, `:219`; Issue 7b (portable CI): `evidence-binding.test.js:394`, `:414` |
| 8 | `evidence-binding.test.js:335`, `:261` |
| 9 | `skill-contract.test.js:532` |
| 10 | `evidence-binding.test.js:510`, `evidence-attack-rejected.test.js:59` |
| 11 | `evidence-binding.test.js:551`, `:576`, `:588` |
| 12 | `evidence-binding.test.js:702` |
| 13 | `evidence-binding.test.js:722`, `:742` |
| 14 | `evidence-binding.test.js:659` |
| 15 | `evidence-adversarial.test.js:148` (mutation matrix, case "Issue 15") |
| 16, 17 | `evidence-adversarial.test.js:312`, `:274` |
| 18–22, 24, 25 | `evidence-round7.test.js:26`, `:45`, `:140`, `:70`, `:82`, `:97`, `:116` |
| 23 | `closure-retention.test.js:85`, `:94`, `:117` |
| 26 | `remediation-variants.test.js:25`, `:53`; `remediation-round10-variants.test.js:40`, `:55` |
| 27 | `remediation-variants.test.js:69` |
| 28 | `remediation-variants.test.js:88`; `remediation-round10-variants.test.js:73` |
| 29 | `remediation-matrix.test.js:19`; `remediation-variants.test.js:113`, `:134` |
| 30 | `remediation-round10-variants.test.js:141` |
| 31 | `remediation-variants.test.js:100`; `remediation-round10-flow.test.js:127` |
| 32 | `remediation-round10-flow.test.js:70`, `:100`; `remediation-round10-variants.test.js:100` |
| 33 | `remediation-round10-flow.test.js:117`; `remediation-round10-variants.test.js:162` |
| 34 | `remediation-matrix.test.js:37` |

### C6 replays

Copies of the probes were run from `c6/` so the original evidence directories stay unchanged.

| Probe set | Result |
|---|---|
| Tenth review `independent-variants.mjs` + `independent-controls.mjs` (originals) | 9 passed, 2 failed on probe shape: the two "dirty submodule cannot hide behind `--assume-unchanged`/`--skip-worktree`" cases expect a returned snapshot, while the code now throws the fail-closed rejection `initialized submodule has unreviewed local content`. The eleventh review's adapted copies assert that rejection and pass (cases 12 and 13 below) |
| Eleventh review replays (variants, controls, whole flow, chain, runtime) | 25 passed, 0 failed |
| Eleventh review new attacks | 61 passed, 0 failed |
| Eleventh review eligibility controls | 2 passed, 0 failed |
| Eleventh review normative chain | 30 passed, 0 failed |
| Eleventh review boundary pipeline, static cases | 18 passed, 0 failed (`--test-skip-pattern=race`) |
| Eleventh review clone CI (full and depth-1 clones) | 82 and 22 passed, 0 failed |
| Eleventh review `secret-path.mjs` | Fails: a `.env` inside a declared untracked directory whose **name contains a non-UTF-8 byte** is read and hashed. A control with UTF-8 names (`c6/secret-path-utf8-control.mjs`, output in `checklist/c6-secret-path-utf8-control.json`) reads nothing and the secret does not affect the digest. Out of scope under R7 rule 1 (non-UTF-8 path names); follow-up below |
| Eleventh review boundary race cases and `read-race.mjs` | Not run: time-of-check/time-of-use class, out of scope under R7 rule 1 |
| Eleventh review `quality.mjs` | Superseded by C3 and C9: it compares the globally installed skills, which are refreshed only at the release checkpoint |

## C7 finding and correction

The first C7 run, the first execution of this change's suite in an environment like the
GitHub runner (no installed skills, no GitHub authentication), failed the same two tests on
Node 18 and Node 20. Both reproduced on the host with Node 22 under the same conditions, so
neither depends on the Node version. Every earlier review ran on this host, where skills are
installed and `gh` is authenticated, which is why ten reviews did not see them. Both are
blocking under R7 rule 3: each violates a checklist item, describes an ordinary environment,
and would turn the pull request's required CI red.

| Test | Cause | Correction | Regression |
|---|---|---|---|
| `evidence-run.test.js:85` RAW sends exact non-UTF-8 bytes | With no skills installed, `run()` in `src/cli/dispatch.js` printed the install notice into stdout before the child's RAW bytes (AC-1/AC-2: RAW adds nothing to child streams) | The notice is not printed for `run --raw` | `dispatch.test.js:220` "no target installed + `run --raw` → no install notice" (red before, green after) |
| `lifecycle-cli.test.js:256` sdd-commit precondition matches `next` | With GitHub unavailable, `next` routed to `blocked` (`GITHUB_CONTEXT_UNAVAILABLE`) while the `sdd-commit` precondition only checked the lifecycle state and reported met (Issue 4 class) | The `sdd-commit` precondition is met only when `next` routes to `sdd-commit`; otherwise the route is the reason | `lifecycle-cli.test.js:240` "sdd-commit precondition is not met while next is blocked by an unavailable GitHub context" (red before, green after) |

After the correction: C1 819/811/0/8, C7 819/811/0/8 on Node 18 and 20, C8 exit 0 at both
simulated CI points, eleventh-review probes 118/118 (`c6/r11-after-fix.log`). The CLI spec
and CHANGELOG describe both behaviors.

## Follow-ups (owner: methodology maintainer; not blocking under R7)

1. The eight R6 TODO tests (summary accuracy for Laravel/PHPUnit totals, display truncation
   and byte bounds, terminal control sequences, telemetry and run-store symlinks).
2. Error-case navigation in the context packet.
3. A simpler runtime-gate path for changes without a product runtime surface.
4. Temporary-directory hygiene in the test suite: fixture directories are not removed;
   about 6,600 accumulated in `/tmp` on 2026-10-07 and 2026-10-08, filling the root
   filesystem together with 4.3 GB of private review evidence.
5. Reject non-UTF-8 names inside declared untracked source paths fail-closed (eleventh
   review `secret-path.mjs`), instead of hashing their contents.
6. A dedicated fixture for a duplicate same-repository delivery observation (AC-10 (8)).
7. Declare `handoff.non_runtime` in `schemas/tasks.schema.json` (accepted today through
   additional properties).
8. Direct tests for the unavailable-identity issue codes (EC-2) and for a criterion declared
   in both `runtime_coverage` and `non_runtime` (closure review follow-up 3).
9. Local commits not yet pushed to an open pull request route to "wait for CI", so the
   `sdd-commit` precondition is unmet until a manual push; fails closed (closure review
   follow-up 5, derived from code reading).

## Closure review

`closure-review-report.md`: **approved**, C1–C12 verified, no blocking finding, no delta round.
Its record-accuracy follow-ups were applied before commit: the non-UTF-8 limit is stated as
actual behavior in ADR-043, `docs/security-checklist.md`, R7 rule 1 and the CHANGELOG, and the
citations above were refreshed. The pull request keeps the C8 layout (change folder removed in
the last commit) and is merged with a merge commit.

## Accepted limits

As stated in R7 rule 1 and ADR-043: deliberate forgery with write access to the repository,
Git internals, index flags or evidence stores; time-of-check/time-of-use races during a run;
exotic inputs the supported repositories do not contain; and the R2–R5 limits (private
receipts are local-only in CI, shallow history is unknown, delivered evaluation relies on
merge lineage and branch protection).
