---
name: sdd-verify
description: "After the PR is merged, verify every acceptance criterion in the proposal has passing tests/checks in the current codebase, check regressions, and write verification-report.md with a normalized passed/failed status. Activate when the user says 'sdd-verify', 'verify acceptance criteria', or 'post-merge verification'. Requires agent mode with terminal access. Triggers: verifica criterios, valida post merge."
description_es: "Tras el merge del PR, verificar que cada criterio de aceptación de la proposal tenga tests/checks que pasen en el código actual, revisar regresiones y generar verification-report.md con status normalizado."
title_en: "SDD Verify — Post-Merge Verification"
title_es: "SDD Verify — Verificación Post-Merge"
when: "After the PR is merged (delivery: merged). Before sdd-archive."
output_file: "verification-report.md"
requires_terminal: true
lifecycle_stage: verify
produces: [verification-report.md]
requires:
  artifacts:
    runtime-gate-report.md: { status: [passed, not_applicable] }
version: 0.1.0
---

## Purpose

After merge, confirm every acceptance criterion in `proposal.md` has passing
evidence in the current codebase and detect regressions. Produce a schema-valid
`verification-report.md` that gates `sdd-archive`.

> Runs after the branch is **merged** (the CLI gates this on `delivery: merged`)
> and requires terminal access. For a multi-repo change, confirm the per-repo
> breakdown with `playbook status --json` (`delivery.per_repo`) — `merged` here
> is unanimous by construction, but re-check it: no impacted repo may be
> unmerged.

## Context

If `context-packet.md` exists, read it instead of `proposal.md`+`tasks.md` in
full for acceptance criteria and verification commands (verbatim copies). If
it doesn't exist, fall back to reading both in full. Also read
`docs/doc_verification_guide.md` (project verification commands), and run
commands through `playbook run --change <change-id> --step verify -- <command>`
for the same compacted-summary + full-log behavior `sdd-apply` uses.

## Behavior

1. Run the project's feature/domain verification command(s).
2. Map each acceptance criterion (`AC-N`) to a passing test/check; any uncovered
   criterion is a gap.
3. Confirm each error case (`EC-N`) has passing evidence for its failure path.
4. Run the required regression command(s); confirm no blocking failures.
5. Write `verification-report.md`:

```markdown
---
schema: verification-report
schema_version: 1
change_id: <change-id>
status: passed   # passed | failed
updated: <YYYY-MM-DD>
---
# Verification Report — <Feature name>

## Acceptance criteria
| # | Criterion | Test/Check | Result |
|---|---|---|---|
| AC-01 | <criterion> | `<reference>` | passed |

## Error cases
| # | Error case | Test/Check | Result |

## Regression
**Result**: <summary>
```

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any blocking regression → `status: failed`.
- Never proceed to `sdd-archive` while `status: failed`.
