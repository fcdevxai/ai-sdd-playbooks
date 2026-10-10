---
sources:
  proposal: dcf1a5181d681791ace333f8d28f6e34b28539b95f27e219de3f9aa3c8873f3b
  tasks: f76c07494d9e1548ae5d844548e97db28ec006f32f135ee2fbce3d8a7adef3e1
  contract: 2260109d99574a48c6b6a511d5963f4425e30b430daa082a75e3a115f9aaf70c
  contract_content: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
---
# Context Packet — Agent identity flags in skills and isolated test temporary directories

## Ticket

identity-flags-and-test-isolation

## Acceptance criteria

- **AC-1:** Every `playbook packet` and `playbook run` invocation shown in the seven skills' `canonical.md` includes `--agent`, `--provider` and `--model` as separate flags, and each of those skills states once that identity values must be observed values passed separately and are omitted when unknown.
- **AC-2:** The generated `SKILL.md` files match their `canonical.md` (`npm run generate:check` reports no drift), and a contract test fails if any skill shows `--agent <agent>` without `--provider` and `--model` in the same invocation.
- **AC-3:** `npm test` runs the same test files as before (`test/*.test.js`) through a runner that creates one temporary root per run under the inherited temporary directory, passes it as `TMPDIR` to the test processes, and removes it when the run ends.
- **AC-4:** After a full `npm test`, no directory created by that run remains in the parent temporary directory.
- **AC-5:** The runner preserves the exit code of `node --test` (0 on success, non-zero on any failure) and forwards file arguments (`npm test -- test/<file>.test.js`).
- **AC-6:** CI (`.github/workflows/tests.yml`, Node 18 and 20) keeps running `npm test` unchanged and passes.

## Constraints and non-goals

No change to CLI behavior, receipts, handoff manifests, lifecycle rules or the evidence model.
The `playbook run` usage string and an optional warning for `--agent` values containing `/`
are out of scope (CLI surface; the experimental `cli` adapter would block this change's
runtime gate, ADR-032). Individual test files are not rewritten; their own cleanup can improve
later without affecting this runner. Squash/rebase delivered evidence (follow-up 1 of
`merged-delivery-identity`) is out of scope.

## Security considerations

- **SEC-1:** The runner removes only the root it created itself (a path returned by `fs.mkdtempSync` under the inherited temporary directory), never a path taken from arguments or environment, and refuses to remove anything outside that parent.
- **SEC-2:** The skills keep stating that identity values are declared, not observed by the CLI; this change does not make a declared model look observed (receipts keep `provenance: caller_declared`).

## Files touched

- `test/skill-contract.test.js`
- `skills/{sdd-plan,sdd-apply,sdd-code-review,sdd-security-gate,sdd-runtime-gate,sdd-commit,sdd-verify}/canonical.md`
- `SKILL.md`
- `test/run-tests.test.js`
- `test/helpers/run-tests.js`
- `package.json`
- `scripts.test`
- `none (evidence only)`
- `docs/doc_verification_guide.md`
- `README.md`
- `CHANGELOG.md`
- `package-lock.json`

## Verification commands

- `N/A (no formatter configured)`
- `node --check test/helpers/run-tests.js && node --check test/run-tests.test.js && node --check test/skill-contract.test.js`
- `node test/helpers/run-tests.js test/run-tests.test.js test/skill-contract.test.js`
- `npm test && npm run generate:check`

## Contract

- Path: `openspec/specs/contracts/openapi.yaml`

## Handoff manifest

- openspec/changes/identity-flags-and-test-isolation/handoff-manifest.json

## Full sources

- openspec/changes/identity-flags-and-test-isolation/proposal.md
- openspec/changes/identity-flags-and-test-isolation/tasks.md
