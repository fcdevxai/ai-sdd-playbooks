---
schema: design
schema_version: 1
change_id: doctor-doc-staleness
title: "sdd doctor doc-staleness — design"
status: draft
owner: felipe.campos
created: 2026-07-16
updated: 2026-07-16
depends_on: proposal.md
security:
  risk: low
  threat_model_required: false
  controls: []
---

# sdd doctor doc-staleness — design

Technical contract for `proposal.md`. Additive, read-only: a new advisory check +
`warnings` tier in `sdd doctor`, and a version marker on the shipped workflow
template. No engine/schema/CLI-surface change.

## 1. Version marker (shipped template)

`templates/project/docs/sdd-workflow.md` gains, as its **first line**, an HTML
comment marker (invisible in rendered Markdown, greppable, mirrors the
`CODEGRAPH_START/END` managed-block precedent):

```
<!-- sdd-methodology: 3.0 -->
```

- Value = the methodology **major.minor** at authoring time; only the **major** is
  used for comparison. HTML comment (not YAML frontmatter) so the doc stays a plain
  human doc with no schema coupling.
- No retired-term denylist — marker presence/major is the single deterministic
  signal (an unmarked doc is treated as pre-marker → stale). Keeps false positives
  near zero and avoids a second maintenance list.

## 2. Detection (pure, testable)

New pure helper in `src/cli/doctor.js` (exported for unit tests):

```js
export function workflowStaleness({ cwd, config, installed }) → string | null
```

Logic:
1. If `installed` is null → return null (the "no methodology installed" problem already covers it; nothing to compare).
2. Resolve the `workflow` doc path via `resolveDocument(config, 'workflow')`.
3. If the file does not exist → return null (the existing "missing document" problem already covers it — staleness is only for a doc that *exists*).
4. Read the file; extract the marker with `/<!--\s*sdd-methodology:\s*([\d.]+)\s*-->/`.
5. Compute `installedMajor = parseInt(installed.split('.')[0], 10)` and, if a marker was found, `docMajor = parseInt(marker.split('.')[0], 10)`.
6. Return a warning string when **marker missing** or **docMajor < installedMajor**; otherwise null. (`docMajor >= installedMajor` → not stale; a doc newer than the installed methodology is not "stale" and is not flagged.)

Warning messages:
- missing marker → `` `docs/sdd-workflow.md` has no methodology-version marker; it may predate methodology 3.x — refresh it with the `sdd-bootstrap-project` skill ``
- older major → `` `docs/sdd-workflow.md` predates the installed methodology (doc: 2.x, installed: 3.x) — refresh it with the `sdd-bootstrap-project` skill ``

(The concrete path in the message is the resolved path, not hardcoded.)

## 3. `warnings` tier wiring

In `doctorCommand`:
- add `const warnings = [];`
- after the documents block, `const w = workflowStaleness({ cwd, config, installed }); if (w) warnings.push(w);`
- `healthy` stays `problems.length === 0` — **warnings do not affect it** (AC-02), so the exit code is unchanged (`EXIT.OK` when no `problems`).
- **JSON**: add `warnings` to the payload (`{ command, healthy, problems, warnings, fixes, notes }`). Existing fields unchanged (AC-04).
- **Text**: after the `✓ healthy` / problems lines, print each warning as `  ⚠ <text>` (a new, visually distinct prefix; problems keep `✗`, notes keep `note:`).

## 4. Scope of the check

Only the **`workflow`** logical doc is checked — it is the one that describes
**methodology behavior** (and thus goes stale on a methodology upgrade). The other
consumer docs (`agent_architecture`, `doc_architecture`, `doc_verification_guide`)
are **project-specific content**, not methodology-versioned, so they are out of
scope and never flagged.

## 5. Test plan

- **`test/doctor.test.js`**:
  - stale doc (no marker, or `<!-- sdd-methodology: 2.0 -->`) + installed `3.0.0` → `warnings` contains the staleness message; `healthy === true`; exit `EXIT.OK` (AC-01, AC-02).
  - current marker (`<!-- sdd-methodology: 3.0 -->`) + installed `3.0.0` → no staleness warning (AC-03).
  - `--json` payload has a `warnings` array; `problems`/`fixes`/`notes` still present (AC-04).
  - a real `sdd init` scaffold (via `initRepo()`) → its `sdd-workflow.md` carries the marker → no staleness warning (guards AC-03 end-to-end; also confirms no regression in the existing "healthy" doctor tests).
- **Unit** (optional): call `workflowStaleness(...)` directly for the null cases (no install, missing doc, doc newer).
- **`test/no-legacy-refs.test.js`**: unaffected — the marker string carries no forbidden term.

## 6. Traceability

| AC | Design section |
|---|---|
| AC-01 | §2, §3 |
| AC-02 | §3 |
| AC-03 | §1, §5 |
| AC-04 | §3 |
| AC-05 | §1, §5 |
