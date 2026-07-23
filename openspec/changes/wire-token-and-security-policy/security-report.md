---
schema: security-report
schema_version: 1
change_id: wire-token-and-security-policy
status: passed
risk: standard
threat_model_required: false
updated: 2026-07-23
---
# Security Report — Cablear la política de tokens y seguridad en los playbooks

> This gate is an automated pre-check and does not replace a penetration test or
> a human security audit.

**Applicability**: Full review. This change *is* a security-control change — it
hardens the methodology's own security thread (SEC-1 enforcement of the
verification-report security section, SEC-2 preservation of the security gate's
full-read right, SEC-3 post-merge SEC-N re-run). The proposal declares
`risk: standard`, `triggers: []`, and all `impact.*` false. The change adds no
runtime application surface (no endpoints, auth, data model, or new dependency):
the code is a **pure** validation helper (`validateVerificationBody`) plus CLI
wiring, and the rest is playbook text (`canonical.md` → generated `SKILL.md`).
Most attack-surface categories are therefore n-a; the substantive work of this
gate is the coherence/control-evidence check (§ below).

## Checklist

- [n-a] **Authorization & access control** — no endpoints, actions, or roles. A CLI validation helper and playbook prose; no server-side authorization surface exists to enforce.
- [n-a] **Ownership boundaries (IDOR)** — no object references, no user/tenant scope. The CLI operates on local artifact files enumerated from a fixed `ARTIFACT_FILES` list (`src/config/artifacts.js`); no client-supplied identifier or path.
- [pass] **Input handling** — `validateVerificationBody(body)` consumes a markdown body read from a **local, developer-authored** artifact (`verification-report.md`), not untrusted network input. It only splits sections (`/^##\s+(.+)$/` per line) and strips HTML comments (`/<!--.*?-->/gs`); both are linear, no catastrophic-backtracking / ReDoS pattern, and nothing reaches a shell, `eval`, or template. The read path is `path.join(changeDir, <fixed name>)` — no path traversal.
- [n-a] **Data exposure** — issue strings name only section titles (e.g. `missing section: "## Security considerations"`); no secrets, PII, stack traces, or internal paths are emitted.
- [pass] **Secrets & credentials** — no secret hardcoded or committed. Diff scan for key/token/password/PEM literals is clean; test fixtures (`VALID_VERIFICATION`, etc.) contain only dummy content.
- [pass] **Dependencies & integrations** — no new dependency. `package.json` / `package-lock.json` unchanged; the only added import is relative (`../schema/body-rules.js`).

## Risk rationale

`reconciled = max(declared_risk, detected_risk) = max(standard, standard) = standard`.
No omitted signal detected that would raise the risk; the gate does not lower the
proposal's declared `standard`. Net effect of the change on the project's security
posture is **positive**: it converts a previously silent-failure surface (a
`verification-report.md` could drop its security section undetected) into a hard
validation failure, and re-runs SEC-N negatives against merged code instead of
trusting the pre-merge report.

## Control checklist (control → evidence)

| Control | Evidence | Verdict |
|---|---|---|
| **SEC-1** — the security thread cannot silently disconnect; a report without security evidence fails validation | `validateVerificationBody` + `BODY_VALIDATORS['verification-report.md']` wiring; negative tests at **unit** (`test/schema.test.js`) **and CLI** level (`test/validate.cli.test.js` — `playbook validate` exits `VIOLATION`, names the missing/empty section) | pass |
| **SEC-2** — diff-first does not weaken security judgment | `skills/sdd-security-gate/canonical.md` retains the explicit **full-read on sensitive surface** clause alongside the diff-first directive; content test asserts both `full-read` and `sensitive surface` survive | pass |
| **SEC-3** — `verify` validates against merged code, not the pre-merge report | `skills/sdd-verify/canonical.md` adds the "re-run each `SEC-N` negative against the merged code" step, the `## Security considerations` report table, and the hard rule (any `SEC-N` without post-merge evidence → `status: failed`); content test on the generated `SKILL.md` | pass |

No declared control lacks evidence; no new exposure is left uncovered by a control.

## Threat model (when required)

Not required — `risk: standard` (not elevated) and no `design.md` /
`threat_model_required` flag. No new trust boundary is introduced.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| — | — | — | — | none |

No findings. No blocking issues.

## Coherence check

Proposal `impact` (all false) ↔ `security` (`risk: standard`, `triggers: []`) ↔
implementation are consistent. There is no `design.md` (design not required), so
no `SEC-00x` controls to reconcile; the SEC-N live in the proposal's
`## Security considerations` and each is evidenced above.
