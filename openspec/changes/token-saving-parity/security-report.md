---
schema: security-report
schema_version: 1
change_id: token-saving-parity
status: not_applicable
risk: standard
threat_model_required: false
updated: 2026-07-24
---
# Security Report — Paridad de ahorro de tokens: cablear packet + spec-index

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: not_applicable — this change touches no security-sensitive
surface. It is almost entirely prose edits to `skills/*/canonical.md`
(instructing agents to read an already-existing `context-packet.md`, correct a
`spec-read` example, and invoke an already-existing `spec-index` command). The
one code change (`src/cli/doctor.js`) adds `specIndexAdvisory({cwd})`, a
read-only existence check on a local path — same `cwd` trust level as the
already-existing `workflowStaleness` check it's modeled on. None of the
applicability triggers apply: no
authentication/authorization/roles/permissions touched, no user/tenant data
read or written, no new external input surface (the `cwd` flag is the
pre-existing CLI invocation pattern, not new), no secrets/tokens/credentials
involved, no new dependency or third-party integration (it reuses
`discoverSpecFiles`/`defaultSpecIndexPath` already exported by
`src/tokens/spec-index.js`). This maps directly to the proposal's own **SEC-1**
and **SEC-2** (see below) — confirmed against the actual diff, not just the
proposal's claim.

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

- Declared: `security.risk: standard`, `security.triggers: []` (proposal
  frontmatter). The proposal's own reviewer note suggested this could be
  lowered to `low`, but this gate never auto-lowers an approved risk — kept
  at `standard` as declared.
- No `design.md` exists (`design_required: false`), so no `controls`/
  `threat_model_required` to reconcile against.
- `docs/security-checklist.md` has no project-specific entries yet (template
  only) — nothing to cross-check findings against.
- **Reconciliation**: `detected_risk` = no elevated signal found → reconciled
  risk stays at the declared `standard`. Not raised.

## Checklist

- [n-a] Authorization and access control — no endpoint/action added or modified.
- [n-a] Ownership boundaries (IDOR) — no object references, IDs, or per-user/tenant data touched.
- [n-a] Input handling — `specIndexAdvisory` takes only `cwd` (existing CLI
  invocation pattern, not new untrusted input); no query, shell command,
  `eval`, or template rendering involved.
- [n-a] Data exposure — the new warning string names only a fixed local path
  (`.specloom/index/spec-index.json`); no user data, no logs of sensitive
  fields.
- [n-a] Secrets and credentials — none introduced, read, or logged.
- [n-a] Dependencies and integrations — no new dependency; reuses existing
  exports from `src/tokens/spec-index.js`.

## Risk rationale

No security-sensitive surface introduced. Verified directly against the diff
(`git diff -- src/cli/doctor.js`): 18 additive lines, one new pure function
(`specIndexAdvisory`) that does a single `fs.existsSync` check and pushes a
string to the pre-existing, non-blocking `warnings[]` channel — the same
channel `workflowStaleness` already uses. `healthy`/exit code computation
(`problems.length === 0`) is untouched. The rest of the change is prose in
`canonical.md` instructing agents to invoke already-existing, already-reviewed
commands (`playbook spec-index`, `playbook spec-read`, packet reads) — it adds
no new capability to the CLI's attack surface.

## Control checklist (control → evidence)

Not applicable — no `design.md`/`controls` declared for this change.

## Threat model (when required)

Not applicable — `threat_model_required: false`, no elevated-risk signal detected.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| — | — | — | — | No findings. |
