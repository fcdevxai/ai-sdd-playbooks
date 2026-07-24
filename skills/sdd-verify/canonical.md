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
for the same compacted-summary + full-log behavior `sdd-apply` uses. Acceptance
criteria and verification commands come from the packet (or the full
`proposal.md`/`tasks.md`), never from `spec-read` — that command is confined to
`openspec/specs/**`. Use `playbook spec-read <file>#<anchor>` to read only the
relevant section of a permanent spec (e.g.
`openspec/specs/system.md#code-conventions`); if the anchor is absent, fall
back to full-read and report why. If you need a permanent-spec anchor you
don't know and `.specloom/index/spec-index.json` doesn't exist, run `playbook
spec-index` to build it, then `playbook spec-read
openspec/specs/<file>#<anchor>`. If `spec-index` or the lookup fails,
full-read the spec and report why.

## Behavior

1. **Verify `pwd` first** — never assume the cwd inherited from a previous step.
   Then run the project's feature/domain verification command(s).
2. Map each acceptance criterion (`AC-N`) to a passing test/check; any uncovered
   criterion is a gap.
3. Confirm each error case (`EC-N`) has passing evidence for its failure path.
4. **Re-run each `SEC-N`'s negative test against the merged code** (unauthorized
   access rejected, missing-section validation fails, …) — do **not** trust the
   pre-merge security report; confirm every declared control still holds in the
   post-merge state.
5. Verify `pwd` again before the regression command(s) — the cwd is not carried
   over from step 1, and commands from an older `tasks.md`/`context-packet.md` may
   assume a preceding `cd`. Then run them and confirm no blocking failures.
6. Write `verification-report.md`:

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

## Security considerations
| # | Control | Test/Check (negative, re-run post-merge) | Result |
|---|---|---|---|
| SEC-1 | <control> | `<negative test>` | passed |
<!-- No SEC-N declared in proposal.md? Write: Not applicable: <reason> -->

## Regression
**Result**: <summary>
```

`playbook validate` requires `## Acceptance criteria`, `## Security
considerations`, and `## Regression` in the report body — a report that drops the
security section fails validation (SEC-1 enforcement).

## Rules

- Any acceptance criterion without passing evidence → `status: failed`.
- Any `SEC-N` without passing post-merge evidence → `status: failed`.
- Any blocking regression → `status: failed`.
- Never proceed to `sdd-archive` while `status: failed`.
- Before running any command from `tasks.md`/`context-packet.md`, verify `pwd`
  first — never assume the cwd inherited from a prior task or step.
