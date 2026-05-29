---
name: sdd-verify
description: Verify that all acceptance criteria in the spec have passing tests after the PR is merged. Run the feature test suite, map each criterion to its test, check for regressions, and generate verification-report.md. Activate when the user says "sdd-verify", "verify acceptance criteria", "post-merge verification", or asks to verify a merged feature before archiving. Requires Copilot agent mode with terminal access.
---

# SDD Verify — Post-Merge Acceptance Verification

## Purpose

Verify all acceptance criteria have passing tests in the merged state. Map each criterion to its test, run the full test suite, and confirm no regressions were introduced.

> **Requires Copilot agent mode** — this skill runs `php artisan test`.

Do not archive without a `✅ FEATURE VERIFIED` verdict.

---

## Context

Read before verifying:

1. `openspec/changes/[ticket-slug]/proposal.md` — full list of acceptance criteria
2. `openspec/changes/[ticket-slug]/testing-report.md` — tests from the `/apply` cycle
3. The current state of the merged codebase

---

## Behavior

### 1. Read the acceptance criteria

List all criteria from `proposal.md` §Acceptance criteria and §Error cases.

### 2. Map criteria to tests

For each criterion:
- Identify the test file and method that covers it
- If no test covers a criterion, flag it as a gap

### 3. Run the feature test suite

```bash
php artisan test --compact tests/Feature/[Domain]/
```

Confirm all mapped tests pass.

### 4. Check for regressions

```bash
php artisan test --compact
```

Confirm the full suite passes. Report any new failures not present before this feature.

### 5. Generate verification-report.md

```markdown
# Verification Report — [Feature name]

**Ticket**: [ticket-slug]
**Verification date**: [YYYY-MM-DD]
**Merged branch**: [branch]

---

## Output

`openspec/changes/[ticket-slug]/verification-report.md` with verdict `✅ FEATURE VERIFIED` or `❌ GAPS DETECTED`.

---

## Rules

- Always run the full test suite — do not skip the regression check.
- A criterion with a failing or missing test must produce verdict `❌ GAPS DETECTED`.
- Do not archive without `✅ FEATURE VERIFIED`.
