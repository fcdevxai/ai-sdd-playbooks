---
name: sdd-verify
description: Verify that all acceptance criteria in the spec have passing tests after the PR is merged. Run the feature test suite, map each criterion to its test, check for regressions, and generate verification-report.md. Activate when the user says "sdd-verify", "verify acceptance criteria", "post-merge verification", or asks to verify a merged feature before archiving. Requires Copilot agent mode with terminal access.
---

# SDD Verify — Post-Merge Acceptance Verification

## Purpose

After the PR is merged, confirm every acceptance criterion in `proposal.md` has a passing test in the current codebase. Detect regressions. Generate a `verification-report.md` that gates `sdd-archive`.

> **Requires Copilot agent mode** — this skill runs `php artisan test`.

Run this after PR merge and before `sdd-archive`.

---

## Context

Read before verifying:

1. `openspec/changes/[ticket-slug]/proposal.md` — full list of acceptance criteria and error cases
2. `openspec/changes/[ticket-slug]/testing-report.md` — tests generated during `sdd-apply`

---

## Behavior

### 1. Run feature tests

```bash
php artisan test --compact tests/Feature/
```

### 2. Map criteria to tests

For each acceptance criterion in `proposal.md`:

- Identify the test method covering it.
- Confirm the test passes.
- If no test covers a criterion → mark as **gap**.

### 3. Verify error cases

For each error case in `proposal.md`, confirm there is a passing test that exercises the failure path.

### 4. Regression check

```bash
php artisan test --compact
```

Confirm zero failures and zero errors across the full suite.

### 5. Generate verification-report.md

````markdown
# Verification Report — [Feature name]

**Ticket**: [ticket-slug]
**Verification date**: [YYYY-MM-DD]
**Merged branch**: [branch-name]

## Acceptance criteria

| # | Criterion | Test | Result |
|---|---|---|---|
| 1 | [criterion from proposal.md] | `tests/Feature/.../Test::method` | ✅ PASSES |

## Error cases verified

| # | Error case | Test | Result |
|---|---|---|---|
| 1 | [error case from proposal.md] | `tests/Feature/.../Test::method` | ✅ PASSES |

## Full test suite

**Result**: [X tests, 0 failures, 0 errors]

---

## Verdict

✅ **FEATURE VERIFIED** — all acceptance criteria have passing tests.
Proceed with `sdd-archive [ticket-slug]`.

---
OR:

❌ **GAPS DETECTED** — the following criteria have no covering test:
- Criterion #N: [description]

Resolve gaps before running `sdd-archive`.
````

---

## Output

`openspec/changes/[ticket-slug]/verification-report.md` with verdict `✅ FEATURE VERIFIED` or `❌ GAPS DETECTED`.

---

## Rules

- Any acceptance criterion without a passing test → verdict must be `❌ GAPS DETECTED`.
- Any regression in the full test suite → verdict must be `❌ GAPS DETECTED`.
- Never proceed to `sdd-archive` if verdict is `❌ GAPS DETECTED`.
