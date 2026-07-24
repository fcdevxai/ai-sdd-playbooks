---
name: sdd-code-review
description: >-
  Review implemented code against the proposal before opening a PR: validate
  spec coverage, scope compliance, and project conventions, then write
  code-review-report.md with a normalized passed/failed status. Activate when
  the user says 'sdd-code-review', 'review against spec', or 'pre-PR review'.
  Triggers: revisa contra la spec, validacion tecnica.
description_es: >-
  Revisar el código implementado contra la proposal antes de abrir un PR:
  cobertura de la spec, cumplimiento de scope y convenciones del proyecto,
  generando code-review-report.md con un status normalizado.
title_es: SDD Code Review — Revisión Técnica pre-PR
version: 0.1.0
lifecycle_stage: code-review
produces:
  - code-review-report.md
requires:
  artifacts:
    tasks.md:
      status: passed
---
# SDD Code Review — Pre-PR Technical Review

**When to run:** After sdd-apply sets tasks.md status: passed. Before sdd-security-gate.

## Purpose

Review implemented code against `proposal.md` before human review. Catch spec
violations, scope creep, missing error handling, and convention issues. Produce a
schema-valid `code-review-report.md` with a **normalized status** (`passed` /
`failed`) — not a free-text verdict string.

This validates that the code implements the agreed criteria; it does not judge
whether the criteria themselves were correct (that is the human reviewer's job).

## Context

If `context-packet.md` exists, read it instead of `proposal.md`+`tasks.md` in
full — it carries acceptance criteria, constraints, security considerations,
files touched, and verification commands copied verbatim from those sources.
If it doesn't exist, fall back to reading both in full (no error, no warning).
If its content visibly contradicts the live `proposal.md`/`tasks.md` (edited
after the packet was generated), prefer the full sources and note the
discrepancy in the report.

Also read: `openspec/specs/system.md`, `docs/doc_architecture.md` /
`docs/doc_verification_guide.md`. To scope the changed files, run
`playbook changed-files <change-id> --diff` first; full-read a file only when the
diff touches authorization/ownership/input or is insufficient to judge. Use
`playbook spec-read <file>#<anchor>` to read only the relevant section of a spec;
if the anchor is absent, fall back to full-read and report why. If you need a
permanent-spec anchor you don't know and `.specloom/index/spec-index.json`
doesn't exist, run `playbook spec-index` to build it, then `playbook spec-read
openspec/specs/<file>#<anchor>`. If `spec-index` or the lookup fails, full-read
the spec and report why.

## Behavior

### 1. Checklist

- **Spec coverage**: every acceptance criterion (`AC-N`) has ≥1 passing
  test/check; every error case (`EC-N`) has explicit handling + evidence.
- **Scope**: no files changed outside `## Constraints and non-goals`; no
  out-of-spec features; contract changes intentional and documented.
- **Conventions**: naming/structure per `system.md`; layer boundaries per
  `docs/doc_architecture.md`; required quality commands were executed.

### 2. Write `code-review-report.md`

```markdown
---
schema: code-review-report
schema_version: 1
change_id: <change-id>
status: passed   # passed | failed
updated: <YYYY-MM-DD>
---
# Code Review Report — <Feature name>

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any file changed outside `## Constraints and non-goals` → `status: failed`.
- Any required quality gate not executed → `status: failed`.
- Do not suggest improvements outside spec scope.

## Checklist

- [passed/failed] AC-01 covered by `<test/check>`
- [passed/failed] No changes outside allowed modules
- [passed/failed] Conventions & quality gates respected

## Issues found

### Issue 1 — <title>
- **File**: `<path:line>`
- **Problem**: <why it violates spec/scope/convention>
- **Suggested fix**: <how to correct>
```

---

**Output file:** code-review-report.md
**Requires terminal:** no
