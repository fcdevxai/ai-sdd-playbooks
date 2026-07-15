---
schema: proposal
schema_version: 1
change_id: confluence-addons-refresh
title: "Confluence add-ons refresh + new code-audit-comment"
status: approved
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
delivery:
  provider: github
impact:
  public_contract: true         # changes the installable add-on skill surface (adds one, refreshes two)
  data_model: false
  architecture_boundary: false
  external_integration: true     # the add-ons write to Confluence via the Atlassian MCP
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

# Confluence add-ons refresh + new code-audit-comment

## Objective

Bring the Confluence add-ons up to the owner's **battle-tested** command specs.
The two existing add-on skills (`document-code`, `write-in-confluence`) shipped in
2.0/3.0 as **thin summaries** that lost most of their real operational detail;
refresh them from the evolved specs, and add a **third** add-on,
`code-audit-comment`. Along the way, **narrow the `no-legacy-refs` guard** so the
legitimate word "deprecate" (an audit-finding category) no longer false-positives.

## Background

The 3.0 baseline ships `addons/confluence/{document-code,write-in-confluence}/SKILL.md`
as ~30-line summaries. The owner's real command specs are far richer — they encode
gotchas earned in practice (two-pass link injection, discover-or-create-then-link
for shared nodes, the `textSelection` plain-text rule, CQL specifics, the
`getConfluenceSpaces` caveat). A new capability, `code-audit-comment`, audits an
existing Confluence page against the **real code** and posts inline, evidence-backed
comments. All three stay **opt-in** add-ons (never installed with the core).

## Scope

**Refresh — the two existing add-ons**

- Rewrite `document-code` and `write-in-confluence` `SKILL.md` **bodies** from the evolved specs, preserving the operational depth (node graph, two-pass linking, discover-or-create-then-link, batch mode; the operational-guide structure + screenshot-placeholder flow). Keep them within the 3.0 SKILL.md contract.
- Normalize invocation to **conversational activation** (no `/command` or `@skill` slash style — 3.0 skills are Agent Skills, not slash commands).

**Add — the third add-on**

- New `addons/confluence/code-audit-comment/SKILL.md`: audit a component that already has a Confluence page against the real code, classify findings **Reuse / Deprecate / Improve / Pending-confirmation**, and post them as **inline comments anchored to the page** — never editing the page or the source. Two guardrails from the spec: **never assume** (every finding traces to code read in the run) and **confirm the exact final text** with the human before publishing each comment.

**Change — the guard**

- Narrow `test/no-legacy-refs.test.js`: `/deprecat/i` is too broad (the 1.x deprecation narrative is already caught by `/sdd-ff/`), and it would reject `code-audit-comment`'s legitimate "Deprecate" finding category. Drop/scope it; keep `/sdd-ff/`, `/1.x/`, the path patterns.

**Conventions**

- **Language:** `name`/`description` (the activation contract) and the skill **bodies** in **English**, consistent with the rest of the methodology. The add-ons still **produce** Spanish Confluence content where their own rules say so (e.g. `write-in-confluence` output uses Spanish voseo) — only the skill files are English.
- Machine-readable frontmatter stays English; `version: 3.0.0`; `addon: confluence`.

**Out of scope (non-goals)**

- No core lifecycle/CLI/schema change; no change to how add-ons install (opt-in stays).
- Not changing the add-ons' **output** language or audience.
- No new MCP credentials/secrets handling (the Atlassian MCP mediates auth).

## Acceptance criteria

- **AC-01** `addons/confluence/` has **three** skills — `code-audit-comment`, `document-code`, `write-in-confluence` — each lints clean (skill-contract: kebab `name`, non-empty `description`, `version: 3.0.0`, `addon: confluence`), English frontmatter + body.
- **AC-02** The refreshed `document-code` / `write-in-confluence` bodies carry the evolved operational detail (e.g. two-pass link injection, discover-or-create-then-link, the `textSelection` plain-text rule, the screenshot-placeholder flow) — not the old thin summaries.
- **AC-03** `code-audit-comment` audits an existing Confluence page against real code, classifies findings **Reuse/Deprecate/Improve/Pending**, posts **inline** comments only after **explicit per-content** human confirmation, never edits the page or source, and blocks cleanly when the Atlassian MCP is unavailable or the code file can't be resolved.
- **AC-04** All three activate **conversationally** (no `/command` or `@skill` wording) and remain **opt-in** — a core `sdd install` (no `--addon`) installs none of them.
- **AC-05** `test/no-legacy-refs.test.js` no longer false-positives on legitimate "deprecate" vocabulary, still catches `sdd-ff`/`1.x`/removed paths, and the full suite is green.
- **AC-06** `sdd install --addon confluence` installs all three; `test/skill-contract.test.js` asserts the three add-on names.

## Risks

- **R-01 — Guard over-narrowed.** Dropping `/deprecat/` could let a real legacy term slip. *Mitigation:* keep `/sdd-ff/`, `/\b1.x\b/`, and the path patterns; only the generic "deprecate" word is freed (AC-05).
- **R-02 — Conversion loses detail.** Flattening the rich specs back into summaries. *Mitigation:* AC-02 asserts specific gotchas survive; review each body against the source spec.
- **R-03 — Language leakage.** Spanish prose bleeding into an English body. *Mitigation:* English body; output-language rules kept explicit inside the skill.
- **R-04 — External write surface.** The add-ons publish to a shared Confluence. *Mitigation:* the specs already require **human confirmation of exact content** before any publish, and never touch source; no new secret handling.

## Design

`design_required` is **true** (public-contract + external-integration). See
`design.md` for the SKILL.md envelope per add-on, the section-by-section content
map from the source specs, the guard change, and the test impact.

## Open technical decisions

- **Body language = English** (owner-confirmed). The add-ons' Confluence output stays Spanish where their rules specify.
- **Source of truth = the owner's shared command specs** (`code-audit-comment`, `document-code`, `write-in-confluence`); authored as clean UTF-8 (the shared copies arrived with encoding mojibake).
