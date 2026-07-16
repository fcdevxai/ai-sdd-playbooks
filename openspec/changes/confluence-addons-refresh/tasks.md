---
schema: tasks
schema_version: 1
change_id: confluence-addons-refresh
title: "Confluence add-ons refresh — tasks"
status: ready
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
depends_on: design.md
---

# Confluence add-ons refresh — tasks

**Spec**: `proposal.md` · **Design**: `design.md`

> **Execution gate.** `proposal.md` and `design.md` are **approved** (2026-07-15).
> One phase per commit; each stops for human review and leaves the suite green.

Each add-on keeps the 3.0 SKILL.md contract (§1): English frontmatter + body,
`version: 3.0.0`, `addon: confluence`, conversational activation.

## Phase 1 — Refresh `document-code`
*Goal: restore the AS-IS multi-page documenter's real depth.* — **AC-01, AC-02, AC-04**

- [x] **T1.1** Rewrote `addons/confluence/document-code/SKILL.md` on the owner's **proven action model** (`AskUserQuestion` → **new page / update page / new subpage / update subpage / batch**): actions 1–4 are single-resource; the multi-page machinery (node graph, discover-or-create-then-link, `LAYER_CHAIN`, **two-pass** linking) lives **only in batch** (a controller's full cycle or all entities). Added `getConfluencePage` → `version + 1` on every update branch (completeness fix). Preserved per-type templates, impact appendix, AS-IS rule, CQL (not `getConfluenceSpaces`). `version` → `3.0.0`; conversational activation. ✓ *(Corrects an earlier draft that wrongly used a "full cycle / single / batch" selector — design §2 updated to match.)*
- [x] **T1.2** Full `node --test` green (167/167); `document-code` lints clean at `3.0.0`; no forbidden term. ✓

## Phase 2 — Refresh `write-in-confluence`
*Goal: restore the operational-guide writer's real depth.* — **AC-01, AC-02, AC-04**

- [ ] **T2.1** Rewrite `addons/confluence/write-in-confluence/SKILL.md` body from the source spec, preserving: audience (Operations/Support, not IT), the two-questions-in-one-message intake, the `[CAPTURA: …]` screenshot flow + manual-upload note, CQL space listing (not `getConfluenceSpaces`), create-vs-update (`version + 1`), the standard document structure, and the **Spanish-voseo output** rule (explicit body rule; the skill file stays English). Bump `version` → `3.0.0`. Conversational activation.
- [ ] **T2.2** Full `node --test` green.

## Phase 3 — Add `code-audit-comment` + narrow the guard
*Goal: the new auditor lands, and the guard stops false-positiving.* — **AC-03, AC-05, AC-06**

- [ ] **T3.1** New `addons/confluence/code-audit-comment/SKILL.md` (§4): purpose + the two guiding principles (never assume / confirm exact content per-comment), the step flow, the **Reuse/Deprecate/Improve/Pending** classification, the `textSelection` **plain-text** gotcha, blocking criteria (MCP down / unresolved code file), report format, and "what it does NOT replace". `version: 3.0.0`, `addon: confluence`, conversational activation.
- [ ] **T3.2** Narrow `test/no-legacy-refs.test.js`: drop `/deprecat/i` from `FORBIDDEN` (keep `/sdd-ff/`, `/\b1.x\b/`, path patterns). Add a one-line comment on why.
- [ ] **T3.3** `test/skill-contract.test.js`: the add-on names assertion → `['code-audit-comment', 'document-code', 'write-in-confluence']`. Full suite green (all three land together so the count/lint/guard stay consistent).

## Phase 4 — Verification sweep
*Goal: three add-ons, installable, lint-clean, guard intact.* — **AC-01…AC-06**

- [ ] **T4.1** Full `node --test` green; the three add-ons lint clean at `version: 3.0.0`.
- [ ] **T4.2** `sdd install --addon confluence` (into a redirected global dir) installs **three** add-on skills; a core `sdd install` (no `--addon`) installs **none** of them.
- [ ] **T4.3** Grep the three bodies: no `/command`/`@skill` invocation wording, no `sdd-ff`/`1.x`/removed-path terms; the `no-legacy-refs` guard is green with the new "Deprecate" vocabulary present.
- [ ] **T4.4** `npm pack --dry-run` ships `addons/confluence/{code-audit-comment,document-code,write-in-confluence}/SKILL.md`.

---

## Phase → acceptance-criteria coverage

| Phase | ACs |
|---|---|
| 1 | AC-01, AC-02, AC-04 |
| 2 | AC-01, AC-02, AC-04 |
| 3 | AC-03, AC-05, AC-06 |
| 4 | AC-01…AC-06 (sweep) |
