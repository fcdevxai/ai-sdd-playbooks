---
schema: security-report
schema_version: 1
change_id: multi-repo-delivery-aggregation
status: passed
risk: standard
threat_model_required: false
updated: 2026-07-23
---
# Security Report — Delivery multi-repo agregado

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: Full review — the feature reads repo names from
proposal.md content (`## Impacted repos`) and maps them to filesystem paths,
which the proposal itself flags as a sensitive surface (SEC-2). No
auth/authz, multi-tenant data, secrets, or new dependencies are involved, but
the path-resolution path warrants the full checklist.

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

- Proposal declares `security.risk: standard`, `security.triggers: []`.
- Design sets `threat_model_required: false`, `controls: [SEC-001, SEC-002, SEC-003]`.
- No signal found in the implementation that warrants raising the risk.
  `reconciled = standard` (unchanged).

## Checklist

- [n-a] Authorization and access control — local CLI tool run by the
  developer against their own filesystem; no auth/session/role model exists
  in this codebase for `playbook status`/`next` to bypass.
- [n-a] Ownership boundaries (IDOR) — no user/tenant data model; `per_repo`
  entries are derived from the operator's own `playbook.config.yaml`, not
  from any other party's data.
- [pass] Input handling — repo names originate from `## Impacted repos` in
  the change's own `proposal.md` (not third-party/network input) and are
  filtered through `^[A-Za-z0-9_.-]+$` in `extractImpactedRepos`
  ([src/repos/impacted.js:38](src/repos/impacted.js:38)) before ever reaching
  `resolveMultiRepoDelivery`. Path resolution
  ([src/repos/delivery.js:89-95](src/repos/delivery.js:89)) only resolves
  names present as keys in `config.repos` via `resolveConfiguredRepoPath`
  ([src/repos/config.js:72-88](src/repos/config.js:72)) — an undeclared name
  never reaches `path.resolve` and falls to `unknown`/`REPO_PATH_UNRESOLVED`
  instead (verified by `test/delivery.test.js`: "impacted repo not declared
  in config.repos → unknown, resolveOne never called for it", which also
  asserts no filesystem call happens for the undeclared name). Git/GitHub
  calls use `execFileSync('git'|'gh', args, { cwd })`
  ([src/github/index.js:22-27](src/github/index.js:22)) — argv array, no
  shell interpolation, so `cwd` cannot inject into the command line.
- [pass] Data exposure — `playbook status`/`--json` outputs are delivery
  state enums (`merged`/`ci_pending`/…), repo names, and resolved local
  paths that are already present in the operator's own
  `playbook.config.yaml`; no new sensitive fields, no secrets, no stack
  traces added to output.
- [n-a] Secrets and credentials — no new secret/token/credential handling;
  `gh`/`git` auth continues to come from the operator's existing local
  environment, unchanged by this feature.
- [pass] Dependencies and integrations — no new production dependency
  (`js-yaml`/`gray-matter` are pre-existing, `js-yaml` used only in test
  code); no new third-party integration; `resolveDelivery` is reused
  verbatim, no new network surface.

## Risk rationale

No new attack surface reachable by an untrusted party: the only external
input relative to the *operator* is `proposal.md`/`playbook.config.yaml`
content the operator (or their team) authored themselves. The fail-closed
design (`unknown` has top precedence in `reduceDelivery`,
[src/repos/delivery.js:19](src/repos/delivery.js:19)) means the worst
outcome of a misconfiguration is an over-cautious block (never a false
`merged`), which matches `risk: standard` with no elevation warranted.

## Control checklist (control → evidence)

| Control | Evidence |
|---|---|
| SEC-001 (fail-closed) | `PRECEDENCE` places `unknown` first ([src/repos/delivery.js:19](src/repos/delivery.js:19)); `test/delivery.test.js` "GitHub unavailable repo mixed with merged → unknown, never merged" |
| SEC-002 (repo name → path, no traversal) | `extractImpactedRepos` regex filter + `resolveConfiguredRepoPath` restricted to `config.repos` keys; `test/delivery.test.js` "impacted repo not declared in config.repos → unknown, resolveOne never called for it" |
| SEC-003 (no persistence) | `resolveMultiRepoDelivery` performs no writes (inspected — no `fs.write*` calls in [src/repos/delivery.js](src/repos/delivery.js)); `status.js` attaches `per_repo` to the in-memory render result only, never to `sdd.lock` |

## Threat model (when required)

Not required (`threat_model_required: false`) — no new auth/PII/secrets
surface introduced.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| — | — | — | — | No findings. |
