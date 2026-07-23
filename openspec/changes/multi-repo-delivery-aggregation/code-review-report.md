---
schema: code-review-report
schema_version: 1
change_id: multi-repo-delivery-aggregation
status: passed
updated: 2026-07-23
---
# Code Review Report — Delivery multi-repo agregado

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- Do not suggest improvements outside spec scope.

## Checklist

- [passed] AC-1 covered by `test/delivery.test.js` — "3 repos, only hub merged → not merged"
- [passed] AC-2 covered by `test/delivery.test.js` — "all 3 merged → merged" + `reduceDelivery` unanimous test
- [passed] AC-3 covered by `test/delivery.test.js` — "ci_failed repo names the repo in per_repo"
- [passed] AC-4 covered by `test/delivery.test.js` — "GitHub unavailable repo mixed with merged → unknown, never merged" (SEC-1 negative)
- [passed] AC-5 covered by `test/delivery.test.js` "single-repo early-return" + `test/lifecycle-cli.test.js` no-regression test
- [passed] AC-6 covered by `test/delivery.test.js` `per_repo.length` assertions + `test/lifecycle-cli.test.js` `--json` test
- [passed] EC-1/SEC-2 covered by `test/delivery.test.js` — undeclared repo → `unknown`, `resolveOne` never called for it
- [passed] EC-2 covered by `test/delivery.test.js` — hub not a git repo → `unknown`
- [passed] SEC-3 (no persistence) — verified by inspection: `resolveMultiRepoDelivery` performs no writes; `status.js` attaches `per_repo` only to the in-memory render result, never to `sdd.lock`
- [passed] No changes outside allowed modules — diff matches `## Files touched` exactly (`src/repos/delivery.js`, `test/delivery.test.js`, `src/cli/status.js`, `test/lifecycle-cli.test.js`, `templates/project/playbook.config.yaml`, `skills/sdd-verify/canonical.md`, `skills/sdd-archive/canonical.md`; the two `SKILL.md` files are generated artifacts of the latter, produced by `npm run generate`)
- [passed] Conventions & quality gates respected — `node --check` on both changed source files, `node --test test/delivery.test.js` (20/20), `node --test test/lifecycle-cli.test.js` (10/10), `npm run generate:check` (no drift), `npm test` (314/314) all re-run and green during this review

## Issues found

None. Implementation matches the approved `design.md` public contract (`{ state, per_repo, blocked_reason? }`) and the ADR's "weakest link" reduction table exactly (`src/repos/delivery.js:19-59` mirrors design.md's precedence table rows 1–7). Fail-closed behavior (SEC-1) is structurally guaranteed by `PRECEDENCE` placing `unknown` first, and `resolvePathOrNull` (`src/repos/delivery.js:89-95`) never calls `resolveOne` for a path that failed to resolve, satisfying SEC-2 without constructing a path from untrusted input. The single-repo early-return (`src/repos/delivery.js:69-72`) preserves exact back-compat, confirmed by the pre-existing `lifecycle-cli.test.js` suite still passing unchanged.

One deliberate, disclosed deviation from `design.md`'s literal signature (`{ cwd, changesDir, runGit, runGh }`) to the implemented `{ cwd, changesDir, slug, resolveOne }` is documented in `tasks.md`'s "Refinamiento del seam de test" note and does not affect the approved public contract: production (`src/cli/status.js:41`) only ever passes `{ cwd, slug }`, so `resolveOne` defaults to `resolveDelivery` and the runtime behavior is identical to the design's described flow — `runGit`/`runGh` were never part of the contract callers rely on, only an internal test-injection mechanism that a per-path fake couldn't satisfy (a flat `runGit(args)` fake can't distinguish which repo's `cwd` it's being asked about). Not a scope or spec violation.
