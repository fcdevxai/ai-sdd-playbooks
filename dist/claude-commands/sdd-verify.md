# /sdd-verify — SDD Verify - Post-Merge Acceptance Verification

## Usage

```
/sdd-verify [ticket-slug]
```

## When to run

Despues de que el PR fue aprobado y mergeado en main. Antes de `/sdd-archive`.

## Purpose

After PR merge, confirm every acceptance criterion in `proposal.md` has passing evidence (tests/checks) in the current codebase. Detect regressions. Generate a `verification-report.md` that gates `sdd-archive`.

Run this after merge and before `sdd-archive`.

## Context

Read before verifying:

1. `openspec/changes/[ticket-slug]/proposal.md` - full list of acceptance criteria and error cases
2. `openspec/changes/[ticket-slug]/testing-report.md` - tests/checks generated during `sdd-apply`
3. `docs/doc_verification_guide.md` - project-specific verification commands

## Behavior

### 1. Run feature-level verification

Run the project command(s) that validate the affected feature/domain (from `docs/doc_verification_guide.md`).

### 2. Map criteria to evidence

For each acceptance criterion in `proposal.md`:

- Identify the test/check covering it.
- Confirm the test/check passes in current code.
- If no evidence covers a criterion -> mark as gap.

### 3. Verify error cases

For each error case in `proposal.md`, confirm there is passing evidence for the failure path.

### 4. Regression check

Run the required regression command(s) from `docs/doc_verification_guide.md` and confirm no blocking failures.

### 5. Generate verification-report.md

````markdown
# Verification Report - [Feature name]

**Ticket**: [ticket-slug]
**Verification date**: [YYYY-MM-DD]
**Merged branch**: [branch-name]

## Acceptance criteria

| # | Criterion | Test/Check | Result |
|---|---|---|---|
| 1 | [criterion from proposal.md] | `[test/check reference]` | PASS |

## Error cases verified

| # | Error case | Test/Check | Result |
|---|---|---|---|
| 1 | [error case from proposal.md] | `[test/check reference]` | PASS |

## Regression status

**Result**: `[summary of regression command output]`

---

## Verdict

FEATURE VERIFIED / GAPS DETECTED

[If GAPS DETECTED: list criteria or checks missing/pending]
````

## Output

`openspec/changes/[ticket-slug]/verification-report.md` with verdict `FEATURE VERIFIED` or `GAPS DETECTED`.

## Rules

- Any acceptance criterion without passing evidence -> verdict must be `GAPS DETECTED`.
- Any blocking regression -> verdict must be `GAPS DETECTED`.
- Never proceed to `sdd-archive` if verdict is `GAPS DETECTED`.
