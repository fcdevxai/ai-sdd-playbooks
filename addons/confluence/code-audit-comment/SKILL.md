---
name: code-audit-comment
description: "Audit a code component that already has a Confluence page (e.g. from document-code) against the REAL code, under a user-declared evolution lens; classify findings Reuse/Deprecate/Improve/Pending and post them as inline comments anchored to the page — never editing the page or the source. ADD-ON: requires the Atlassian MCP. Activate when the user says 'code-audit-comment' or asks to audit existing Confluence docs against the code."
lifecycle_stage: null
produces: []
requires: {}
version: 3.0.0
addon: confluence
---

## Purpose

Audit a component (entity, service, repository, controller, …) that **already has a
Confluence page** (e.g. produced by `document-code`) by contrasting what is
documented against the **real code**, under an evolution goal the user declares
(general tech debt, a major rewrite, a framework change, …). Findings are
classified **Reuse / Deprecate / Improve / Pending-confirmation** and published as
**inline comments anchored to the relevant section** — never modifying the original
content or the source.

- **Guiding principle — never assume.** Every finding must be backed by real code
  read this run (via CodeGraph/grep/git log), never by memory or what the code
  "probably" does. A design question the code cannot answer (is this pattern
  intentional? how many production rows depend on this legacy path? what is the real
  scope of the rewrite?) is **not inferred** — it is recorded as an open question
  and asked.
- **Guiding principle — confirm exact content, not general intent.** Writing to
  Confluence is visible to others and hard to undo. Never publish a comment without
  the user seeing the **exact final text** (not a summary) and confirming it for
  *that specific* content. A generic OK from a previous batch ("go ahead") does
  **not** cover new or different content — show it again and re-confirm whenever the
  content changes.

## When to run

When technical documentation of a component already exists in Confluence and you
need an **honest, evidence-backed opinion** on how well that design aged — what to
keep, what is dead, what has real friction — ahead of a future decision (rewrite,
migration, refactor, or plain hygiene), leaving the audit trail on the page itself
rather than in a separate doc.

## Usage

Needs a Confluence `pageId` (or URL). If missing, ask for it. If the code component
is not given, auto-detect it from the page title/content (e.g. `Entity · Program`
→ `src/.../Entity/Program.php`) and **confirm the path with the user before reading
code**.

## Instructions to the agent

### Step 0 — cloudId
`getAccessibleAtlassianResources`. (See **Blocking criteria** if none.)

### Step 1 — read the page and locate the real code
1. `getConfluencePage` (`contentFormat: markdown`) with the `pageId`.
2. Identify the documented file. If the title follows `Type · Name` (the `document-code` convention), resolve the path via CodeGraph (`codegraph_node <Name>` or `find`); otherwise ask the user.
3. Read the **complete, real** code (`codegraph_node <file>`, no arbitrary limit — read a long file in chunks until fully covered). Never audit from memory: every claim in a comment traces to a concrete line read this run.

### Step 2 — agree the lens and scope
`AskUserQuestion`:
- "What is the goal behind this audit?" — general tech debt (default if none) / prepare a major rewrite / evaluate a specific change / other. The lens changes what counts as "dead" or "improvable" (e.g. under a "pure REST API" lens, code that only feeds Twig views is a deprecate candidate even if it has callers).
- "Which dimensions to cover?" (multiSelect): real method usage (dead vs live) / normalization & column design / relationships & referential integrity / single-responsibility & layering / configuration patterns (JSON bags, flags, EAV) / migrations or deprecations in progress / other. If the user says "all" or doesn't choose, cover the first five.

### Step 3 — investigate each chosen dimension (with evidence, in parallel where it helps)
Use parallel `Explore` agents (one per independent dimension) to avoid losing context or assuming. Per dimension, gather concrete evidence:
- **Usage / dead code**: for each relevant public method, find real callers (grep + CodeGraph) across ALL modules, not just the obvious one; report those with 0 callers explicitly. If methods seem to duplicate a purpose, compare 2–3 real call sites of each.
- **Normalization / columns**: count own + trait/mixin columns + FKs; flag repeated fixed columns for the same concept when the domain already solves it elsewhere with an association table.
- **Relationships**: look for redundancy with another mechanism, business invariants validated only in app code (no DB constraint/index), and lookup columns (slugs/tags/external codes) without declared uniqueness.
- **SRP / layers**: group methods by "reason to change"; 3+ distinct groups in one class is an SRP finding; cross it with the Step 2 lens.
- **Config patterns (JSON bags/flags)**: grep raw SQL (`JSON_EXTRACT`, `->>`, …) depending on the config column across the whole repo; count keys filtered in `WHERE` (expensive) vs only projected (cheap); check whether the codebase already has a better precedent.
- **Migrations/deprecations in progress**: for each `@TODO`/`deprecated`/replacement mechanism, check whether a real migration command exists, whether UI still generates old-format data, and who else reads the legacy path.
- **Churn/coupling** (supporting evidence): `git log --oneline --follow -- <file>` for commit count, CodeGraph for dependent-file count.

Any question that depends on business intent, product decision, or real production data is recorded as **Pending-confirmation** — not resolved by inference.

### Step 4 — classify findings
Group everything into **Reuse** (evidence it is well-solved), **Deprecate** (evidence it is unused/dead — 0 callers, no UI/command feeding it), **Improve** (valid concept, concrete verifiable friction; propose a recognized best-practice alternative, noting if it is new to the team or already has precedent), **Pending-confirmation** (anything the code cannot answer).

### Step 5 — choose anchors and draft the exact content
1. Pick an exact **anchor text** from the page (prefer prose/headings over table cells). Count how many times the phrase appears before anchoring — if not unique, pick a more specific phrase or set `textSelectionMatchIndex`.
2. **`textSelection` carries NO markdown, ever.** `getConfluencePage` returns the body in markdown (backticks, `**bold**`), but `createConfluenceInlineComment` matches `textSelection` against the **plain rendered text**, which has none of those characters. An anchor like `` `toArray()` exposes … `` fails with 400 (`Can not create inline comment`) because those backticks are not in the real text. Strip every markdown syntax character from the chosen phrase and anchor on the plain-text result. (The comment `body` may still use markdown.)
3. Draft the comment in Spanish, with a date, summarized evidence (`file:line`, counts) and — if applicable — the concrete recommendation. Concise, no filler.
4. Before writing, list ALL proposed comments with their (plain-text) anchor and full final text, and get **explicit** confirmation (`AskUserQuestion` or a direct question). **Publish nothing until an unambiguous yes for that specific content.**
5. If `createConfluenceInlineComment` still 400s, don't blind-retry: re-check the phrase against the markdown body, confirm no syntax character remains, and retry with the cleaned phrase.

### Step 6 — publish
Per confirmed comment, `createConfluenceInlineComment` (or `createConfluenceFooterComment` for a general summary position). Report each comment's link (`_links.webui`).

### Step 7 — later iterations
If the user asks for "more" on the same page in another run: `getConfluencePageInlineComments` to see what is already commented (avoid duplicate anchors/findings), then return to Step 2 with only the not-yet-covered dimensions.

## Findings classification

`Reuse` (keep) · `Deprecate` (dead/unused) · `Improve` (valid concept, concrete
friction, with a recommendation) · `Pending-confirmation` (needs a decision or data
the code can't answer).

## Checklist

- [ ] `cloudId` obtained.
- [ ] Page read and the code component identified and confirmed.
- [ ] Real code read in full (never from memory).
- [ ] Audit lens and dimensions agreed with the user.
- [ ] Every finding backed by concrete evidence (`file:line`, grep, count, git log).
- [ ] Questions the code can't answer marked Pending-confirmation, never assumed.
- [ ] Anchor phrases verified unique (or correct index) before commenting.
- [ ] Exact content shown and confirmed by the user before publishing.
- [ ] Comments published and reported with links.

## Report format

```
Audit — [Type · Name] (lens: [chosen goal])

Reuse:
  - [finding] — evidence: [file:line / count]
Deprecate:
  - [finding] — evidence: [...]
Improve:
  - [finding] — evidence: [...] — recommendation: [...]
Pending-confirmation:
  - [open question]

Comments published:
  ↪ [anchor] — <link>
```

## Blocking criteria

- `getAccessibleAtlassianResources` returns no resources → tell the user to authenticate the Atlassian MCP via `/mcp` → "claude.ai Atlassian". Do not continue.
- The real code file behind the page can't be identified → **stop** and ask for the path; never guess the component.

## What it does NOT replace

- Not `document-code`: that command **creates** AS-IS documentation, no opinions. This one **audits** existing documentation and does emit opinions — always evidence-anchored and marked as such, never mixed into the documented facts.
- Does not modify the page's original content or the source: it only adds comments.
- Does not replace a team architecture decision: it surfaces findings and open questions; the team decides the direction.

## Rules

- Every finding traces to real code read this run; never assume.
- Confirm the exact comment text with the user before each publish; a prior batch's OK does not cover new content.
- `textSelection` is plain text (no markdown) — or the inline comment 400s.
- Requires the Atlassian MCP; if unavailable, stop and tell the user.
- This is an add-on: it must never be installed implicitly with the core.
