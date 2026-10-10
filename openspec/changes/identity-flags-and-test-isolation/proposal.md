---
schema: proposal
schema_version: 1
change_id: identity-flags-and-test-isolation
title: Agent identity flags in skills and isolated test temporary directories
status: approved
owner: pending
created: '2026-10-09'
updated: '2026-10-09'
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
  risk: low
  triggers: []
runtime_relevant_capabilities: []
---
# Agent identity flags in skills and isolated test temporary directories

## Objective

Close two follow-ups recorded by `merged-delivery-identity` (`0.10.1`) and release them as
`0.10.2`:

1. **Identity flags.** Seven lifecycle skills tell agents to run
   `playbook packet … --agent <agent>` and `playbook run … --agent <agent>`, but never show
   `--provider` and `--model`. An agent that packs its identity into `--agent`
   (observed on 2026-10-09: `--agent claude/anthropic/claude-opus-5-5`) produces receipts and
   handoff manifests with `provider: unknown` and `model: unknown`. The record stays honest
   (ADR-043, SEC-5 of `harness-trust-restoration`), but the identity is lost and the receipts
   have to be rerun.
2. **Test temporary directories.** A full `npm test` leaves about 1,080 directories and
   about 300 MB in the system temporary directory, because many tests create fixtures with
   `fs.mkdtempSync(os.tmpdir())` and never remove them. On 2026-10-07/08 this filled the
   root filesystem of the development machine (about 6,600 directories).

## Guiding principle

Fix each problem by its class, at the single place that controls it: every skill instruction
that invokes `playbook packet` or `playbook run` shows the same three identity flags, and the
test command owns one temporary root per run and removes it, instead of patching cleanup into
each test file.

## Impacted modules

- Skills `sdd-plan`, `sdd-apply`, `sdd-code-review`, `sdd-security-gate`, `sdd-runtime-gate`,
  `sdd-commit`, `sdd-verify`: `canonical.md` and the generated `SKILL.md`.
- Test command: a runner in `test/helpers/` and the `test` script in `package.json`.
- `docs/doc_verification_guide.md` and the README test line, so single-file runs use the
  runner.
- `CHANGELOG.md`, `package.json`/`package-lock.json` version.

## Impacted repos

## Files touched

## Expected behavior

### Happy path (Given/When/Then)

Given an agent following any of the seven skills, when it builds a `playbook packet` or
`playbook run` command, then the instruction shows `--agent <agent> --provider <provider>
--model <model>` as separate flags, says to pass only values the runtime actually reports,
and says that an unknown provider or model is omitted (recorded as `unknown`), never packed
into `--agent`.

Given a developer or CI running `npm test` (or `npm test -- test/<file>.test.js`), when the
run ends with success, failure or interruption by `SIGINT`/`SIGTERM`, then the run's
temporary root is removed and the system temporary directory has no new fixture directories
from it; the test exit code is preserved.

### Edge cases

A test process killed with `SIGKILL` cannot clean up; its temporary root is recognizable by
its prefix and lives under the system temporary directory. An already-set `TMPDIR` (for
example a larger disk) is honored as the parent of the run's root.

## Acceptance criteria

- **AC-1:** Every `playbook packet` and `playbook run` invocation shown in the seven skills' `canonical.md` includes `--agent`, `--provider` and `--model` as separate flags, and each of those skills states once that identity values must be observed values passed separately and are omitted when unknown.
- **AC-2:** The generated `SKILL.md` files match their `canonical.md` (`npm run generate:check` reports no drift), and a contract test fails if any skill shows `--agent <agent>` without `--provider` and `--model` in the same invocation.
- **AC-3:** `npm test` runs the same test files as before (`test/*.test.js`) through a runner that creates one temporary root per run under the inherited temporary directory, passes it as `TMPDIR` to the test processes, and removes it when the run ends.
- **AC-4:** After a full `npm test`, no directory created by that run remains in the parent temporary directory.
- **AC-5:** The runner preserves the exit code of `node --test` (0 on success, non-zero on any failure) and forwards file arguments (`npm test -- test/<file>.test.js`).
- **AC-6:** CI (`.github/workflows/tests.yml`, Node 18 and 20) keeps running `npm test` unchanged and passes.

## Error cases

- **EC-1:** A failing test: the temporary root is still removed and the runner exits non-zero.
- **EC-2:** `SIGINT` or `SIGTERM` during a run: the signal reaches the test process, the temporary root is removed, and the runner exits with the conventional signal status.
- **EC-3:** The temporary root cannot be created: the runner fails before running tests with a clear message and a non-zero exit, never running tests against the shared temporary directory silently.

## Security considerations

- **SEC-1:** The runner removes only the root it created itself (a path returned by `fs.mkdtempSync` under the inherited temporary directory), never a path taken from arguments or environment, and refuses to remove anything outside that parent.
- **SEC-2:** The skills keep stating that identity values are declared, not observed by the CLI; this change does not make a declared model look observed (receipts keep `provenance: caller_declared`).

## Constraints and non-goals

No change to CLI behavior, receipts, handoff manifests, lifecycle rules or the evidence model.
The `playbook run` usage string and an optional warning for `--agent` values containing `/`
are out of scope (CLI surface; the experimental `cli` adapter would block this change's
runtime gate, ADR-032). Individual test files are not rewritten; their own cleanup can improve
later without affecting this runner. Squash/rebase delivered evidence (follow-up 1 of
`merged-delivery-identity`) is out of scope.

## Open technical decisions

None. The user chose on 2026-10-09 a separate `0.10.2` after `0.10.1` covering both items,
with the identity fix applied to all seven skills and a central test-runner fix ("Adelante,
avanza con la 0.10.2 aparte"). The user approved this proposal on 2026-10-09 ("Si, apruebo la propuesta").
