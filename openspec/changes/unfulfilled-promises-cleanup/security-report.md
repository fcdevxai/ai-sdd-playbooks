---
schema: security-report
schema_version: 1
change_id: unfulfilled-promises-cleanup
status: passed
risk: standard
threat_model_required: false
updated: 2026-07-24
---
# Security Report — Cerrar las promesas incumplidas del CLI, la distribución y las specs

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: Full review — this change adds a new lifecycle-script
supply-chain surface (postinstall), introduces filesystem containment for
config-derived paths, and adds a symlink-writing install mode.

## Rules

- Never lower an approved risk level automatically; you may raise it with justification.
- Any blocking finding → `status: blocked`.
- Always include the non-replacement disclaimer in the report and CLI output.
- Do not claim the change is "secure" — claim only that the declared controls
  have (or lack) evidence.
- Do not propose scope expansion beyond the approved feature.

## Risk model

- Proposal declares `security.risk: standard`, `triggers: [critical_dependency, infrastructure]`.
- Design sets `threat_model_required: false`, `controls: [SEC-001, SEC-002, SEC-003, SEC-004]`.
- Reconciled risk: **standard** (no undeclared exposure detected; not raised).

## Checklist

- [n-a] Authorization and access control — CLI tool, no user/tenant/role concept
- [n-a] Ownership boundaries (IDOR) — no multi-tenant object references
- [pass] Input handling — `contract.path_in_loom` (config-derived path) is the only
  external-input surface; contained via `resolveContainedPath` (SEC-003)
- [pass] Data exposure — manifest (digests, and in link mode a local dev path) never
  reaches `playbook.lock` or the consumer repo; confirmed against raw lock bytes
- [pass] Secrets and credentials — grep across all changed files: no hardcoded
  secrets/keys/tokens
- [pass] Dependencies and integrations — `git diff main...unfulfilled-promises-cleanup --
  package.json package-lock.json` is empty; no new dependency added

## Risk rationale

No undeclared exposure found; declared `standard` risk holds. The postinstall
surface (highest inherent risk in this change, since it runs on every consumer
install/CI) is constrained to a message-only script with no filesystem, network,
or `src/` access — enforced by both static checks and a behavioral test
(`test/postinstall.test.js`) that runs the script under a broken `package.json`
and asserts silent exit 0.

## Control checklist (control → evidence)

- **SEC-001** (postinstall supply-chain) → `scripts/postinstall.cjs`: only
  `node:fs`/`node:path` requires, single try/catch with empty catch (never
  rethrows), ≤2 `console.log` lines, no fs-write/network calls anywhere.
  `.cjs` (not `.js`) so it parses as CommonJS regardless of any package.json's
  `"type"` field — a Node 18 CI run caught that the original ESM `.js` version
  hit a hard `SyntaxError` (outside the try/catch) when copied to a directory
  with no resolvable `package.json`, defeating the EC-4 guarantee; this is
  the fix. `package.json` declares only `postinstall` (no
  `prepare`/`preinstall`/`install`), script listed in `files:`. Evidence:
  `test/postinstall.test.js` (structural + behavioral, incl. EC-4
  broken-`package.json` case → exit 0, silent).
- **SEC-002** (lock file leak) → `src/cli/sync.js`: reads only the one-line
  `.playbook-version` stamp, never `.playbook-manifest.json`; writes only that
  stamp to `playbook.lock.methodology.resolved`. Evidence: `test/sync.test.js:35-54`
  asserts against raw lock file bytes (`doesNotMatch(/link/)`,
  `doesNotMatch(/mode/)`, no source path) after an `install --link` + `sync` run.
- **SEC-003** (path containment) → `src/util/fs-safe.js:58-82`
  `resolveContainedPath`: containment check appends `path.sep` before
  `startsWith` (rejects the classic `/root` vs `/root-evil` sibling-prefix
  bypass), plus a symlink-escape check via `fs.realpathSync` on the nearest
  existing ancestor. Used in `src/cli/repos.js:150-158` — rejects with
  `EXIT.USAGE` before any read is attempted. Evidence: `test/fs-safe.test.js:47-71`,
  `test/repos.test.js:528-550`.
- **SEC-004** (symlink writes in link mode) → `src/install/skills.js:62-80`: link
  targets are built only from package-controlled skill names (`fs.readdirSync`
  over the package's own `skills/`) filtered through a fixed
  `INSTALLABLE_FILES` set (`SKILL.md` only); symlinks always point at
  `path.join(src, entry.name)` under the declared `sourceRoot`. No
  attacker/config-supplied path ever reaches `fs.symlinkSync`. Evidence:
  `test/install.test.js:131-156` (SEC-004 negative test: no file/symlink created
  outside the target).

## Threat model (when required)

Not required (`threat_model_required: false`).

## Findings

| id | severity | blocking | location | remediation |
|----|----------|----------|----------|-------------|
| — | — | — | — | No findings. All four declared controls (SEC-001..SEC-004) have concrete, test-backed evidence; no undeclared exposure detected. |
