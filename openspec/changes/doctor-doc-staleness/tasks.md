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

- [ ] **T1.1** Add the version marker as the first line of `templates/project/docs/sdd-workflow.md`: `<!-- sdd-methodology: 3.0 -->`.
- [ ] **T1.2** `src/cli/doctor.js`: add exported pure helper `workflowStaleness({ cwd, config, installed })` → warning string | null (design §2): null when no methodology installed or the doc is absent; warn when the doc has no marker or a major older than the installed `.sdd-version`; resolved doc path in the message; points to `sdd-bootstrap-project`.
- [ ] **T1.3** Wire a `warnings` tier into `doctorCommand`: collect the staleness warning; `healthy` stays `problems.length === 0` (warnings never change the exit code); add `warnings` to the `--json` payload; print each as `⚠ <text>` in text mode.

## Phase 2 — Tests + verification sweep
*Goal: behavior proven, exit-code contract protected, suite green.* — **AC-01…AC-05** · design §5

- [ ] **T2.1** `test/doctor.test.js`: (a) stale doc (no marker / `2.0` marker) + installed `3.x` → `warnings` has the message, `healthy === true`, exit `EXIT.OK`; (b) current `3.0` marker → no staleness warning; (c) `--json` has a `warnings` array with `problems`/`fixes`/`notes` still present.
- [ ] **T2.2** Confirm no regression: the existing `initRepo()`-based doctor tests stay green (the scaffolded `sdd-workflow.md` now carries the marker → no false warning). Full `node --test` green; `no-legacy-refs` green.

---

## Phase → acceptance-criteria coverage

| Phase | ACs |
|---|---|
| 1 | AC-01, AC-02, AC-04, AC-05 |
| 2 | AC-01…AC-05 (proof + sweep) |
