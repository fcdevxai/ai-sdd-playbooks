---
name: sdd-security-gate
description: "Enforce security as a core lifecycle stage: validate coherence across proposal/design/implementation, check declared controls have evidence, classify risk (may raise, never lowers), and write security-report.md with a normalized status and blocking findings. Activate when the user says 'sdd-security-gate' or when 'sdd next' routes here."
lifecycle_stage: security-gate
produces: [security-report.md]
requires:
  artifacts:
    code-review-report.md: { status: passed }
version: 2.0.0
---

## Purpose

Security is part of the **core** methodology, not an add-on. This gate validates
that the security posture declared in the proposal and refined in the design is
actually reflected in the implementation, and records a structured, blocking-aware
result.

> **This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.** State this disclaimer in the report and to the user.

## Risk model (design §6, C-04)

- The **proposal** declares `security.risk` (`low | standard | elevated`) and
  `security.triggers`. `http: true` alone is **not** elevated.
- The **design** sets `threat_model_required` and lists `controls` (`SEC-00x`).
- This gate **may raise** the risk if it detects omitted signals; it **never
  lowers** an approved risk automatically.

## Behavior

1. **Coherence check**: proposal `impact`/`security` ↔ design `controls` ↔ actual
   implementation. Flag mismatches (e.g. a declared control with no evidence, or
   a new exposure not covered by any control).
2. **Reconcile risk**: `reconciled = max(declared_risk, detected_risk)`. If you
   raise it, justify why.
3. **Threat model**: required when `risk: elevated` or `threat_model_required`.
   Confirm it exists and covers the main attack surfaces.
4. **Findings**: record each as `{ id, severity, blocking, location, remediation }`.
   Any `blocking: true` finding forces the report `status: blocked`.
5. **Write `security-report.md`**:

```markdown
---
schema: security-report
schema_version: 1
change_id: <change-id>
status: <passed|failed|blocked|not_applicable>   # blocking finding → blocked; low risk → not_applicable
risk: <low|standard|elevated>
threat_model_required: <bool>
updated: <YYYY-MM-DD>
---
# Security Report — <Feature name>

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

## Risk rationale
## Control checklist (control → evidence)
## Threat model (when required)
## Findings
| id | severity | blocking | location | remediation |
```

A `low`-risk change still produces a report with `status: not_applicable`.

## Rules

- Never lower an approved risk level automatically; you may raise it with justification.
- Any blocking finding → `status: blocked` (the change moves to the blocked view).
- Always include the non-replacement disclaimer in the report and CLI output.
- Do not claim the change is "secure" — claim only that the declared controls
  have (or lack) evidence.
