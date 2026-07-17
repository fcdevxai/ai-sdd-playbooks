---
schema: proposal
schema_version: 1
change_id: doctor-doc-staleness
title: "sdd doctor — warn when the project workflow doc predates the methodology"
status: approved
owner: felipe.campos
created: 2026-07-16
updated: 2026-07-16
delivery:
  provider: github
impact:
  public_contract: true          # adds a new advisory tier to `sdd doctor` output
  data_model: false
  architecture_boundary: false
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: low
  triggers: []
---

# sdd doctor — warn when the project workflow doc predates the methodology

## Objective

Close a real gap found in practice: the methodology lives **globally and is
versioned** (the skills + `sdd.lock` range), but each project keeps its own
**copy** of `docs/sdd-workflow.md`. `sdd init` never overwrites it (`copyIfMissing`
— correct, non-destructive), so a project that already had a `sdd-workflow.md`
from an older methodology keeps a **stale** copy that silently misdescribes the
installed methodology. Make `sdd doctor` **detect and warn** about this, without
breaking anything.

## Background

Observed on a real project (`liacopilot/app`): after installing methodology 3.0
and running `sdd init`, the project's pre-existing `docs/sdd-workflow.md` (dated
before the install) still described the 1.x/2.x flow — `sdd-ff`, separate
`sdd-ux-gate`/`sdd-e2e-gate`, `READY FOR PR` verdict strings — all removed in 3.0.
The engine (`sdd next`) still works (it reads the global skills, not the doc), but
a human or agent reading the doc is misled. Nothing currently flags this.

## Scope

**Add — a staleness check in `sdd doctor`**

- `sdd doctor` reads the project's **`workflow`** logical document (default
  `docs/sdd-workflow.md`, honoring `documents:` config) and warns when it
  **predates the installed methodology**.
- Detection is **deterministic**, via a version marker: the shipped
  `templates/project/docs/sdd-workflow.md` carries a machine-readable methodology
  marker; `doctor` compares the project doc's marked major version against the
  installed methodology's major version (from the `.sdd-version` stamp). Missing
  marker or older major → warn. (Design picks the exact marker + optional
  retired-term reinforcement.)
- The warning names the fix: *refresh it with `sdd-bootstrap-project`*.

**Add — a `warnings` tier to `doctor` output**

- Warnings are **advisory**: they appear in text + `--json`, but **do not** change
  the exit code (a project whose only issue is a stale doc stays healthy/exit 0).
  This keeps `sdd doctor` usable as a CI gate without failing on advisory staleness.

**Add — the marker to the shipped template**

- `templates/project/docs/sdd-workflow.md` gains the methodology-version marker so
  freshly-scaffolded docs are correctly recognized as current.

**Out of scope (non-goals)**

- No auto-fix/overwrite of the project doc (`--fix` stays additive-only; refreshing
  a doc is `sdd-bootstrap-project`'s diff-then-approve job, never a silent rewrite).
- No change to the lifecycle engine, `sdd next`, schemas, or the other documents.
- Not changing `copyIfMissing` (never-overwrite stays — it is correct).

## Acceptance criteria

- **AC-01** With methodology `3.x` installed and a project `workflow` doc that predates it (older/missing marker, e.g. references `sdd-ff`/`sdd-ux-gate`/`sdd-e2e-gate`), `sdd doctor` emits a **warning** that names the doc and points to `sdd-bootstrap-project` — in both text and `--json`.
- **AC-02** The staleness warning is **advisory**: when it is the only finding, `sdd doctor` still reports healthy and exits **0** (`EXIT.OK`). Real `problems` keep exiting `ENVIRONMENT` as today.
- **AC-03** A freshly `sdd init`-scaffolded project (whose `sdd-workflow.md` comes from the current 3.0 template with the marker) produces **no** staleness warning.
- **AC-04** `--json` output gains a `warnings` array; existing `problems`/`fixes`/`notes` fields and their semantics are unchanged.
- **AC-05** The shipped `templates/project/docs/sdd-workflow.md` carries the methodology-version marker; `no-legacy-refs` and the full suite stay green.

## Risks

- **R-01 — False positives.** A project that legitimately renamed/repointed its workflow doc could be flagged. *Mitigation:* the check keys on a deterministic version marker (not fuzzy prose); a doc marked at the current major is never flagged.
- **R-02 — Exit-code regression.** If staleness were a `problem`, `sdd doctor` would start failing (breaking CI). *Mitigation:* AC-02 — warnings never change the exit code; covered by a test.
- **R-03 — Marker churn.** Hardcoding a version could drift from `package.json`. *Mitigation:* compare against the installed `.sdd-version` major, not a second hardcoded constant.

## Design

`design_required` is **true** (public-contract: new `doctor` output tier). See
`design.md` for the marker format, the comparison rule, the `warnings` wiring, and
the test plan.

## Open technical decisions

- Marker format (frontmatter field vs HTML comment) and whether to also ship a
  small retired-term reinforcement list — resolved in `design.md`.
