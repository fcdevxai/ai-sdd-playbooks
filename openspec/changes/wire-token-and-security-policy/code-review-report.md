---
schema: code-review-report
schema_version: 1
change_id: wire-token-and-security-policy
status: passed
updated: 2026-07-23
---
# Code Review Report — Cablear la política de tokens y seguridad en los playbooks

## Summary

The change cleanly wires the ported token-efficiency directives (`changed-files
--diff`, `spec-read`) into the gate/verify/commit playbooks and adds the
`validateVerificationBody` enforcement plus the `sdd-verify` post-merge SEC-N
re-run. Code follows conventions, scope is respected, and all quality gates run
green.

The first review pass raised **one** blocking issue: the change's core
enforcement claim (AC-4 / EC-1 / EC-2 / SEC-1) — that `playbook validate` **fails**
a `verification-report.md` missing its security section — was proven only by a
unit test of `validateVerificationBody`, with no CLI-level regression guard for the
wiring. That has been **remediated** (see Issue 1): `test/validate.cli.test.js` now
exercises the real `validate` command against missing / empty / complete reports,
mirroring the existing proposal test. Full suite green (`npm test`, 348 assertions).
No production code changed for the fix — the behavior already worked; the tests
lock it in.

## Checklist

- [passed] AC-1 — diff-first in the 3 gates: `test/skill-contract.test.js` "diff-first…" + `grep -rl 'changed-files' skills/sdd-code-review skills/sdd-security-gate skills/sdd-runtime-gate` → 3.
- [passed] AC-2 — `spec-read` in gates+verify+commit, not apply/archive: `test/skill-contract.test.js` "section-first…".
- [passed] AC-3 — `sdd-verify` SEC-N re-run step + `## Security considerations` table: `test/skill-contract.test.js` "sdd-verify re-runs SEC-N…".
- [passed] AC-4 — `playbook validate` accepts a complete report and rejects a bad one: unit (`test/schema.test.js`) **and** CLI-level (`test/validate.cli.test.js` "complete verification-report.md exits 0" / "…without/empty '## Security considerations' is a violation").
- [passed] AC-5 — "Security and data sensitivity" mandatory in `sdd-enrich-us`: `test/skill-contract.test.js` "sdd-enrich-us lists…".
- [passed] AC-6 — no skill drift: `npm run generate:check` green.
- [passed] EC-1 / EC-2 — `playbook validate` names the missing/empty section and exits non-zero: `test/validate.cli.test.js` asserts exit `VIOLATION` + the `missing section` / `empty content` message.
- [passed] SEC-1 — the report's security section is a hard requirement: negative test at both unit and CLI level (a report without `## Security considerations` is rejected by `playbook validate`).
- [passed] SEC-2 — diff-first preserves the security gate's full-read on sensitive surface: content test asserts `full-read` + `sensitive surface` survive alongside the diff-first directive.
- [passed] SEC-3 — `verify` re-runs SEC-N negatives against merged code + hard `status: failed` rule: content test on generated `SKILL.md`.
- [passed] Scope — every changed file (`src/schema/body-rules.js`, `src/cli/validate.js`, the 6 `canonical.md`, their regenerated `SKILL.md`, `test/schema.test.js`, `test/skill-contract.test.js`, `test/validate.cli.test.js`) is within `## Impacted modules` or is test coverage; nothing outside `## Constraints and non-goals`.
- [passed] Principle 1 — `SKILL.md` changed only via `npm run generate` (no drift, no hand edits).
- [passed] Conventions — ESM, `node --test`, why-only comments, no `process.exit` in modules; `validateVerificationBody` mirrors `validateProposalBody`/`validateDesignBody` (Constraint satisfied); layer boundaries respected (`src/schema/` body-rules + `src/cli/` wiring).
- [passed] Real commands — the playbooks now instruct `playbook changed-files --diff` and `playbook spec-read`, both registered in `src/cli/dispatch.js` and runnable (closes the "0 invocations" objective).

## Issues found

### Issue 1 — AC-4/EC-1/EC-2/SEC-1 lacked CLI-level (`playbook validate`) test coverage — RESOLVED
- **File**: `test/validate.cli.test.js` (three cases added).
- **Problem (first pass)**: AC-4, EC-1, EC-2 and SEC-1 are phrased against the `playbook validate` **command**, but the only automated evidence was `validateVerificationBody` in isolation. The wiring (`verification-report.md` ∈ `ARTIFACT_FILES` → `BODY_VALIDATORS` → `EXIT.VIOLATION`) had no regression guard, while the repo already tested the identical path for proposals at `test/validate.cli.test.js:118`. Because SEC-1's entire purpose is that the security thread cannot silently re-disconnect, an untested wire was the exact failure mode.
- **Resolution**: Added `VALID_VERIFICATION` fixture + three e2e cases to `test/validate.cli.test.js`: (a) missing `## Security considerations` → exit `VIOLATION`, error names the section; (b) empty section → exit `VIOLATION` with `empty content`; (c) complete report → exit `OK`. No production code changed. `npm test` green (348 assertions).

## Notes (non-blocking)

- `context-packet.md` validates cleanly: `playbook validate wire-token-and-security-policy` → all 6 artifacts valid. Its source hashes are fresh and its copied sections (AC / constraints / security) match the unchanged live `proposal.md` — no packet-vs-source discrepancy. (The packet does go stale whenever `tasks.md` changes, since it hashes the whole file; it was refreshed after the apply edits.)
- Minor DRY: `validateVerificationBody` duplicates the loop of `validateDesignBody`. **Not** an issue — the pre-existing `validateProposalBody`/`validateDesignBody` share the same duplication, and the proposal's Constraint explicitly asks `validateVerificationBody` to follow that same pattern. Refactoring would be out-of-scope.
