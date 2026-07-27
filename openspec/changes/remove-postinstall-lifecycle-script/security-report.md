---
schema: security-report
schema_version: 1
change_id: remove-postinstall-lifecycle-script
status: passed
risk: standard
threat_model_required: false
updated: 2026-07-27
---
# Security Report — Eliminar el postinstall que puede romper `npm install` de consumers

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: Full review. This change touches a declared supply-chain
surface (removes the package's only npm lifecycle script, `SEC-1`/`SEC-001`)
and adds a new local-filesystem read in the CLI's hot path (`SEC-2`/`SEC-002`).
No auth, tenant data, external input, or new dependency is involved, but the
supply-chain and local-read surfaces are enough to warrant the full checklist
rather than `not_applicable`.

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
- Design sets `threat_model_required: false`, `controls: [SEC-001, SEC-002]`.
- This gate does not raise the risk: the change is a **net reduction** in
  attack surface (a lifecycle script that executed automatically on every
  consumer/CI install is removed outright, replaced by two channels — a
  README instruction and a read-only local-file check — neither of which
  executes anything or crosses a trust boundary).

## Checklist

- [n/a] Authorization and access control — no endpoint, role, or permission touched; this is a CLI/npm-packaging change.
- [n/a] Ownership boundaries (IDOR) — no user/tenant object references involved.
- [pass] Input handling — `anyTargetInstalled()` (`src/install/targets.js:20-24`) takes `env`/`home` from trusted process state (`process.env`, `os.homedir()`, or test-injected values), builds a path with `path.join`, and only calls `fs.existsSync` — no external/user-controlled input reaches a shell command, `eval`, template, or query. No new argv parsing was added (`dispatch.js`'s existing `parseArgs` is untouched).
- [pass] Data exposure — the notice printed by `dispatch.js:203-205` is exactly `playbook-ai <version> — skills not installed for any target, run \`playbook install\`.`: no paths, env values, or filesystem contents are ever included. Verified explicitly suppressed under `--json` (`test/dispatch.test.js:154-164`) so machine-readable output is never contaminated by free text.
- [pass] Secrets and credentials — no secret/token/credential is read, written, or logged anywhere in the diff; grepped the two new source files for token/secret/password/api-key patterns, no hits beyond unrelated pre-existing strings (`usage-report`'s LLM-token accounting, `argv` "token" parsing comment).
- [pass] Dependencies and integrations — no dependency added, removed, or upgraded in `package.json`; the only `package.json` change is deleting the `postinstall` script entry and the now-empty `scripts/` `files` entry.

## Risk rationale

`reconciled = max(declared "standard", detected "standard") = standard`.
Detected risk does not exceed declared: this change removes an existing
supply-chain execution surface rather than adding one. The replacement
signal (README instruction + CLI notice) is inert with respect to npm's
install-time execution model — nothing runs automatically anymore, which is
the entire point of `adr-remove-postinstall-lifecycle-script.md`.

## Control checklist (control → evidence)

- **SEC-001** (no lifecycle script left to execute automatically) →
  `package.json` no longer declares `scripts.postinstall`;
  `scripts/postinstall.cjs` deleted; `test/postinstall.test.js` is a negative
  test that fails if `scripts.postinstall` reappears; `docs/security-checklist.md`'s
  postinstall row rewritten to state the surface no longer exists.
- **SEC-002** (CLI notice reads only local filesystem existence, no network,
  no writes, omitted in `--json`) → `src/install/targets.js`'s
  `anyTargetInstalled` only calls `fs.existsSync` against already-resolved
  target dirs (same primitive `doctor.js` uses); `src/cli/dispatch.js` gates
  the notice on `!parsed.flags.json`; `test/dispatch.test.js` verifies both
  the JSON-omission case and that at least one target being installed
  silences the notice.

## Threat model (when required)

Not required (`threat_model_required: false`, unchanged from design) — this
change closes an execution-surface risk rather than opening a new one, and
the replacement read is a single `fs.existsSync` against trusted paths.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| — | — | — | — | No findings. |
