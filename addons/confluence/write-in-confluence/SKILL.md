---
name: write-in-confluence
description: "Draft an operational guide about a platform feature and publish it to Confluence for internal teams (Operations, Support) — a user manual, not technical IT docs. ADD-ON: requires the Atlassian MCP. Activate when the user says 'write-in-confluence' or asks to document a procedure for the operations team in Confluence."
lifecycle_stage: null
produces: []
requires: {}
version: 2.0.0
addon: confluence
---

## Purpose

Draft an operational guide about a platform feature and publish it to Confluence.
Audience: internal teams (Operations, Support) — **not** technical IT
documentation. Style is a user manual: clear, numbered, imperative steps, with
screenshot placeholders when the user provides images. **Optional add-on** —
requires the **Atlassian MCP**.

## Behavior

1. `getAccessibleAtlassianResources` → resolve the active site `cloudId`.
2. Ask the action (`AskUserQuestion`): new page / update existing page.
3. Gather the procedure: ask the user to explain the step-by-step flow, when it
   applies, and any caveats; ask for screenshots (shared in chat).
4. Draft the guide as a user manual (numbered steps, imperative voice, screenshot
   placeholders) and publish via the Confluence MCP tools.

## Rules

- Write for non-technical internal teams, not for IT.
- Requires the Atlassian MCP; if unavailable, stop and tell the user.
- This is an add-on: it must never be installed implicitly with the core.
