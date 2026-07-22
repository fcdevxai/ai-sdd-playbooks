---
name: sdd-security-gate
description: >-
  Enforce security as a core lifecycle stage: run a 7-category checklist (authz,
  IDOR, input handling, data exposure, secrets, dependencies), validate
  coherence across proposal/design/implementation, classify risk (may raise,
  never lowers), and write security-report.md with a normalized status and
  blocking findings. Activate when the user says 'sdd-security-gate' or when
  'playbook next' routes here. Triggers: revisión seguridad, permisos, secretos.
description_es: >-
  Aplicar seguridad como etapa central del ciclo: correr un checklist de 7
  categorías (autorización, IDOR, manejo de input, exposición de datos,
  secretos, dependencias), validar coherencia entre
  proposal/design/implementación, clasificar el riesgo (puede subir, nunca baja)
  y generar security-report.md con status normalizado y hallazgos bloqueantes.
title_es: SDD Security Gate — Revisión de Seguridad pre-PR
version: 0.1.0
lifecycle_stage: security-gate
produces:
  - security-report.md
requires:
  artifacts:
    code-review-report.md:
      status: passed
---
# SDD Security Gate — Security Review

**When to run:** After sdd-code-review passes. Before sdd-runtime-gate. Can run in parallel with the browser/UX portion of the runtime gate.

## Purpose

Security is part of the **core** methodology, not an add-on. This gate validates
that the security posture declared in the proposal and refined in the design is
actually reflected in the implementation, runs a concrete checklist against real
attack surfaces, and records a structured, blocking-aware result.

> **This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.** State this disclaimer in the report and to the
> user. For features touching payments, health data, or regulated information,
> recommend a dedicated audit in addition to this gate.

## Context

If `context-packet.md` exists, read it instead of `proposal.md`+`tasks.md` in
full — it carries acceptance criteria, constraints, security considerations,
files touched, and verification commands copied verbatim from those sources.
If it doesn't exist, fall back to reading both in full (no error, no warning).
If its content visibly contradicts the live `proposal.md`/`tasks.md`, prefer
the full sources and note the discrepancy in the report — never trust the
packet blindly over contradicting live sources.

Also read: `design.md` if present (`controls`), `openspec/specs/system.md`, and
`docs/security-checklist.md` (project-specific known sensitive surfaces and
accepted risks). Read every file listed as created/modified, with particular
attention to routes/controllers, authorization middleware, database queries,
and anything handling user input or external data.

## Behavior

### 1. Determine applicability

Before running the full checklist, decide if this feature touches a
security-sensitive surface: authentication/authorization/roles/permissions; any
data belonging to a user/tenant; any external input (forms, uploads, query
params, webhooks, third-party APIs); secrets/tokens/credentials; a new
dependency or third-party integration.

If **none** apply, record `status: not_applicable` with an explicit
justification citing the relevant `SEC-N` entry — never skip silently.

If **any** apply, run the full checklist below.

### 2. Checklist

- **Authorization & access control**: every new/modified endpoint or action
  enforces authorization server-side (never only hiding UI elements); role
  checks match `proposal.md`; no privilege-escalation path.
- **Ownership boundaries (IDOR)**: object references (IDs in URLs, payloads,
  query params) are checked against the authenticated user/tenant before use;
  bulk/list endpoints filter by the requester's scope.
- **Input handling**: all external input is validated/sanitized server-side;
  queries use parameterized/ORM-safe patterns; uploads restrict type/size and
  are never executed/served as trusted content; no user input reaches a shell
  command, `eval`, or template rendering unescaped.
- **Data exposure**: responses return only fields the feature needs (least
  data principle); logs never contain passwords/tokens/full card numbers;
  error responses never leak stack traces or internal paths.
- **Secrets & credentials**: nothing hardcoded or committed; new config values
  come from environment/secret manager; tokens/sessions use secure
  storage/transmission.
- **Dependencies & integrations**: any new dependency was explicitly approved
  (per `system.md` conventions); no known critical/high vulnerability
  introduced; new integrations transmit only the minimum data required.

### 3. Coherence check & risk reconciliation

Cross-check proposal `impact`/`security` ↔ design `controls` ↔ actual
implementation. Flag a declared control with no evidence, or a new exposure not
covered by any control. `reconciled = max(declared_risk, detected_risk)`; if
you raise it, justify why. Confirm a threat model exists when
`risk: elevated` or `threat_model_required`.

### 4. Write `security-report.md`

```markdown
---
schema: security-report
schema_version: 1
change_id: <change-id>
status: <passed|failed|blocked|not_applicable>   # blocking finding → blocked; low risk/no surface → not_applicable
risk: <low|standard|elevated>
threat_model_required: <bool>
updated: <YYYY-MM-DD>
---
# Security Report — <Feature name>

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: <Full review / not_applicable — reasoning>

## Rules

- Never lower an approved risk level automatically; you may raise it with justification.
- Any blocking finding → `status: blocked` (the change moves to the blocked view).
- Always include the non-replacement disclaimer in the report and CLI output.
- Do not claim the change is "secure" — claim only that the declared controls
  have (or lack) evidence.
- Missing/client-side-only/broader-than-specified authorization, cross-tenant
  data access, unsanitized input reaching a query/command/template, sensitive
  data exposed in a response/log/error, or a committed secret → always blocking.
- Do not propose scope expansion beyond the approved feature.

## Risk model

- The **proposal** declares `security.risk` (`low | standard | elevated`) and
  `security.triggers`. `http: true` alone is **not** elevated.
- The **design** (when present) sets `threat_model_required` and lists
  `controls` (`SEC-00x`).
- This gate **may raise** the risk if it detects omitted signals; it **never
  lowers** an approved risk automatically.

## Checklist

- [pass/fail/n-a] Authorization and access control — <finding>
- [pass/fail/n-a] Ownership boundaries (IDOR) — <finding>
- [pass/fail/n-a] Input handling — <finding>
- [pass/fail/n-a] Data exposure — <finding>
- [pass/fail/n-a] Secrets and credentials — <finding>
- [pass/fail/n-a] Dependencies and integrations — <finding>

## Risk rationale



## Control checklist (control → evidence)



## Threat model (when required)



## Findings

| id | severity | blocking | location | remediation |
```

Findings that validate a `SEC-N` consideration cite its ID instead of repeating
the consideration text.

---

**Output file:** security-report.md
**Requires terminal:** no
