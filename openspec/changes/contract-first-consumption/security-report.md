---
schema: security-report
schema_version: 1
change_id: contract-first-consumption
status: passed
risk: standard
threat_model_required: false
updated: 2026-07-27
---
# Security Report — Cerrar el circuito de contract-first: autoría → consumo → multi-repo

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: Full review. The change adds filesystem reads derived from
`playbook.config.yaml` (`contract.path_in_loom`, `contract.provided_by`,
`contract.consumed_by`) that feed both code (`packet.js`, `validate.js`) and
three skill texts (`sdd-design`, `sdd-plan`, `sdd-apply`) — squarely the
config-derived-read surface ADR-035 hardened.

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

- Proposal declares `security.risk: standard`, `security.triggers: [infrastructure]`;
  no `authentication`/`authorization`/`cross_repository`/`data_model` impact.
- Design sets `threat_model_required: false` (no new network surface, no
  personal data, no auth) and lists `controls: [SEC-001, SEC-002, SEC-003]`.
- This gate does not raise the risk level: the underlying surface (config-derived
  filesystem reads) was already anticipated and is mitigated in the code path;
  the finding below is a documentation/wiring gap in that mitigation's coverage,
  not a newly discovered exposure of a different kind.

## Checklist

- [n-a] Authorization and access control — no auth/roles touched (`impact.authentication/authorization: false`).
- [n-a] Ownership boundaries (IDOR) — no user/tenant-scoped data introduced.
- [pass] Input handling — F-1 fixed: `sdd-plan` and `sdd-apply` now carry the same containment guard as `sdd-design`'s write path.
- [pass] Data exposure — the packet's `## Contract` section only ever writes `path_in_loom`/`provided_by`/`consumed_by`; no secrets, tokens, or PII pass through it.
- [pass] Secrets and credentials — no secrets touched; `templates/project/playbook.config.yaml`'s new example fields (`provided_by`, `consumed_by`) are plain repo names.
- [pass] Dependencies and integrations — no new dependency (`package.json`/`package-lock.json` unchanged).

## Risk rationale

Reconciled risk stays **standard**, unchanged from the proposal/design. F-1
was a control-coverage gap in an already-anticipated surface, not a new class
of exposure — it did not, by itself, warrant raising the risk tier. It has
since been fixed (see Findings).

## Control checklist (control → evidence)

- **SEC-001** (config-derived contract read must go through
  `resolveContainedPath`, "aplica tanto al código nuevo... como al texto de los
  skills, que debe instruir la contención, no solo la lectura" — design.md:206-213):
  - Code evidence: **present and verified**. `contractSection()` in
    [packet.js:97](src/tokens/packet.js#L97) calls `resolveContainedPath(cwd, contract.path_in_loom)`
    before ever building the packet's `## Contract` section, and
    `test/contract-first.test.js` has three passing negative tests (`..`
    escape, absolute-path escape, symlink escape — all three rejected before
    any read is attempted).
  - Skill-text evidence: **present** (fixed — see F-1). `sdd-plan/canonical.md`
    and `sdd-apply/canonical.md` now carry the same "must stay **inside the
    repo** — if it escapes the project root, stop and report it instead of
    reading" guard `sdd-design/canonical.md` already had for its write path.
    `test/skill-contract.test.js` asserts the wording in both, and
    `npm run generate:check` confirms `SKILL.md` is in sync.
- **SEC-002** (`provided_by`/`consumed_by` resolve via `resolveConfiguredRepoPath`,
  no repo-containment forcing): evidence present and verified.
  [validate.js:100](src/cli/validate.js#L100) `contractRoleErrors()` calls
  `resolveConfiguredRepoPath(name, { cwd })` for every declared name, and
  `test/contract-first.test.js` has passing negative tests for an unknown
  `provided_by` and an unknown `consumed_by` entry, both failing with a clear
  message and no filesystem access (`requireDirectory` defaults to `false`).
- **SEC-003** (declaring `provided_by` does not install `contract-drift` in
  that repo's CI — documentation-only control): evidence present.
  `skills/sdd-apply/canonical.md` states explicitly "Declaring
  `contract.provided_by` does not install `contract-drift` in this repo's CI
  by itself — that stays a manual template step," and
  `templates/project/playbook.config.yaml`'s new comment block reiterates the
  provider/consumer split without implying automatic CI wiring.

## Threat model (when required)

Not required (`threat_model_required: false`) — no new network surface, no
personal data, no authentication change. Not produced.

## Findings

| id | severity | blocking | location | remediation |
|----|----------|----------|----------|--------------|
| F-1 | medium | fixed | [skills/sdd-plan/canonical.md](skills/sdd-plan/canonical.md) (step 1, "Contract-first planning"), [skills/sdd-apply/canonical.md](skills/sdd-apply/canonical.md) (step 2, "Contract-first implementation") | Design.md (SEC-001) requires the containment instruction to appear in skill text, not only in code. `sdd-design` already carried it for its *write* path; `sdd-plan`/`sdd-apply` did not for their *read* path, so an agent following the un-fixed text had no instruction to verify containment before reading a `contract.path_in_loom` that might escape the repo. **Fix applied**: both skills now carry "The resolved path must stay **inside the repo** — if it escapes the project root, stop and report it instead of reading," `test/skill-contract.test.js` gained two assertions for the wording (58/58 passing), `npm run generate` regenerated the derived `SKILL.md` files, and `npm run generate:check` + `npm test` (432/432) confirm no drift and no regression. |
