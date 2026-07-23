---
schema: security-report
schema_version: 1
change_id: bootstrap-repos-diff-on-rerun
status: not_applicable
risk: standard
threat_model_required: false
updated: 2026-07-23
---
# Security Report — Detectar repos hermanos nuevos en re-ejecuciones de sdd-bootstrap-project

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: not_applicable — per SEC-1 in `proposal.md`. This change
edits only `skills/sdd-bootstrap-project/canonical.md` (+ its regenerated
`SKILL.md`) and `test/skill-contract.test.js`. It adds one instruction paragraph
telling the AI executing the skill to re-invoke an existing, unmodified,
read-only filesystem detector (`detectSiblingRepos` in
`src/config/detect-siblings.js`, untouched by this change) on every re-run, and
one regression test asserting that instruction's presence in the skill text.

None of the applicability triggers apply:
- **Authentication/authorization/roles** — not touched; no endpoint, controller,
  or permission logic changed.
- **User/tenant data** — not touched; the detector reads local directory names
  and `.git` presence only, never file contents, and the fix does not change
  what it reads.
- **External input** — not touched; no new input surface, form, upload, query
  param, or webhook.
- **Secrets/tokens/credentials** — not touched; nothing hardcoded, no new
  config values, no `.env`/secret-manager interaction.
- **New dependency/integration** — none added.

The `sdd-bootstrap-project` diff-then-approve contract is unchanged: the skill
still never writes `playbook.config.yaml` without explicit human approval; this
fix only changes when the (already-approved, read-only) detector step is
re-invoked and what subset of its output is shown to the human, not what gets
written or under what authorization.

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

`proposal.md` declares `security.risk: standard`, `security.triggers: []`. No
design.md exists (`design_required: false`); no `controls`/`threat_model` apply.
Reconciled risk stays at the declared `standard` — nothing in the diff raises it
(no omitted signal detected: the diff is exactly the two files declared in
`## Impacted modules`, both prompt/test text, no code-path change).

## Checklist

- [n-a] Authorization and access control — no endpoint/action changed.
- [n-a] Ownership boundaries (IDOR) — no object reference/ID handling involved.
- [n-a] Input handling — no external input surface changed; the detector's only
  "input" is local directory names, already read the same way before this fix.
- [n-a] Data exposure — no response/log/error path changed.
- [n-a] Secrets and credentials — none introduced or touched.
- [n-a] Dependencies and integrations — no new dependency.

## Risk rationale

Instruction-only change to an already-approved, human-gated, read-only
onboarding skill. The write path (`playbook.config.yaml`) and its
human-approval gate are unmodified; only the re-detection trigger condition
changed.

## Control checklist (control → evidence)

Not applicable — no `design.md`/`controls` for this change (`design_required: false`).

## Threat model (when required)

Not applicable — `threat_model_required: false`.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| — | — | — | — | No findings. |
