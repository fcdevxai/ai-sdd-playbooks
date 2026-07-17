---
schema: tasks
schema_version: 1
change_id: runtime-gate-change-relevance
title: "Runtime gate: per-change capability relevance — tasks"
status: ready
owner: felipe.campos
created: 2026-07-16
updated: 2026-07-16
depends_on: design.md
---

# Runtime gate: per-change capability relevance — tasks

**Spec**: `proposal.md` · **Design**: `design.md`

> **Execution gate.** `proposal.md` and `design.md` are **approved** (2026-07-16).
> One phase per commit; each stops for human review and leaves the suite green.

## Phase 1 — Schema + `planRuntimeAdapters` + reason code
*Goal: the pure logic change lands, fully backward compatible, proven in isolation.* — **AC-01, AC-02, AC-03, AC-04, AC-07** · design §1, §2, §8

- [x] **T1.1** `schemas/proposal.schema.json`: added optional `runtime_relevant_capabilities` (array, `enum: [browser, http, cli, worker]`). No `required` change. ✓
- [x] **T1.2** `src/adapters/index.js`: added `REASON_CODES.NOT_RELEVANT_TO_CHANGE`; `planRuntimeAdapters(capabilities, relevantCapabilities = null)` per design §2 (excluded-but-enabled capability checked before the experimental/supported branch). ✓
- [x] **T1.3** Tests added: `test/adapters.test.js` — no-second-arg byte-identical (both `null` and `undefined`); excludes experimental (`worker`) → `not_applicable`/`NOT_RELEVANT_TO_CHANGE` while an *included* experimental (`cli`) keeps `blocked`/`ADAPTER_NOT_IMPLEMENTED`; excludes supported (`http`) → `not_applicable`, not `pending`; a `false` capability is unaffected by exclusion (no reason_code); and an end-to-end demo that a `worker:true` project excluding it can reach gate `passed` once evidence is gathered. `test/schema.test.js` — valid capability accepted, unknown one (`queue`) rejected, and omitting the field entirely still validates. ✓
- [x] **T1.4** Full `node --test` green: **179/179** (+7 new tests). ✓

## Phase 2 — `sdd-new` proposes it, `sdd-runtime-gate` honors it
*Goal: the two skills that author/consume the field are updated.* — **AC-05** · design §3, §4

- [ ] **T2.1** `skills/sdd-new/SKILL.md`: add `runtime_relevant_capabilities` to the proposal template (step 3), with the propose-from-signals / omit-when-unsure instruction (design §3).
- [ ] **T2.2** `skills/sdd-runtime-gate/SKILL.md`: add the "read `runtime_relevant_capabilities` if present" instruction before the adapter-selection table; add the new table row (excluded → `not_applicable`/`NOT_RELEVANT_TO_CHANGE`); add the Rules bullet (design §4).
- [ ] **T2.3** `test/skill-contract.test.js`: assert `sdd-new` body mentions `runtime_relevant_capabilities`; assert `sdd-runtime-gate` body mentions `NOT_RELEVANT_TO_CHANGE` and the omit/absent-field rule.
- [ ] **T2.4** Full `node --test` green.

## Phase 3 — Validate cross-check + README + verification sweep
*Goal: the honor-system gap closes, the guarantee is documented, everything proven end-to-end.* — **AC-06, AC-08** · design §5, §6, §7

- [ ] **T3.1** `src/cli/validate.js`: add the cross-artifact check (design §5) — only when the proposal's `runtime_relevant_capabilities` is present, an excluded-but-enabled capability's adapter status in `runtime-gate-report.md` must be `not_applicable`; otherwise a validation error naming the capability.
- [ ] **T3.2** `test/validate.cli.test.js`: excluded capability reported as `blocked` → validate error; reported as `not_applicable` → valid; proposal without the field at all → no new check fires (AC-08 proof).
- [ ] **T3.3** README: add the summarized "Per-change runtime relevance" subsection near "Capability model" (design §6), including the no-auto-reconfiguration guarantee in one sentence.
- [ ] **T3.4** Verification sweep: full `node --test` green; `sdd validate` on this repo's own changes still green; manually construct a fixture project with `worker: true` + a proposal excluding it → confirm `runtime_cleared` is reachable; confirm a fixture with `worker` included still blocks exactly as before.

---

## Phase → acceptance-criteria coverage

| Phase | ACs |
|---|---|
| 1 | AC-01, AC-02, AC-03, AC-04, AC-07 |
| 2 | AC-05 |
| 3 | AC-06, AC-08, AC-07 (sweep) |
