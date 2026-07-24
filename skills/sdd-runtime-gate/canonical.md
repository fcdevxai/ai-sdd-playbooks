---
name: sdd-runtime-gate
description: "Drive the change through its applicable runtime adapters (browser, http, cli, worker) based on project capabilities, gathering real evidence, and write runtime-gate-report.md. The browser adapter absorbs the full UX/UI checklist (flows, states, responsive, accessibility). Replaces separate UX and E2E gates. Activate when the user says 'sdd-runtime-gate' or when 'playbook next' routes here."
description_es: "Ejecutar el change a través de sus adapters de runtime aplicables (browser, http, cli, worker) según las capabilities del proyecto, reuniendo evidencia real y generando runtime-gate-report.md. El adapter browser incluye el checklist completo de UX/UI. Reemplaza los gates separados de UX y E2E."
title_en: "SDD Runtime Gate — Capability-Driven Runtime Evidence"
title_es: "SDD Runtime Gate — Evidencia de Runtime por Capability"
when: "After sdd-security-gate is passed or not_applicable. Before sdd-commit."
output_file: "runtime-gate-report.md"
requires_terminal: false
lifecycle_stage: runtime-gate
produces: [runtime-gate-report.md]
requires:
  artifacts:
    security-report.md: { status: [passed, not_applicable] }
version: 0.1.0
---

## Purpose

One capability-driven runtime gate that replaces separate UX and E2E gates.
Applicability comes from `capabilities:` in `playbook.config.yaml`. An
incomplete adapter **blocks** — it must never fabricate a `passed`.

## Context

If `context-packet.md` exists, read it instead of `proposal.md`+`tasks.md` in
full — it carries acceptance criteria, constraints, security considerations,
files touched, and verification commands copied verbatim from those sources.
If it doesn't exist, fall back to reading both in full (no error, no warning).
If its content visibly contradicts the live `proposal.md`/`tasks.md`, prefer
the full sources and note the discrepancy.

To scope which changed files to exercise, run
`playbook changed-files <change-id> --diff` first; full-read a file only when the
diff touches authorization/ownership/input or is insufficient to judge what to
drive. Use `playbook spec-read <file>#<anchor>` to read only the relevant section
of a spec; if the anchor is absent, fall back to full-read and report why. If you
need a permanent-spec anchor you don't know and `.specloom/index/spec-index.json`
doesn't exist, run `playbook spec-index` to build it, then `playbook spec-read
openspec/specs/<file>#<anchor>`. If `spec-index` or the lookup fails, full-read
the spec and report why.

## Adapter selection

Read `proposal.md`'s `runtime_relevant_capabilities` if present. A project
capability `true` but **excluded** from that list is `not_applicable` /
`NOT_RELEVANT_TO_CHANGE` for this change. If the field is absent, every
enabled capability is relevant (no narrowing).

For each adapter (`browser`, `http`, `cli`, `worker`):

| Condition | Adapter status |
|---|---|
| capability `false` | `not_applicable` (non-blocking) |
| capability `true`, excluded via `runtime_relevant_capabilities` | `not_applicable` (`NOT_RELEVANT_TO_CHANGE`) |
| capability `true`, relevant, supported, real evidence gathered | `passed` / `failed` |
| capability `true`, relevant, supported, required dependency absent | `blocked` (`DEPENDENCY_UNAVAILABLE`) |
| capability `true`, relevant, supported, evidence insufficient | `blocked` (`INSUFFICIENT_EVIDENCE`) |
| capability `true`, relevant, **experimental** (`cli`, `worker`) | `blocked` (`ADAPTER_NOT_IMPLEMENTED`) |

### `browser` (supported) — full UX/UI checklist

Drive the real UI via the **Playwright MCP**. If it is not registered, set
`blocked` with `DEPENDENCY_UNAVAILABLE` — do **not** simulate. When evaluating,
cover:

1. **Primary flow** — the primary user journey completes without blockers; no
   dead ends, ambiguous CTAs, or hidden critical actions.
2. **UI states** — for each critical screen/action: loading, empty, error, and
   success states exist and are understandable/actionable.
3. **Forms & interaction** — validation messages are clear and attached to the
   right control; a failed submit does not lose user input; disabled/loading
   buttons prevent duplicate actions.
4. **Responsive behavior** — mobile (~360px), tablet (~768px), and desktop
   (1024px+) preserve hierarchy, readability, and reachable actions.
5. **Accessibility basics** — keyboard navigation works for the critical flow;
   focus indicator is visible and predictable; labels/accessible names exist;
   contrast appears acceptable for key text/controls.
6. **Content & trust** — copy matches feature intent and product tone;
   irreversible actions are clearly flagged; no placeholder/internal text is
   exposed to users.
7. **Evidence** — attach flow recording or step-by-step screenshots, state
   captures (loading/empty/error), and mobile + desktop captures for key
   screens. Findings that validate an acceptance criterion cite its `AC-N` ID.

A blocking browser finding (primary flow fails, a critical action is
inaccessible, a critical state is missing/misleading, or a severe
responsive/accessibility break in the critical flow) → adapter `status: failed`.

### `http` (supported)

Exercise routes, auth/authz, contracts, persistence, failure paths.

### `cli` / `worker` (experimental)

When their capability is `true` and relevant, they `block`
(`ADAPTER_NOT_IMPLEMENTED`) — they never emit `passed`.

## Runtime tool dependency

Playwright MCP is configured per runtime. A Claude Code plugin install is not
visible to Codex or GitHub Copilot, and a Codex MCP config is not visible to
Claude. Before evaluating `browser`, confirm Playwright MCP is registered in the
active session (e.g. `/mcp`; Codex can also use `codex mcp list`). If it is
absent, record `DEPENDENCY_UNAVAILABLE` and include the active runtime in the
finding when known.

## Gate status

`passed` iff every applicable adapter is `passed`; `not_applicable` if none apply;
`blocked` if any applicable adapter is `blocked`; `failed` if any applicable
adapter is `failed`.

## Output — `runtime-gate-report.md`

```markdown
---
schema: runtime-gate-report
schema_version: 1
change_id: <change-id>
status: <passed|failed|blocked|not_applicable>
updated: <YYYY-MM-DD>
adapters:
  browser: { status: passed }
  http: { status: passed }
  cli: { status: not_applicable }
  worker: { status: not_applicable }
---
# Runtime Gate Report — <Feature name>
## <adapter> — <status>
- Evidence: <what was driven and observed>
- Findings: <issues, if any>
```

## Rules

- Never fabricate `passed`; missing evidence or dependency → `blocked` with a `reason_code`.
- A `false` capability is `not_applicable` and does not block.
- Experimental adapters (`cli`, `worker`) block when their capability is `true` **and relevant to this change**.
- A capability the proposal explicitly marks irrelevant to this change is `not_applicable`, not `blocked` — even if experimental.
- The gate `status` must equal the aggregate of the per-adapter statuses.
- This gate does not replace product/design ownership decisions for the `browser` adapter's findings.
