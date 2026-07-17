---
schema: tasks
schema_version: 1
change_id: doctor-doc-staleness
title: "sdd doctor doc-staleness — tasks"
status: ready
owner: felipe.campos
created: 2026-07-16
updated: 2026-07-16
depends_on: design.md
---

# sdd doctor doc-staleness — tasks

**Spec**: `proposal.md` · **Design**: `design.md`

> **Execution gate.** `proposal.md` and `design.md` are **approved** (2026-07-16).
> One phase per commit; each stops for human review and leaves the suite green.

## Phase 1 — Marker + staleness check + warnings tier
*Goal: doctor detects a stale workflow doc, advisory only.* — **AC-01, AC-02, AC-04, AC-05** · design §1–§3

- [x] **T1.1** Added the marker as the first line of `templates/project/docs/sdd-workflow.md`: `<!-- sdd-methodology: 3.0 -->`. ✓
- [x] **T1.2** `src/cli/doctor.js`: added exported pure helper `workflowStaleness({ cwd, config, installed })` — null when no methodology installed or doc absent; warns on missing marker or older major (compared to the installed `.sdd-version` major); resolved path in the message; points to `sdd-bootstrap-project`. ✓
- [x] **T1.3** Wired the `warnings` tier: `healthy` stays `problems.length === 0` (advisory), `warnings` added to `--json`, printed as `⚠` in text. ✓ Manual check: stale doc → `⚠` + `✓ healthy` + exit 0; `--json` carries `warnings`. Suite 167/167 (no regression).

## Phase 2 — Tests + verification sweep
*Goal: behavior proven, exit-code contract protected, suite green.* — **AC-01…AC-05** · design §5

- [x] **T2.1** `test/doctor.test.js`: added (a) stale-doc (marker stripped) + installed `3.0.0` → `warnings` has the message + points to `sdd-bootstrap-project`, `healthy === true`, exit `EXIT.OK`; (b) current `3.0` marker → no staleness warning (`--json` `warnings` array present); (c) two pure `workflowStaleness()` unit tests (null: no-install/missing/current/newer; warns: older-major/missing-marker). ✓
- [x] **T2.2** No regression: existing `initRepo()`-based doctor tests green (scaffolded doc now has the marker). Full `node --test` **171/171**; `no-legacy-refs` green; the marker ships in `templates/project/docs/sdd-workflow.md`. ✓

---

## Phase → acceptance-criteria coverage

| Phase | ACs |
|---|---|
| 1 | AC-01, AC-02, AC-04, AC-05 |
| 2 | AC-01…AC-05 (proof + sweep) |
