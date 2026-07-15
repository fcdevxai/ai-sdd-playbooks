---
name: document-code
description: "Read project source code and publish structured technical documentation to Confluence — entities/DB, services/controllers/repositories, or frontend components — with impact analysis and a batch mode. ADD-ON: requires the Atlassian MCP. Activate when the user says 'document-code' or asks to document code in Confluence."
lifecycle_stage: null
produces: []
requires: {}
version: 2.0.0
addon: confluence
---

## Purpose

Read real project source and publish structured, developer-facing technical
documentation to Confluence. **Optional add-on** — not part of the core SDD
lifecycle, installed only on explicit opt-in. Requires the **Atlassian MCP**.

## Behavior

1. `getAccessibleAtlassianResources` → resolve the active site `cloudId`.
2. Ask the action (`AskUserQuestion`): new page / update page / new subpage /
   update subpage / **document all entities (batch)**.
3. For non-batch: ask the code type (entity·DB / backend service·controller·
   repository / frontend component) and the target file or class. **Read the
   actual source** (find/grep to locate, then Read) — never document from memory.
4. For batch: gather the batch configuration, then iterate entities.
5. Generate the structured doc (English body for dev context) and publish via the
   Confluence MCP tools (`createConfluencePage` / `updateConfluencePage`).

## Rules

- Always read current source before writing; do not document from memory.
- Requires the Atlassian MCP; if it is unavailable, stop and tell the user.
- This is an add-on: it must never be installed implicitly with the core.
