---
lang: en
slug: sdd-e2e-gate
title_en: "SDD E2E Gate — Backend Integration Validation via Browser"
title_es: "SDD E2E Gate — Validación de Integración Backend vía Navegador"
description: "Validate that critical user flows correctly integrate with the real backend after implementation and before PR approval, using browser automation (Playwright MCP) to drive the flow and inspect actual network requests, responses, and console errors. Complements sdd-code-review (static/spec compliance) and sdd-ux-gate (visual/UX quality) by checking that data flows correctly end-to-end through real API calls. Generate e2e-gate-report.md with READY FOR PR E2E or REQUIRES E2E FIXES verdict. Only applicable to projects that expose a web UI — self-skips (N/A) for API-only/backend-only projects with no web interface. Activate when the user says \"sdd-e2e-gate\", \"e2e gate\", \"playwright gate\", \"backend integration test\", \"validate backend integration\", or asks to validate that a flow works end-to-end against the real backend."
description_es: "Valida que los flujos críticos implementados integran correctamente con el backend real (peticiones de red, respuestas, sesión/auth) usando Playwright MCP. No aplica a proyectos sin interfaz web."
when: "After `/sdd-code-review`. Can run in parallel with, or after, `/sdd-ux-gate`, always before `/sdd-commit`. Only applies to projects with a web UI — self-skips automatically in backend-only projects (REST APIs with no UI)."
output_file: "e2e-gate-report.md"
verdict_pass: "READY FOR PR E2E"
verdict_fail: "REQUIRES E2E FIXES"
requires_terminal: true
---

## Purpose

Run a dedicated end-to-end integration gate after implementation and technical review. Unlike `sdd-ux-gate` (visual/interaction quality) or `sdd-code-review` (static/spec compliance), this gate drives the real critical flow through the actual web UI using Playwright MCP browser automation and inspects the real backend integration: network requests fired, response status/payload, session/auth behavior, and console errors.

This gate only applies to consumer projects that expose a web UI. If the project has no web interface (pure REST API, CLI, worker, etc.), this gate is not applicable — see "Applicability check" below.

This gate requires the `playwright` MCP server to be registered in the agent's environment (`claude mcp add playwright npx @playwright/mcp@latest`, or an equivalent project/user-scoped registration). Registering the MCP server is a one-time environment setup step outside this command's control — this gate can only detect whether it is available, never install it. If it is not available, do not simulate or fabricate browser evidence — see "Playwright MCP availability check" below.

---

## Context

Read before running the gate:

1. `openspec/changes/[ticket-slug]/proposal.md` — acceptance criteria, critical flows, and error cases
2. `openspec/changes/[ticket-slug]/tasks.md` — implemented scope, routes/endpoints touched
3. `openspec/changes/[ticket-slug]/code-review-report.md` — if it exists, known technical risks
4. `openspec/specs/system.md` — architecture, stack, and whether the project exposes a web UI
5. `docs/doc_verification_guide.md` — project-specific environment/setup for E2E runs (safe test environment, seed/test users, base URL)
6. MCP configuration — confirm the `playwright` MCP server is registered for this session (`claude mcp list`); this is a prerequisite, not something this command installs

If `code-review-report.md` exists, read it first and ensure the verdict is `READY FOR PR` or list known technical risks in the report assumptions.

---

## Behavior

### 0. Applicability check

- [ ] Confirm the project exposes a web UI (check `openspec/specs/system.md` stack/frontend section or the project's `CLAUDE.md`)
- [ ] If the project has no web UI, stop here: generate a one-line `e2e-gate-report.md` stating "N/A — project has no web UI" and treat the gate as passed. Do not block the SDD cycle.

### 1. Playwright MCP availability check

- [ ] Confirm the `playwright` MCP server is registered for this session (`claude mcp list`, or check whether `mcp__playwright__*` tools are listed as available/deferred tools)
- [ ] If the tools are listed as deferred, load them via ToolSearch before use — e.g. `select:browser_navigate,browser_snapshot,browser_click,browser_type,browser_fill_form,browser_network_requests,browser_console_messages,browser_take_screenshot`
- [ ] If the `playwright` MCP server is not available at all in this environment, stop here: do not fabricate or approximate browser evidence. Generate `e2e-gate-report.md` with verdict `BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED` and tell the user to register it (`claude mcp add playwright npx @playwright/mcp@latest`) before re-running this gate.

### 2. Prepare a safe environment

- [ ] Confirm the app is reachable on an isolated/test environment declared in `docs/doc_verification_guide.md` (never production, never a shared dev database with real user data)
- [ ] Confirm test/seed credentials exist for the flow under test

### 3. Identify critical flows to exercise

- [ ] From `tasks.md`/`proposal.md`, list the touched routes/endpoints that involve a real backend call (not purely static UI)
- [ ] Prioritize flows explicitly marked as acceptance criteria; skip cosmetic-only changes

### 4. Drive the flow and capture network evidence

For each critical flow:

- [ ] Navigate and interact through the real UI using the loaded Playwright MCP tools (`browser_navigate`, `browser_click`, `browser_type`/`browser_fill_form`, `browser_snapshot`)
- [ ] Capture the network requests triggered with `browser_network_requests` (status codes, request/response payload shape)
- [ ] Confirm success paths return the expected status and the UI renders the real response data (not stale/cached/mocked)
- [ ] Confirm auth/session headers or tokens are sent as expected for protected routes

### 5. Validate error and edge paths

- [ ] Trigger at least one backend error path relevant to the feature (validation error, unauthorized, not found, etc.)
- [ ] Confirm the UI surfaces the error without silent failures or unhandled exceptions
- [ ] Confirm no unexpected errors/warnings appear via `browser_console_messages` during the happy path

### 6. Produce verdict

Use one of:

- `READY FOR PR E2E` — critical flows integrate correctly with the real backend, no blocking issues
- `REQUIRES E2E FIXES` — at least one blocking integration issue
- `BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED` — the required MCP server is not available in this environment, so no flow could be exercised; this is an environment/setup gap, not a code issue

Blocking examples (for `REQUIRES E2E FIXES`):
- A critical flow does not reach the backend or the request fails silently
- The UI shows stale/incorrect data despite a successful backend response
- An error response is not surfaced to the user (silent failure)
- Unhandled console errors appear during a supposedly successful flow
- Auth/session is not honored correctly (e.g., a protected action succeeds without valid auth)

### 7. Generate e2e-gate-report.md

````markdown
# E2E Gate Report - [Feature name]

**Ticket**: [ticket-slug]
**Environment**: [test/staging environment used]

## Applicability

[Project has a web UI / N/A - no web UI / BLOCKED - Playwright MCP not configured]

## Flows exercised

| # | Flow | Endpoint(s) | Result |
|---|---|---|---|
| 1 | [flow description] | `METHOD /path` | PASS/FAIL |

## Error paths verified

| # | Error case | Endpoint(s) | Result |
|---|---|---|---|
| 1 | [error case] | `METHOD /path` | PASS/FAIL |

## Evidence

- Network requests: [summary or reference]
- Console messages: [summary, "no errors" or list]

## Issues found

[List with severity, location, and proposed fix, or "None"]

---

## Verdict

READY FOR PR E2E / REQUIRES E2E FIXES / BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED
````

---

## Output

`openspec/changes/[ticket-slug]/e2e-gate-report.md` with verdict `READY FOR PR E2E`, `REQUIRES E2E FIXES`, `BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED`, or an N/A note for non-UI projects.

---

## Rules

- This gate does not replace `sdd-code-review` (static/spec compliance) or `sdd-ux-gate` (visual/UX quality) — it validates that data actually flows correctly through real backend calls.
- Never run against production or a shared development database with real user data; always use the isolated/test environment declared in `docs/doc_verification_guide.md`.
- If the project has no web UI, mark the gate as N/A and do not block the cycle.
- If the `playwright` MCP server is not registered in this environment, verdict must be `BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED` — never approximate or fabricate browser evidence, and never conflate this with the N/A (no web UI) case.
- If a critical flow's backend integration cannot be verified, verdict must be `REQUIRES E2E FIXES`.
- Do not leave test data behind without cleanup if the flow under test creates persistent records.
- Keep findings concrete and reproducible (exact request/response, exact console message).
