---
schema: tasks
schema_version: 1
change_id: bootstrap-repos-diff-on-rerun
status: passed
updated: 2026-07-23
---
# Tasks — Detectar repos hermanos nuevos en re-ejecuciones de sdd-bootstrap-project

## Rules

- Every task must have a verifiable success criterion; never mix unrelated layers
  in one task if it makes verification non-atomic.
- Do not plan changes to files outside `## Constraints and non-goals`.
- State inter-task dependencies explicitly.
- Any task implementing a `## Security considerations` entry (`SEC-N`) must name
  its negative test as part of its success criterion, not only the happy path.
  (SEC-1 is "Not applicable" — no task below implements a negative security test.)

## Preconditions (self-check)

`proposal.status == approved` ✓ (confirmed via `playbook validate
bootstrap-repos-diff-on-rerun`). `design_required: false` (per `playbook
status`) → no `design.md` gate applies.

## Phase 1 — Core implementation

### Task 1.1 — Add the re-run instruction to canonical.md paso 3 [x]
- **Files**: `skills/sdd-bootstrap-project/canonical.md`
- **Success criterion**: Paso 3 contains an explicit instruction that, on every
  run — including re-runs where `repos:` already has entries — the skill
  re-invokes `detectSiblingRepos` and diffs its output against the repos
  already listed in `playbook.config.yaml`, presenting only the candidates
  not already there. The paragraph explicitly states that a populated
  `repos:` block is never, by itself, a reason to skip re-detection.
  Verified by reading the edited section back.
- **Linked acceptance criterion**: AC-1, AC-2

### Task 1.2 — Regenerate SKILL.md [x]
- **Files**: `skills/sdd-bootstrap-project/SKILL.md` (generated, not
  hand-edited)
- **Success criterion**: `npm run generate` completes; `npm run
  generate:check` reports no drift between `canonical.md` and `SKILL.md`.
- **Linked acceptance criterion**: AC-3, AC-5
- **Depends on**: Task 1.1

### Task 1.3 — Add a content assertion to skill-contract.test.js [x]
- **Files**: `test/skill-contract.test.js`
- **Success criterion**: New test in the existing "sdd-bootstrap-project
  proposes multi-repo topology" area asserts the `SKILL.md` body matches the
  re-run/diff instruction (e.g. a phrase confirming "re-invoke"/"re-run" the
  detector and that an already-populated `repos:` never causes the step to be
  skipped). `node --test test/skill-contract.test.js` passes with the new
  assertion, and fails if Task 1.1's paragraph is reverted (confirmed by
  temporarily reverting `canonical.md`+`SKILL.md` locally and re-running the
  test, then restoring them).
- **Linked acceptance criterion**: AC-4
- **Depends on**: Task 1.2

## Phase 2 — Quality gates

- **Format**: sin formatter configurado (ver `docs/doc_verification_guide.md`) — n/a.
- **Lint/type-check**: `node --check skills/sdd-bootstrap-project/canonical.md` no aplica (no es JS); `node --check src/generator/generate-skills.js` (archivo tocado indirectamente, no editado — solo ejecutado).
- **Feature tests**: `node --test test/skill-contract.test.js`
- **Regression**: `npm test` (riesgo `standard`, sin `triggers` de seguridad — no requiere regresión ampliada más allá de la suite completa)
- **Drift check**: `npm run generate:check`

## Execution Report

**Approach**: TDD — the failing assertion (Task 1.3's content) was written
into `test/skill-contract.test.js` first and confirmed red against the
unmodified `SKILL.md`, before `canonical.md` (Task 1.1) was edited and
`SKILL.md` regenerated (Task 1.2). All three tasks landed as one coherent
diff; task numbers reflect the plan's file-scope breakdown, not literal
chronological order.

| AC | Evidence |
|---|---|
| AC-1 | `skills/sdd-bootstrap-project/canonical.md` paso 3 new paragraph: "On a re-run, `repos:` already having entries is never a reason to skip this step... Always re-invoke it, diff its output against the repos already confirmed..." |
| AC-2 | Same paragraph, explicit: "does not read a populated `repos:` block as 'topology already resolved'". |
| AC-3 | `npm run generate` + `npm run generate:check` → no drift (`.specloom/runs/1784838190885-2866bac3/full.log`). |
| AC-4 | New test `sdd-bootstrap-project re-invokes the sibling detector on re-run...` in `test/skill-contract.test.js`; confirmed red (1 fail / 26 pass) before the canonical.md edit, green (27/27) after. |
| AC-5 | Same `generate:check` run as AC-3. |

**Commands run** (all via `playbook run --change bootstrap-repos-diff-on-rerun --step apply --`):
- `npm run generate` → passed
- `npm run generate:check` → passed (no drift)
- `node --test test/skill-contract.test.js` → passed, 27/27 (was 26/27 before the fix)
- `node --check test/skill-contract.test.js` → passed
- `npm test` → passed, 326/326
- `npm run generate:check` (final, post-full-suite) → passed

**Scope check**: `git status --short` shows exactly the 3 files declared in
`proposal.md`'s `## Impacted modules` (`skills/sdd-bootstrap-project/canonical.md`,
`skills/sdd-bootstrap-project/SKILL.md`, `test/skill-contract.test.js`) plus the
new `openspec/changes/bootstrap-repos-diff-on-rerun/` folder. Nothing outside
`## Constraints and non-goals` was touched — `src/config/detect-siblings.js`
and `detect-siblings.test.js` are unmodified.

**Security**: SEC-1 ("Not applicable") — no negative security test applies;
no task touched auth, secrets, or user data.

**ADR**: no new STOP arose during implementation; `adr-stateful-rerun-diff-baseline.md`
(created at `sdd-new` time) covers the only hard-to-reverse decision in this
change and needed no revision.
