---
name: document-code
description: "Read project source and publish structured, hyperlinked technical documentation to Confluence. Create or update a single component page/subpage, or run a batch that documents a whole chain (a controller's full cycle: routes→controller→services→repositories→views) or all entities. AS-IS docs, English. ADD-ON: requires the Atlassian MCP. Activate when the user says 'document-code' or asks to document code in Confluence."
lifecycle_stage: null
produces: []
requires: {}
version: 0.1.0
addon: confluence
---

## Purpose

Read source code and publish structured, developer-facing documentation to
Confluence — one page per real component, hyperlinked. Docs are in English.

- **AS-IS principle.** Document the code **as built**, not as it should be. Record
  oddities, cross-layer shortcuts and tech debt as **observed facts** (e.g. "the
  getter ignores the stored value", "the controller persists the entity directly").
  **Never** propose refactors or fixes — that is the team's call, out of scope.
- **Generic, not hardcoded.** Do not assume paths, layer names, ORM, or a fixed
  Confluence space/page. **Auto-detect and confirm**, or discover via MCP. Layers
  may be absent (Active Record collapses repository+entity) or renamed. Degrade
  gracefully.
- **Never document from memory** — every claim traces to a line read this run.

## When to run

When you need a component (or a whole controller chain, or all entities)
documented in Confluence as structured, hyperlinked pages.

## Instructions to the agent

### Step 0 — cloudId
`getAccessibleAtlassianResources` → the active site `cloudId`. (See **Blocking criteria** if none.)

### Step 1 — choose the action
`AskUserQuestion` — "What do you want to do?", exactly these five:

1. **New page** — create ONE page for a component you point to in the source.
2. **Update page** — update ONE existing component page.
3. **New subpage** — create ONE component page **nested under a parent page** you pick.
4. **Update subpage** — update ONE existing nested component page.
5. **Batch (multi-page)** — document several linked pages in one run: a **controller's full cycle** (routes→controller→services→repositories→views) or **all entities** in a directory.

Options 1–4 are **single-resource** (one page per run) → go to Step 2. Option 5 is
**multi-page** → go to Step 3.

### Step 2 — single resource (actions 1–4)

1. **Identify the component** the user points to (a class/route/file). Locate a bare name via a code-graph index (e.g. CodeGraph) or `find`/`grep`.
2. **Read the real source** and pick the matching page template (Entity / Controller / Service / Repository / View — see **Page templates**). Never document from memory.
3. **Resolve the location:**
   - **New page** → list spaces with `searchConfluenceUsingCql` (`type = "space"`, **not** `getConfluenceSpaces` — it misses spaces), `AskUserQuestion` the space, then a top parent page; create there.
   - **New subpage** → `AskUserQuestion` the **existing parent page** to nest under (e.g. a `Service` under its `Controller` hub); that page's id is the `parentId`.
   - **Update page / update subpage** → locate the existing page (by title via `searchConfluenceUsingCql`, or the user points to it).
4. **Write:**
   - **New** → verify no page with that title exists (idempotency), then `createConfluencePage` with the resolved `parentId`.
   - **Update** → `getConfluencePage` to **read the current `version.number`**, then `updateConfluencePage` with `version.number + 1`. Keep still-valid content; remove doc for a method/field no longer in the code.
5. Confirm with the page **title + link** (`_links.webui`).

### Step 3 — batch (action 5, multi-page)

Documents several related pages in one run, hyperlinked. Two entry flavors:
**a controller's full cycle**, or **all entities** in a directory.

**Conceptual model — the documentation graph.** Each node is one of:

| Class | What | Where its page lives | Strategy |
|---|---|---|---|
| **Own node** | The controller (hub) and what is exclusive to it: its view(s). | Under the **target parent** the user picks. The hub carries an index to the rest. | Created (or updated if it exists). |
| **Shared node** | Service, Repository, Entity — reusable by many entry points. | In their **own home** (space + parent discovered via MCP, distinct from the target). | **Discover-or-create-then-link**: documented already → just link; else → ask to create it in its home, then link. **Never duplicated.** |

Routes are a **section inside the controller page**, not a separate page.

**Two-pass orchestration**: pass 1 resolve/create ALL pages and collect their
URLs; pass 2 inject the hyperlinks. Never link to a page that does not exist yet.

**Full-cycle flow:**

1. **Configure the layer chain (generic).** Auto-detect first: if the project has a code-graph index (e.g. CodeGraph's `.codegraph/`) use it (preferred, cheaper); else grep/find. Detect layers **by role, not folder** (a business-logic collaborator may live in `Helper/`, `DependencyInjection/Manager/`, … and still be a "service"). Detect DI: constructor type-hint, container-by-string-id (`$this->get('x')` — map id→class via the services config), or helpers (`$this->getXxx()`). Present the detected chain and confirm (`AskUserQuestion`); save as `LAYER_CHAIN` (each layer own/shared, optional). Absent layers are omitted.
2. **Trace the full chain**, capturing **all real edges** (controllers often hit repos/entities directly, skipping services — document as-is). Trace **by method body**, not constructor. Build the node graph (own vs shared), apply a depth/width limit, and **dedup** (a component referenced N times is one node). Show the graph and confirm before touching Confluence.
3. **Destination (own nodes)** via `searchConfluenceUsingCql` (space → target parent; **not** `getConfluenceSpaces`). Save as `TARGET_PARENT_ID`.
4. **Shared-node homes** — for each shared type (Service/Repository/Entity) resolve its home once via MCP (`AskUserQuestion` space → home parent, e.g. a "Data Model" page for entities). Never assume a fixed home. Discover each concrete node: `searchConfluenceUsingCql: title = "<Type> · <Name>" AND ancestor = "HOME_PARENT_ID[type]" AND status = "current"` → exists: record its URL, link only; missing: ask to create it in its home.
5. **Pass 1** — impact analysis per node (appendix); draft each page's English content per its template with cross-links as `{{link:<node>}}` placeholders; verify by title (idempotency): missing → `createConfluencePage`; exists → `getConfluencePage` (read version) then mark for `updateConfluencePage`. Collect `node → {pageId, url}`.
6. **Pass 2** — resolve every `{{link:<node>}}`; the hub gets an index to all nodes; `updateConfluencePage` with `version.number + 1`.

**All-entities flow:** `AskUserQuestion` the entities base path, file extension, ORM; list entity files (drop abstract/interface); confirm the count; pick space + entities home; per entity read → impact → draft the Entity template → create, or `getConfluencePage`→`updateConfluencePage` if it exists (idempotent by title `Entity · X`) → report `[N/Total] Entity · X → ✓/✗`.

### Step 4 — report (see **Report format**).

## Impact / usage appendix (generic)

If the ORM is "other/none", omit ORM relations and the Impact Level section. For an
entity, measure relevance with the detected ORM's pattern (direct ORM relations;
refs in services/repositories/controllers). Levels: **High** ≥5 ORM relations or ≥5
services or ≥15 total refs; **Medium** 2–4 or 5–14; **Low** ≤1 and ≤4. For
service/repository/controller report analogous caller counts.

## Page templates (English; Confluence storage format)

Use an **info panel** for the header, a **status badge** (green/amber/red) for
Impact Level, and tables. Every `Notes` section is **AS-IS**: observed facts only
(anomalies, hardcoded values, cross-layer shortcuts, unusual locations, couplings)
— **no** prescriptive language ("should", "candidate to extract", "a future
refactor could").

- **Entity** (`Entity · <Name>`): Overview · File & Repository · Impact Level (badge + `Indicator | Count`) · Database Table · Traits · Fields (grouped by semantic category; `Field | Column | Type | Nullable | Default | Description`) · Enums/Roles · Relationships (`Property | Type | Target Entity | Description`, cross-links) · Business Rules · Indexes & Constraints.
- **Controller (hub)** (`Controller · <Name>`): info panel (`Bundle | Layer: Controller | File`) · Overview · Class Details · Constants · **Routes** (table; a section, not a page) · Actions (signature, numbered Flow, Parameters, Template variables or Response shape, error handling) · Dependencies (`Service/Class | How accessed | Purpose`, cross-links) · **Index** (links to every chain node) · Notes.
- **Service** (`Service · <Name>`, any business-logic collaborator by role, whatever the folder; `File` records the real location): info panel · Overview · Class Details · Public API (per method: signature, params, return, effects) · Dependencies (cross-links) · Business Rules / Side Effects · Used by · Notes.
- **Repository** (`Repository · <Name>`): info panel · Overview · Class Details (Namespace, Extends, Interface, **Managed Entity** cross-link) · Query Methods (per method: signature, return, DQL/SQL/criteria notes) · Notes.
- **View** (`View · <Name>`): info panel · Overview · Extends/Includes (cross-links) · Expected Variables (`Variable | Type | Source`, cross-link back to the controller) · Blocks/Sections & JS components/assets · Notes.

## Report format

```
document-code — [action]

Single resource:
  ✓ [Type · Name] — created/updated — <link>

Batch:
  Pages created/updated (own nodes + new shared):
    ✓ [Type · Name] — created/updated — <link>
  Shared nodes linked (preexisting):
    ↪ [Type · Name] — <link>
  Pending / skipped:
    — [Type · Name] — reason
  Hub: [Controller · Name] — <link>
```

## Blocking criteria

- `getAccessibleAtlassianResources` returns no resources → tell the user to authenticate the Atlassian MCP in the active runtime (Claude Code, Codex, or GitHub Copilot) and restart the session if needed. Do not continue.
- The layer chain can't be auto-detected and the user doesn't confirm one → **stop** and ask; never improvise the architecture.

## What it does NOT replace

- Not the source as source of truth (docs derive from code read this run).
- Not `openspec/` specs or design decisions: it documents what **is**, not what should be.
- Does not modify code; only reads and publishes docs. Does not invent behavior/business rules not present in the code.

## Rules

- Always read the real source before writing; never from memory.
- Requires the Atlassian MCP in the active runtime; if unavailable, stop and tell the user. A Claude Code plugin install is not visible to Codex or GitHub Copilot unless those runtimes are configured separately.
- Every update reads the current `version` first (`getConfluencePage`) and writes `version + 1`.
- In batch, discover-or-create-then-link for shared nodes; never duplicate a page.
- This is an add-on: it must never be installed implicitly with the core.
