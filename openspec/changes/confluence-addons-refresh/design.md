---
schema: design
schema_version: 1
change_id: confluence-addons-refresh
title: "Confluence add-ons refresh — design"
status: draft
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
depends_on: proposal.md
security:
  risk: low
  threat_model_required: false
  controls: []
---

# Confluence add-ons refresh — design

Technical contract for `proposal.md`. Refresh two add-on skills from the owner's
evolved specs, add a third, and narrow one guard. No core/CLI/schema change.

**Security posture (low, no threat model).** The add-ons write to a shared
Confluence via the Atlassian MCP but add **no** secret handling and never touch
source code. Three behavioral safeguards live in the skill bodies (not formal
`SEC-*` controls): publish only after **explicit per-content** human confirmation;
never modify source or original page content (comments / new pages only); MCP
mediates all auth. See proposal **R-04**.

## 1. SKILL.md envelope (all three add-ons)

Each add-on stays a 3.0 Agent Skill: identical **frontmatter contract**, English,
with the rich operational content moved into the body.

```yaml
---
name: <kebab-name>            # code-audit-comment | document-code | operational-guide
description: "<what it does>. ADD-ON: requires the Atlassian MCP. Activate when the user says '<name>' or asks to <intent> in Confluence."
lifecycle_stage: null
produces: []
requires: {}
version: 3.0.0
addon: confluence
---
```

**Body section set** (English, adopted from the source specs):

1. **Purpose** — what it does + the AS-IS / never-assume guiding principle.
2. **When to run.**
3. **Instructions to the agent** — the numbered steps, **keeping every operational gotcha** (this is the value being restored).
4. **Report format** — the fenced report block.
5. **Blocking criteria** — MCP unavailable / unresolved target → stop.
6. **What it does NOT replace.**
7. **Rules** — the short invariants (opt-in, read real source/page, confirm before publish).

**Invocation normalization (AC-04):** activation is conversational. Replace every
`/command` and `@skill` form with the plain skill name (e.g. `document-code`,
not `/document-code`). The `description` triggers on the spoken name.

**Language (AC-01):** frontmatter + body in **English**. Output-language rules
stay explicit *inside* the body where the Confluence result must be Spanish (e.g.
`operational-guide` → "write the guide in Spanish, voseo").

## 2. `document-code` — content map (AS-IS documenter)

**Action model (owner's proven flow — do NOT collapse into "full cycle / single /
batch").** Step 1 is `AskUserQuestion` with exactly five actions:

1. **New page** — create ONE component page.
2. **Update page** — update ONE existing component page.
3. **New subpage** — create ONE component page nested under a parent page the user picks.
4. **Update subpage** — update ONE existing nested component page.
5. **Batch (multi-page)** — document several linked pages in one run: a controller's full cycle (routes→controller→services→repositories→views) **or** all entities.

Actions 1–4 are **single-resource** (one page/run); the multi-page machinery lives
**only in batch**.

**Update branches read the version first (completeness fix the owner asked for):**
every *update* (page/subpage, and any existing node inside batch) does
`getConfluencePage` to read the current `version.number`, then `updateConfluencePage`
with `version + 1`.

Preserve, from the source spec, at least:

- **Single-resource (1–4)**: identify the component from source → read real code → pick its type template → resolve location (space/top-parent for a page; an existing parent page for a subpage) → create, or read-version-then-update.
- **Batch conceptual model**: doc graph of **own** nodes (controller hub + its views, under the chosen target parent) vs **shared** nodes (service/repository/entity, in their own MCP-discovered home) — **discover-or-create-then-link, never duplicate**.
- **Batch two-pass orchestration**: pass 1 resolve/create all pages + collect URLs; pass 2 inject cross-links (`{{link:<node>}}` placeholders). *(AC-02 anchor.)*
- **Generic layer chain** (`LAYER_CHAIN`, batch): auto-detect + confirm; layers may be absent/renamed; detect by **role, not folder**; resolve DI (constructor / string-id container / helpers).
- Destination pick (own nodes) vs home discovery (shared nodes) via `searchConfluenceUsingCql` — **not** `getConfluenceSpaces`.
- The per-node-type page templates (Entity/Controller/Service/Repository/View) and the **impact/usage** appendix.
- The **AS-IS rule**: record facts/anomalies, **never** prescribe refactors.

## 3. `operational-guide` — content map (operational guide)

Preserve: the operational-guide audience (Operations/Support, **not** IT); the
**two-questions-in-one-message** intake (flow + screenshots); the
`[CAPTURA: …]` screenshot-placeholder flow + the manual-upload note; space listing
via CQL (not `getConfluenceSpaces`); create vs update (`version + 1`); the standard
document structure (`Título · …`, the `¿Qué es? / ¿Cuándo aplica? / Paso N / …`
sections) and the **style rules** — **output in Spanish, voseo rioplatense** (an
explicit body rule, even though the skill file is English).

## 4. `code-audit-comment` — new add-on (auditor)

New `addons/confluence/code-audit-comment/SKILL.md`. Core contract from the spec:

- **Purpose**: audit a component that already has a Confluence page (e.g. from `document-code`) against the **real code**, under a user-declared evolution lens; classify findings and post them as **inline comments anchored to the section** — never editing page or source.
- **Two guiding principles**: (a) **never assume** — every finding traces to code read in the run (CodeGraph/grep/git log); design/product/production questions become **Pending-confirmation**, asked, not inferred; (b) **confirm exact content** — show the human the final comment text (not a summary) and get an explicit yes **per content**; a blanket OK from a prior batch does not cover new text.
- **Steps**: cloudId → read page + locate real code → agree lens + dimensions (`AskUserQuestion`) → investigate per dimension (parallel `Explore`, with evidence) → classify **Reuse / Deprecate / Improve / Pending** → choose anchors + draft exact text → confirm → publish (`createConfluenceInlineComment` / footer) → later-iteration handling.
- **Key gotcha to keep (AC-03)**: `textSelection` must be **plain rendered text** — strip markdown (backticks/asterisks) or `createConfluenceInlineComment` 400s; verify the anchor phrase is unique (or set `textSelectionMatchIndex`).
- **Blocking**: MCP unavailable → tell the user to auth via `/mcp`; code file unresolved → stop and ask, never guess.
- **Report format** + "what it does NOT replace" (it is **not** `document-code`; it emits opinions but always evidence-anchored; it does not decide architecture).

## 5. Guard change — `test/no-legacy-refs.test.js`

Remove `/deprecat/i` from `FORBIDDEN`. Rationale: the 1.x deprecation *narrative*
is already caught by `/sdd-ff/`, `/\b1.x\b/`, and the removed-path patterns; the
generic word "deprecate" is legitimate software vocabulary (a `code-audit-comment`
finding category) and must not be banned repo-wide. Everything else in `FORBIDDEN`
stays. *Tradeoff:* the guard no longer flags a re-introduced generic "deprecation"
sentence — acceptable, since the concrete legacy artifacts remain covered.

## 6. Test impact

- **`test/skill-contract.test.js`**: the add-on names assertion becomes
  `['code-audit-comment', 'document-code', 'operational-guide']`; all three must
  lint clean at `version: 3.0.0`.
- **`test/no-legacy-refs.test.js`**: drop `/deprecat/i` (§5); the refreshed +
  new bodies must otherwise be legacy-clean (they are — they reference
  `document-code`, CodeGraph, `git log`; no `sdd-ff`/`1.x`/removed paths).
- **`test/install.test.js`**: re-check it pins no add-on **count** that a third
  skill would break (the confluence-install tests assert behavior, not a count —
  confirm during Phase 2).
- Install globs `addons/confluence/` (`listAddonSkills` → `readdirSync`), so the
  third folder is picked up with no install-code change.

## 7. Traceability

| AC | Design section |
|---|---|
| AC-01 | §1 |
| AC-02 | §2, §3 |
| AC-03 | §4 |
| AC-04 | §1 (invocation) |
| AC-05 | §5, §6 |
| AC-06 | §6, and install globbing (§6) |
