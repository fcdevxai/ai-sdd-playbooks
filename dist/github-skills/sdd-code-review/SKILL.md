---
name: sdd-code-review
description: Review implemented code against the spec before opening a PR. Validate spec coverage, scope compliance, Laravel/React conventions, and generate code-review-report.md with a READY FOR PR or REQUIRES FIXES verdict. Activate when the user says "sdd-code-review", "review against spec", "pre-PR review", or asks to validate the implementation against the proposal.
---

# SDD Code Review — Automated Pre-PR Review

## Purpose

Review implemented code against the approved spec. Validate spec coverage, scope compliance, Laravel/React conventions, and generate `code-review-report.md` with a clear verdict.

This is an automated first-pass review that catches spec violations, convention errors, and scope drift before a human reviewer sees the code.

---

## Context

Read before reviewing:

1. `openspec/changes/[ticket-slug]/proposal.md` — acceptance criteria are the only success criteria
2. `openspec/changes/[ticket-slug]/testing-report.md` — understand which tests were generated
3. `openspec/changes/[ticket-slug]/tasks.md` — which files were created or modified
4. `openspec/specs/system.md` — naming conventions and layer rules
5. All implementation files listed in `tasks.md`

---

## Behavior

### 1. Read everything first

Read all files in context before starting the checklist. Never review partially.

### 2. Validate spec coverage

For each acceptance criterion in `proposal.md`:
- Identify which test covers it
- Verify the test actually exercises the stated behavior
- Flag any criterion without a corresponding test

For each error case in `proposal.md`:
- Verify there is explicit handling in the implementation
- Verify there is a test for the error case

### 3. Validate scope compliance

- List all files modified in the implementation
- Cross-reference with `## Constraints and non-goals` in `proposal.md`
- Flag any file touched that is outside the declared scope

### 4. Validate conventions

Check every new or modified PHP file:
- No business logic in controllers (controllers only handle HTTP transport)
- No inline query building in controllers (use Eloquent in models or services)
- Form Requests used for all validation
- Policies used for authorization
- Constructor property promotion in all new classes
- Explicit return types and parameter types on all new methods
- `#[Test]` attribute on all test methods (never `test_` prefix)
- No hardcoded URLs in TypeScript (Wayfinder used)

### 5. Produce verdict

**READY FOR PR** — all checklist items pass, no open issues.
**REQUIRES FIXES** — one or more items fail; list each issue with file, line, problem, and suggested fix.

### 6. Generate code-review-report.md

```markdown
# Code Review Report — [Feature name]

**Ticket**: [ticket-slug]
**Date**: [YYYY-MM-DD]
**Spec**: openspec/changes/[ticket-slug]/proposal.md

---

## Output

`openspec/changes/[ticket-slug]/code-review-report.md` with verdict `READY FOR PR` or `REQUIRES FIXES`.

---

## Rules

- Never issue `READY FOR PR` if any acceptance criterion lacks a test.
- Never issue `READY FOR PR` if any file outside scope was modified without justification.
- Read all implementation files completely before issuing a verdict — never review from memory.
- Report issues with file and line number, not vague descriptions.
