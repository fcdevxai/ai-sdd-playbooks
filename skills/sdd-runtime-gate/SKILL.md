---
name: sdd-runtime-gate
description: "Drive the change through its applicable runtime adapters (browser, http, cli, worker) based on project capabilities, gathering real evidence, and write runtime-gate-report.md. Replaces the separate UX and E2E gates. Activate when the user says 'sdd-runtime-gate' or when 'sdd next' routes here."
lifecycle_stage: runtime-gate
produces: [runtime-gate-report.md]
requires:
  artifacts:
    security-report.md: { status: [passed, not_applicable] }
version: 2.0.0
---

## Purpose

One capability-driven runtime gate that replaces the old UX and E2E gates.
Applicability comes from `capabilities:` in `sdd.config.yaml`. An incomplete
adapter **blocks** — it must never fabricate a `passed`.

## Adapter selection (C-06)

For each adapter (`browser`, `http`, `cli`, `worker`):

| Condition | Adapter status |
|---|---|
| capability `false` | `not_applicable` (non-blocking) |
| capability `true`, supported, real evidence gathered | `passed` / `failed` |
| capability `true`, supported, required dependency absent | `blocked` (`DEPENDENCY_UNAVAILABLE`) |
| capability `true`, supported, evidence insufficient | `blocked` (`INSUFFICIENT_EVIDENCE`) |
| capability `true`, **experimental** (`cli`, `worker`) | `blocked` (`ADAPTER_NOT_IMPLEMENTED`) |

- `browser` (supported): drive the real UI via the **Playwright MCP**. If it is
  not registered, set `blocked` with `DEPENDENCY_UNAVAILABLE` — do **not** simulate.
- `http` (supported): exercise routes, auth/authz, contracts, persistence, failure paths.
- `cli` / `worker` (experimental): when their capability is `true`, they `block`
  (`ADAPTER_NOT_IMPLEMENTED`) in 2.0 — they never emit `passed`.

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
- Experimental adapters (`cli`, `worker`) block when their capability is `true`.
- The gate `status` must equal the aggregate of the per-adapter statuses.
