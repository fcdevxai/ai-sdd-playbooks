---
name: operational-guide
description: "Draft an operational guide (a user manual) about how to use a platform/project feature and publish it to Confluence for internal teams (Operations, Support) — not technical IT docs. Output is Spanish (voseo). ADD-ON: requires the Atlassian MCP. Activate when the user says 'operational-guide' or asks to document how to use a feature/procedure for the operations or support team in Confluence."
lifecycle_stage: null
produces: []
requires: {}
version: 0.1.0
addon: confluence
---

## Purpose

Draft an **operational guide** — a user manual — about how to use a
platform/project feature, and publish it to Confluence. Audience: **internal
teams (Operations, Support)**, *not* technical IT. Style: clear, direct, numbered
steps, with screenshots when provided.

- **Output language: Spanish, voseo rioplatense** (`usá`, `hacé`, `ingresá`,
  `verificá`). This skill file is English; the **published guide is Spanish**.
- **Do not invent the procedure** — gather the real flow from the user; never
  document from memory or assume steps.

## When to run

When you need a how-to guide about using a platform feature, written for the
internal operations/support team and published to Confluence.

## Instructions to the agent

### Step 1 — cloudId
`getAccessibleAtlassianResources` → the active site `cloudId`. (See **Blocking criteria** if none.)

### Step 2 — choose the action
`AskUserQuestion` — "What do you want to do?": **Create a new page** / **Update an existing page**.

### Step 3 — gather the procedure
Ask these **two questions in the same message**, one after the other:

1. "Explain the flow you want to document: what does the user do step by step? when does this procedure apply? anything important to keep in mind?"
2. "Do you have screenshots to include? If so, share them directly in the chat."

If the user shares images: analyze each and describe briefly what it shows; when
drafting, mark the exact spot for each image, in flow order, with
`[CAPTURA: short description]`; at the end tell the user: *"Las capturas marcadas
como [CAPTURA: …] subilas manualmente en Confluence: editá la página, posicioná el
cursor en el marcador y usá Insertar → Imagen."* If there are no screenshots, draft
without placeholders.

### Step 4 — choose the space
List spaces with `searchConfluenceUsingCql` (`type = "space"`) — **not**
`getConfluenceSpaces` (it misses spaces). `AskUserQuestion` the space (show name + key).

### Step 5A — create a new page
Draft the content (see **Output document structure**), `createConfluencePage` in
the chosen space, confirm with the title + direct link.

### Step 5B — update an existing page
1. List pages: `searchConfluenceUsingCql` `space.key = "KEY" AND type = "page" ORDER BY lastmodified DESC`.
2. `AskUserQuestion` which page to update.
3. `getConfluencePage` to read the **current content and `version.number`**.
4. Incorporate the new information **without deleting still-relevant content**.
5. `updateConfluencePage` with `version.number + 1`. Confirm with the direct link.

## Output document structure (Spanish)

The published guide is in Spanish. Title pattern: `[Tipo] · [Nombre]` (`·` is a
middle dot, not a hyphen). Common types: `Funcionalidad · …`, `Procedimiento · …`,
`Soporte · …`. Sections, in order:

1. `## ¿Qué es [nombre]?` — one or two sentences: what it does and its value.
2. `## ¿Cuándo aplica este procedimiento?` — when it is used; if there is a mandatory prerequisite, state it as **Requisito previo:**.
3. `## Paso N — [acción]` (one H2 per step): numbered sub-steps, imperative + voseo (`Ingresá`, `Hacé clic`, `Verificá`, `Seleccioná`); **bold** for button/section/UI names; important notes as italics or **Importante:**; insert `[CAPTURA: …]` right after the relevant sub-step.
4. `## ¿Cómo se calcula / funciona …?` *(optional)* — internal logic; use a table for dimensions/criteria.
5. `## Preguntas frecuentes` *(optional)* — bold question + paragraph answer.
6. Additional as needed: `## Notificaciones`, `## Estados posibles`, `## ¿Dónde llega? / ¿Qué sucede después?`.

**Style:** Spanish voseo; direct tone, no jargon (reader is Operations, not a dev);
bold for UI terms; **no references to the session** — write as if the reader never
took part in the development or the conversation.

## Checklist

- [ ] `cloudId` obtained.
- [ ] Action chosen (create / update).
- [ ] Procedure gathered from the user (flow + screenshots) — never assumed.
- [ ] Space chosen (via CQL, not `getConfluenceSpaces`).
- [ ] Guide drafted in Spanish voseo with the standard structure; `[CAPTURA: …]` markers placed where images go.
- [ ] Published (create) or updated (`getConfluencePage` → `version + 1`, no relevant content lost).
- [ ] Confirmed with the direct page link; user reminded to upload the marked screenshots.

## Report format

```
Operational guide — [create | update]

Page: [Tipo · Nombre] — <link>
Screenshots to upload manually: N   (the [CAPTURA: …] markers, in order)
```

## Blocking criteria

- `getAccessibleAtlassianResources` returns no resources → tell the user to authenticate the Atlassian MCP in the active runtime (Claude Code, Codex, or GitHub Copilot) and restart the session if needed. Do not continue.

## What it does NOT replace

- Not technical/IT documentation — that is `document-code` (developer-facing). This is a user manual for Operations/Support.
- Does not modify code or invent the procedure: it documents the flow the user provides.

## Rules

- Write for non-technical internal teams, not for IT; output in Spanish voseo.
- Gather the real procedure from the user; never document from memory.
- Every update reads the current `version` first (`getConfluencePage`) and writes `version + 1`, without dropping still-relevant content.
- Requires the Atlassian MCP in the active runtime; if unavailable, stop and tell the user. A Claude Code plugin install is not visible to Codex or GitHub Copilot unless those runtimes are configured separately.
- This is an add-on: it must never be installed implicitly with the core.
