---
schema: security-report
schema_version: 1
change_id: restore-contract-first
status: not_applicable
risk: standard
threat_model_required: false
updated: 2026-07-23
---
# Security Report — Contract-first operativo

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: not_applicable — reasoning below (SEC-1 covers the one real
surface this change touches; the rest of the checklist finds no exposure).

## Checklist
- [n-a] Authorization and access control — no endpoint, route, or authorization logic is added or modified. `contract-drift.js` (unchanged) only reads and structurally diffs OpenAPI YAML/JSON files passed as CLI args; it has no auth surface.
- [n-a] Ownership boundaries (IDOR) — no object/user/tenant data model introduced; the change adds template files and a config section, not runtime data access.
- [n-a] Input handling — the only "input" is an OpenAPI document path, parsed with `js-yaml`/`JSON.parse` (already in use, unchanged) and never passed to a shell command, `eval`, or template renderer. No new external input path.
- [pass] Data exposure — `contract-drift`'s output only echoes endpoint/field names already present in the OpenAPI documents it's given; it introduces no logging of secrets/tokens. Verified for the shipped CI template specifically (SEC-1 below).
- [pass] Secrets and credentials — SEC-1 declared in the proposal. `test/contract-first.test.js` ("SEC-1: ...") asserts `contract-drift-check.yml` contains no `${{ secrets. }}` reference, no `password:` pattern, and no private-key block. The template's two TODOs (hub checkout, OpenAPI generation) are placeholders for the consuming backend's own CI config — this repo ships no credential material.
- [n-a] Dependencies and integrations — no new npm dependency added (`js-yaml` was already a runtime dependency, used unchanged by `contract-drift.js`); no new third-party integration.

## Risk rationale

`reconciled = max(declared_risk, detected_risk) = max(standard, low) = standard` — no upward reclassification. The proposal declared `security.risk: standard` with `triggers: []`; nothing found during review introduces authentication, authorization, personal/sensitive data, or a new external integration, so no signal warrants raising it to `elevated`. `threat_model_required: false` — no elevated risk, no `authorization`/`personal_data`/`secrets`/`payments` trigger present.

## Control checklist (control → evidence)

No `design.md` was produced (design not required: all `impact.*` flags are `false`), so there are no declared `controls` (`SEC-00x`) to cross-check. The one concrete security assertion in `proposal.md` — SEC-1 ("no secrets/credentials in the CI template") — is covered directly: see "Secrets and credentials" above and `test/contract-first.test.js`.

## Threat model (when required)

Not required (`threat_model_required: false`).

## Findings

None. No blocking finding.

## Notes

Post-approval addendum, with explicit human sign-off (not a security finding
— recorded here per the proposal's cross-reference): `runtime_relevant_capabilities: []`
was added to `proposal.md` after `sdd-security-gate`, before `sdd-runtime-gate`.
The project capability `cli: true` (this framework has a CLI surface,
`bin/playbook.js`) is real and unchanged, but this specific change adds no new
CLI command and modifies no existing command's behavior — it only adds
template artifacts, a config section, and tests. Excluding it from
`runtime_relevant_capabilities` reflects that this change genuinely does not
exercise the CLI adapter's surface, not an attempt to route around a block.
`http`/`browser`/`worker` were already `false` in `playbook.config.yaml` and
unaffected by this addendum.
