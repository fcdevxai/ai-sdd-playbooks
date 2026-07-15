## Spec reference

- **Change**: `openspec/changes/<change-id>/`
- **Proposal**: `proposal.md` (`status: approved`)
- **Branch**: `<change-id>`

## Acceptance criteria verified

<!-- Copy the acceptance criteria from proposal.md; check the ones this PR satisfies -->

- [ ] AC-01 — <criterion>
- [ ] AC-02 — <criterion>

## Error cases covered

<!-- Copy the error cases from proposal.md -->

- [ ] <error case>

## SDD artifacts

- [ ] `sdd-enrich-us` run — requirement decision-closed
- [ ] `sdd-new` — `proposal.md` created; a human set `status: approved`
- [ ] `sdd-plan` — `tasks.md` (`status: ready`)
- [ ] `sdd-apply` — tasks implemented; Execution Report appended
- [ ] `sdd-code-review` — `code-review-report.md` (`status: passed`)
- [ ] `sdd validate` / `sdd next` green (the CLI — not a heading — decides state)

## Quality checks

<!-- Replace with your stack's commands -->

- [ ] `<test command>` passes
- [ ] `<lint/format command>` clean

## Out of scope

<!-- Anything not covered by the proposal? Explain and update proposal.md -->

None / <describe the change and note the updated spec>

## Human reviewer checklist

- [ ] The acceptance criteria in this PR match `proposal.md`
- [ ] No files outside the proposal's non-goals were touched
- [ ] The spec's error cases have explicit handling in the code
- [ ] Tests validate behavior, not just that the code runs
