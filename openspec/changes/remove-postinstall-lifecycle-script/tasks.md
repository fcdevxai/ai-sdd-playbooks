---
schema: tasks
schema_version: 1
change_id: remove-postinstall-lifecycle-script
status: passed
updated: 2026-07-27
---
# Tasks — Eliminar el postinstall que puede romper `npm install` de consumers

## Rules

- Every task must have a verifiable success criterion; never mix unrelated layers
  in one task if it makes verification non-atomic.
- Do not plan changes to files outside `## Constraints and non-goals`.
- State inter-task dependencies explicitly.
- Any task implementing a `## Security considerations` entry (`SEC-N`) must name
  its negative test (e.g. "unauthorized access is rejected") as part of its
  success criterion, not only the happy path.
- The `Regression` entry in the quality-gates phase is mandatory, not
  conditional on risk: it is the exact line `playbook packet` extracts to
  carry the regression command to every gate that reads the packet. Omitting
  it does not skip regression — it silently drops the command before the
  gates ever see it.

## Preconditions (self-check)

`proposal.status == approved` ✓ (`proposal.md`), `design.status == approved` ✓
(`design.md`, design was required for this change). Both confirmed by direct
read of the frontmatter — no missing precondition.

Note: AC-10 (`adr-remove-postinstall-lifecycle-script.md` exists with
`status: proposed` and `supersedes: ADR-006`) is already satisfied by the
artifact created during `sdd-new`/`sdd-design` — no task below touches it.

## Phase 1 — Remove the lifecycle script

### Task 1.1 — Replace the postinstall test suite with a structural guard [x]
- **Files**: `test/postinstall.test.js`
- **Success criterion**: The file no longer tests `scripts/postinstall.cjs`
  behavior (that script won't exist after Task 1.2). It contains one test that
  reads `package.json`, asserts `pkg.scripts` is either absent or does not
  contain a `postinstall` key, and fails loudly if it does — this is the
  negative test for **SEC-1** (no lifecycle script means no supply-chain
  execution surface; the test is what makes a future silent reintroduction
  impossible). Run in isolation: `node --test test/postinstall.test.js` passes
  against the tree state produced by Task 1.2 (write this test first, expect
  it to fail until Task 1.2 lands, per TDD).
- **Linked acceptance criterion**: AC-3, EC-3

### Task 1.2 — Delete the script and its declaration [x]
- **Files**: `package.json`, `scripts/postinstall.cjs` (deleted)
- **Depends on**: Task 1.1 (test must exist first and fail red)
- **Success criterion**: `scripts/postinstall.cjs` no longer exists in the
  tree. `package.json` no longer has a `scripts.postinstall` key. Since the
  file being deleted was the only content of `scripts/`, also drop the
  `"scripts/"` entry from `package.json`'s `files` array (an empty directory
  has nothing to publish). `node --test test/postinstall.test.js` now passes
  (green).
- **Linked acceptance criterion**: AC-1, AC-2, SEC-1

## Phase 2 — Self-extinguishing CLI notice

### Task 2.1 — Add `anyTargetInstalled` to the shared targets module [x]
- **Files**: `src/install/targets.js`, `test/install.test.js`
- **Success criterion**: `src/install/targets.js` exports
  `anyTargetInstalled(env, home)`: calls the existing `resolveTargets(env,
  home)`, then returns `true` if `.playbook-version` exists under at least one
  resolved target directory, `false` otherwise (same stamp file `doctor.js`'s
  `readStamp` already reads — no new state). Injectable `env`/`home`, same
  pattern as `resolveTargets`, so tests never touch the real home directory.
  `test/install.test.js` gets two new cases: both targets absent → `false`;
  at least one target directory containing `.playbook-version` → `true`.
  `node --test test/install.test.js` passes.
- **Linked acceptance criterion**: AC-8 (groundwork)

### Task 2.2 — Wire the notice into `run()` [x]
- **Files**: `src/cli/dispatch.js`, `test/dispatch.test.js`
- **Depends on**: Task 2.1 (`anyTargetInstalled` must exist)
- **Success criterion**: In `run()`, immediately before dispatching to the
  resolved `handler`, when `parsed.command !== 'install'` and
  `!parsed.flags.json` and `!anyTargetInstalled()`, `io.out` prints exactly
  one line naming the installed version (via the already-imported
  `readPackageVersion`) and the `playbook install` reminder — then execution
  continues to the handler unchanged (the notice never replaces or blocks the
  command's own output or exit code). `test/dispatch.test.js` gets four new
  cases, matching the design's testing strategy: (a) both targets absent +
  command `status` → the notice line appears in `io.out` before the command's
  own output; (b) both targets absent + command `install` → notice does
  **not** appear; (c) both targets absent + `--json` → notice does not appear
  (**SEC-2** negative test: machine-readable output is never contaminated with
  free text); (d) at least one target present + command `status` → notice
  does not appear. `node --test test/dispatch.test.js` passes.
- **Linked acceptance criterion**: AC-6, AC-7, AC-8, SEC-2

## Phase 3 — Documentation

### Task 3.1 — Document the real install command in the README [x]
- **Files**: `README.md`, `test/readme.test.js` (new)
- **Success criterion**: The `## Install (global, once)` section gains, as
  its first line before the existing `playbook install` commands, the fenced
  command `npm install -g
  github:lablab-outplacement/lablab-playbook-ai-v2#semver:^X.Y.Z`, followed by
  a short note that the repo is private and requires git access (SSH key or
  PAT) configured. A new `test/readme.test.js` reads `README.md` and asserts
  both the install command pattern (`npm install -g
  github:.*lablab-playbook-ai-v2#semver:`) and a mention of private/SSH/PAT
  access appear inside the `## Install (global, once)` section. `node --test
  test/readme.test.js` passes.
- **Linked acceptance criterion**: AC-4, AC-5

### Task 3.2 — Update the security checklist's postinstall row [x]
- **Files**: `docs/security-checklist.md`
- **Depends on**: Task 1.2 (the script must actually be gone)
- **Success criterion**: The row currently describing `postinstall`
  (`scripts/postinstall.cjs`) as an active supply-chain surface is rewritten
  to state the script was removed (linking
  `adr-remove-postinstall-lifecycle-script.md`) and no longer runs on any
  consumer/CI install — the row no longer describes a live surface needing an
  owner's ongoing attention. Manual read-through: no reference to
  `scripts/postinstall.cjs` remains framed as a current risk anywhere in the
  file.
- **Linked acceptance criterion**: AC-9

## Phase 4 — Quality gates

- **Format**: (no formatter configured — skip, per `docs/doc_verification_guide.md`)
- **Lint/type-check**: `node --check package.json` is not applicable (JSON);
  run `node --check src/install/targets.js && node --check src/cli/dispatch.js`
- **Feature tests**: `node --test test/postinstall.test.js test/install.test.js test/dispatch.test.js test/readme.test.js`
- **Regression**: `npm test && npm run generate:check`

## Execution Report

All 6 tasks implemented TDD (test red → code → test green), each routed
through `playbook run --change remove-postinstall-lifecycle-script --step
apply -- <command>`.

| AC / SEC | Verified by | Result |
|---|---|---|
| AC-1, AC-2, SEC-1 | `test/postinstall.test.js` — asserts no `scripts.postinstall` key and `scripts/postinstall.cjs` absent | pass |
| AC-3, EC-3 | same test — the structural guard itself (negative test for SEC-1) | pass |
| AC-4, AC-5 | `test/readme.test.js` — install command + private/SSH/PAT note present in `## Install (global, once)` | pass |
| AC-6, AC-7, AC-8 | `test/dispatch.test.js` — notice appears (no target, non-install command), absent for `install`, absent once a target is stamped | pass |
| SEC-2 | `test/dispatch.test.js` — `--json` output stays single-line valid JSON, uncontaminated | pass |
| AC-9 | `docs/security-checklist.md` — postinstall row + the related `--ignore-scripts` accepted-risk row both rewritten to reflect removal (manual read-through) | pass |
| AC-10 | `adr-remove-postinstall-lifecycle-script.md` — pre-existing artifact, `status: proposed`, `supersedes: ADR-006` | already satisfied, untouched |
| EC-1, EC-2 | no code path left to exercise — no lifecycle script to ignore; CLI notice reuses `doctor`'s existing per-target detection criterion unchanged | satisfied by design, no new test needed |

### Commands run

- `node --check src/install/targets.js` — pass
- `node --check src/cli/dispatch.js` — pass
- `node --test test/postinstall.test.js test/install.test.js test/dispatch.test.js test/readme.test.js` — pass (59 lines)
- `npm test` — pass (full suite, 460 lines)
- `npm run generate:check` — pass, no drift

### Scope check

`git status --porcelain` shows exactly: `README.md`, `docs/security-checklist.md`,
`package.json`, `scripts/postinstall.cjs` (deleted), `src/cli/dispatch.js`,
`src/install/targets.js`, `test/dispatch.test.js`, `test/install.test.js`,
`test/postinstall.test.js`, `test/readme.test.js` (new) — matches
`design.md`'s Module impact list exactly, nothing outside `## Constraints and
non-goals`.

All tasks passed on the first attempt; no STOP encountered, no new ADR
required.
