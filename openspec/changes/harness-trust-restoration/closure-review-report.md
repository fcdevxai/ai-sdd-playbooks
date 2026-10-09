# Closure review — harness-trust-restoration (methodology)

Result: approved
Reviewer: Claude Code subagent (general-purpose), Anthropic, Claude Opus 5.5 (`claude-opus-5-5`)
Date: 2026-10-08

## Checklist

Evidence paths are relative to the closure evidence directory
`E=/mnt/data/playbook-closure/harness-trust-restoration-20261009T012631Z/`. Every
re-run used `TMPDIR=$E/tmp`. The methodology checkout was left unchanged by this
review: 129 status entries and the same working-tree diff hash before and after.

| ID | Result | Evidence |
|---|---|---|
| C1 | verified | Recorded `npm test`, not re-run: `checklist/c1b-npm-test.log` and `.exit` show exit 0 in 317 s, with 819 tests, 811 pass, 0 fail, 0 skipped and 8 TODO. The TODO tests are AUD-O3, AUD-O4, AUD-S1, AUD-S1b, AUD-S2, AUD-S3, AUD-S4 and AUD-S5, which is the R6 list. The run started at about 23:01:43, after the last code edit (`src/cli/validate.js`, 23:01:19). Only `CHANGELOG.md`, `openspec/specs/cli/spec.md` and `closure-report.md` changed afterwards, and no test reads them. |
| C2 | verified | Re-ran `node src/generator/generate-skills.js --check`: "No drift — 13 skill(s) in sync", exit 0. This matches `checklist/c2-generate-check.log`. |
| C3 | verified | Re-ran `node --check` on every tracked and untracked `*.js`, `*.mjs` and `*.cjs` file: 144 files, 0 failures. This matches `checklist/c3.exit`. |
| C4 | verified | Every cited `file:line` resolves to a test in the current tree, and every cited test is `ok` in c1b (0 `not ok`). The bodies assert the mapped behavior: exits 7, 126, 127 and 128+n with retained diagnostics; counts, warnings, skips and incomplete tests; lossless raw output with hashes and 0700/0600 modes; RAW byte equality; contract-byte staleness; refusal of a missing design, reference or agent; content-freshness negatives; receipt identity, allowlisted environment, and ineligibility after a capture error or signal; closure survival; blocks for an open PR, missing raw evidence or a failed copy; adapter omission, empty, unrelated or fabricated evidence, and exclusion authority and criteria; seal refusing pre-merge verification; engine unanimity. All nine AC-10 canaries are present and pass. For the hook and RTK part of AC-1 and for SEC-1, I re-ran the Hub `openspec/changes/harness-trust-restoration/f06_hook_canaries.py` against the candidate CLI: 11/11 OK. The recorded 11/11 predated the C7 change to `run --raw`, and the Hub was unchanged afterwards. `src/` and `bin/` contain no `permissionDecision`. AC-11 and EC-6 rest on C1, C2, C9–C11 and R7 rule 6: Hub CI pins `#v0.9.2`, and the real-HOME skills are still 0.9.2. Remaining test gaps are follow-up 3. |
| C5 | verified | Every regression cited for Issues 1–34 is `ok` in c1b. This includes the mutation case "Issue 15: corrupt latest binding beside a nonexistent-SHA candidate" and the parameterized cases (6/6, 4/4 and 8/8). I read the bodies for Issues 26, 30, 32 and 33 and they match the tenth-review descriptions; earlier issues match tasks R.2–R.44. There is citation drift: `lifecycle-cli.test.js:216` (Issue 4) now resolves to the helper `withGitHubUnavailable`, which the C7 correction inserted. The test itself ("sdd-commit precondition is met exactly when next routes to commit") is at `:256` and passes. The Issue 7b regressions `evidence-binding.test.js:394` and `:414` pass but are missing from the map. Both are follow-up 2. |
| C6 | verified (exceptions classified under R7 rule 1) | `c6/r10-variants-controls.log` shows 9/11. The 2 failures happen when the probe's fixture step reaches the fail-closed throw "initialized submodule has unreviewed local content". Submodules and index flags are out of scope, and the eleventh-review adapted copies assert this rejection and pass as cases 12–13 in `c6/r11-replays.log`. Other results: `r11-replays` 25/25, `r11-new-attacks` 61/61, `r11-eligibility` 2/2 and `r11-normative-chain` 30/30, re-run after the C7 fix as `r11-after-fix.log` 118/118; `r11-boundary-static` 18/18, with race cases skipped; `r11-clone-ci` 82/82 and 22/22. `secret-path.mjs` fails only for a directory name containing a non-UTF-8 byte, which is out of scope. The UTF-8 control `c6/secret-path-utf8-control.mjs` had no saved output, so I re-ran it: 0 reads, and the secret does not affect the digest in either variant. The race cases and `read-race.mjs` were not run (time-of-check/time-of-use races, out of scope). `quality.mjs` is superseded: C3 covers its syntax check, and its real-HOME parity check waits for the release, while C9 covers an isolated HOME. Every eleventh-review probe file is accounted for. |
| C7 | verified | `c7b/node18.log` (v18.20.8) and `c7b/node20.log` (v20.20.2): `npm ci` ok; 819 tests, 811 pass, 0 fail, 8 TODO; `generate:check` reports no drift; `--version` prints 0.10.0; both `.exit` files are 0. HOME was empty: no skills, no `gh` configuration and no Git identity. `c7b/repo18` and `repo20` equal the live tree except `CHANGELOG.md`, the CLI spec and the closure report, which were edited later and are read by no test. No test or source file references the change folder, so a PR head without it is equivalent. The first run (`c7/`) failed exactly the two tests that the correction fixed (817 tests, 807 pass, 2 fail). |
| C8 | verified | `c8b/repo` is a full-history clone, not shallow. At the PR head `d6977bb` (detached, with the change folder removed as earlier `chore: archive` commits did) and at post-merge `main` `be90175`, `validate --ci --json` reports failed 0 and an empty `local_only`, with only the `contract.path_in_loom` notice. With no failures, `validate` returns 0 (`src/cli/validate.js:296`). The re-run after the C7 fix (`c8b/`) is identical to `c8/`. |
| C9 | verified | `checklist/c9-install.log` shows methodology 0.10.0 installing 13 skills into both isolated targets. I recomputed `cmp` between `c9home/{.claude,.agents}/skills/*/SKILL.md` and `skills/*/SKILL.md`: 26/26 identical, and `.playbook-version` is 0.10.0. The real `~/.claude/skills` and `~/.agents/skills` are still 0.9.2, last written at 14:01, so the install did not touch them. |
| C10 | verified | Recomputed: the protected `src/repos/classify.js` (a6f864d4…), `src/repos/plan.js` (33988736…), `test/repos.test.js` (ccb6807e…) and the Hub prompt (60b4926e…) match the baseline. For the Hub, `api` and `app`, these all equal `baseline/baseline.json`, and I re-checked them after my own re-runs: HEAD, the index (`sha256(git ls-files --stage -z)`), the working-tree diff sha256, the modified count, and the untracked set with per-file sha256 or symlink target. `diff -rq c10/base-methodology` against the live tree (excluding `.git`, `node_modules` and `.specloom`) gives exactly the 24 entries in `checklist/c10-methodology-diff.txt`. The backup tarballs pass `sha256sum -c`. |
| C11 | verified | I re-ran the four recorded commands in the Hub with the candidate CLI. `doctor` exits 4, `validate harness-trust-restoration` exits 1, and `status` and `next` exit 0. The output is identical to `checklist/c11-hub-cli.log`. That log predates the C7 correction, but the correction changes only `run --raw` and `--precondition sdd-commit`. `validate` fails because the Hub's `handoff-manifest.json` pins the pre-closure hashes of methodology `design.md` (1cebf2f4…) and `skills/sdd-plan/SKILL.md` (ef0c723b…), and this closure edited both. No Hub file changed after 22:50, including the ignored `.specloom/`. |
| C12 | verified | The `sdd-plan` and `sdd-runtime-gate` skills, canonical and generated, require every AC, EC and SEC to appear exactly once: in `runtime_coverage`, or in `non_runtime` with a rationale. The code enforces this in `src/tokens/handoff.js:184-189`, `src/lifecycle/runtime-coverage.js:103-104` (both or neither) and `:172` (unrelated coverage). `openspec/specs/cli/spec.md` matches `src/cli/run.js`, `src/cli/evidence.js` and `src/cli/validate.js:341` on run flags, exits, RAW, packet, the `evidence seal/bind/retain` syntax, the single evaluator and the sdd-commit precondition. `openspec/specs/playbooks/spec.md` matches the stage skills: `packet --stage --agent` appears in seven skills and `evidence retain` in `sdd-archive`. ADR-042 and ADR-043 exist and are indexed. The README command table is updated. The CHANGELOG has a 0.10.0 entry with migration notes, and the `sync` command it mentions exists. `package.json` and `package-lock.json` are at 0.10.0, and the lockfile diff changes only the version. `playbook.config.yaml` and `playbook.lock` are unchanged. Both consumer templates pin `semver:^0.10.0`; `playbook-validation.yml` also checks out the exact head SHA with `fetch-depth: 0`. One sentence about an out-of-scope class is inaccurate; see follow-up 1. |

## Blocking findings

None. No observation meets all three conditions of R7 rule 3. Every item below is out of
scope under R7 rule 1, fails closed, or concerns record accuracy, and none reproduces in the
real flow.

## Follow-ups

- **1. The non-UTF-8 limit is overstated.** ADR-043 ("Accepted limits") and
  `docs/security-checklist.md` say that non-UTF-8 path names are "rejected fail-closed".
  The eleventh-review `secret-path.mjs` shows otherwise: a `.env` inside a non-UTF-8
  directory of a declared untracked path is read and hashed. The `.env` basename check
  misses hex-encoded keys (`src/tokens/evidence.js:229`, `:233`). Not blocking: the class
  is out of scope, supported repositories contain no such names, and the UTF-8 case reads
  nothing. Recommended action: implement closure follow-up 5 (reject these names
  fail-closed), which makes both sentences true. Alternative: narrow the two sentences
  until then. — owner: methodology maintainer
- **2. Closure-report citations.** C5 (Issue 4) and the C7 table cite
  `lifecycle-cli.test.js:216`; the test is now at `:256`. The Issue 7b regressions
  `evidence-binding.test.js:394` and `:414` are missing from the map. The output of the
  UTF-8 secret-path control was not saved. This affects record accuracy only; no
  re-review is needed. — owner: closure apply session
- **3. Implemented behavior that no test asserts directly.** (a) EC-2: no test asserts that
  an unknown provider or model records `PROVIDER_UNAVAILABLE` / `MODEL_UNAVAILABLE`
  (`src/tokens/receipt.js:57-59`, `src/tokens/handoff.js:197-198`). (b) No test covers a
  criterion declared in both `runtime_coverage` and `non_runtime`
  (`src/lifecycle/runtime-coverage.js:103`). Action: add both cases to the existing
  suites. — owner: methodology maintainer
- **4. The real PR must use the C8 layout.** C8 simulated a PR head without the change
  folder, which is this repository's archive convention. Action: open the PR with that
  layout and merge it with a merge commit, as earlier archive PRs were merged. Then PR CI
  matches C8, and the failed reviews and closure documents stay in `main`'s history. If
  the PR head keeps the change folder, rerun C8 on that head before merging. — owner:
  closure apply session, at PR time
- **5. Unpushed commits on an open PR.** Since the C7 correction, `--precondition
  sdd-commit` follows `next`. The delivery resolver (`src/github/index.js:86-91`) does not
  compare a clean local HEAD with the head of an open PR. Commits made locally but not yet
  pushed to an open PR therefore route to "wait for CI", and the precondition is unmet. This
  fails closed, and a manual push resolves it. It is derived from reading the code, not
  reproduced. Action: consider detecting a local HEAD ahead of the PR head. — owner:
  methodology maintainer
- **6. Release steps outside this review.** After tagging `v0.10.0`, point the global
  `playbook` at a clean checkout of the tag (ADR-042 decision 4; CHANGELOG migration step
  5). Today it resolves to this uncommitted checkout. Install the global skills, still
  0.9.2, only when the user decides to (EC-6). — owner: user, at release
- **7. Hub `validate` stays red.** It fails until the Hub's own closure regenerates or
  decouples its handoff from the methodology files this closure edited. — owner: LIA Hub
  closure session
- **8. Recorded closure follow-ups and disk space.** The closure follow-ups 1–7 in
  `closure-report.md` stand as recorded. The root filesystem is at 100% (267 MB free).
  This makes closure follow-up 4 (temporary-directory hygiene in the test suite) a
  practical risk for the PR steps (`npm ci`, Git). Free space before opening the PR. —
  owner: methodology maintainer
