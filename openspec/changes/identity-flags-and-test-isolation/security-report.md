---
schema: security-report
schema_version: 2
change_id: identity-flags-and-test-isolation
status: passed
risk: low
threat_model_required: false
created: '2026-10-10'
updated: '2026-10-10'
source_binding:
  manifest_path: >-
    openspec/changes/identity-flags-and-test-isolation/handoff-manifest-sdd-security-gate-b20c01d068a42249dd41b5492d730d5f567a88f126e454b65db9fb2e58e67d41.json
  manifest_hash: b20c01d068a42249dd41b5492d730d5f567a88f126e454b65db9fb2e58e67d41
  governed_manifest_hash: f15b20308f963c59bac3779e1493c482ccb446ecadb774ef2a2f1180dbcce1d6
  repositories:
    - name: loom
      branch: identity-flags-and-test-isolation
      commit_sha: 20c7248b72aba0c012aea80dba7bacdc492bfc70
      source_hash: 6e54a418f5f1aaa83e6a075c5a4a883ccfb4a3510652411af5ccfea8bced80d8
      tree_hash: 37323d1101847192fb02aef35cbc876a86d3e55be573c39b28d3411935114b5b
  proposal_hash: dcf1a5181d681791ace333f8d28f6e34b28539b95f27e219de3f9aa3c8873f3b
  design_hash: unknown
  normative_tasks_hash: 4f78b58495e6f9418fe2114a8ebfd4e7e3def41be60c5d999b13071fced409c2
  contract_hashes:
    - path: openspec/specs/contracts/openapi.yaml
      hash: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
  receipts:
    - repository: loom
      path: .specloom/runs/1791643436763-1300a116-I3AffC/execution-receipt.json
      sha256: c477702f905826fc0036bedae37936f62afaf4139f1cb8e168cd1c01190bd224
    - repository: loom
      path: .specloom/runs/1791643437448-ca1f5bf0-HUznLW/execution-receipt.json
      sha256: 9a9d0ff97d813b029e7a50bb56959562c913abfda41325675164629aa9ad8b59
    - repository: loom
      path: .specloom/runs/1791643474106-c1515430-3MrHEw/execution-receipt.json
      sha256: edb0e6d12dbbe7ba8a85013492dea80a5ddffe0fcf1449f4da1033ac4c4aeecc
  delivery_state: uncommitted
---
# Security Report — Agent identity flags in skills and isolated test temporary directories

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

Reviewer: claude, provider anthropic, model claude-opus-5-5 (declared). Same session that
implemented the change.

**Applicability**: Full review. The change has no authentication, user data, external
service or secret surface, but the new test runner deletes a directory recursively and reads
`TMPDIR` from the environment, so the deletion scope (SEC-1) and the identity text (SEC-2) are
reviewed against the checklist instead of being declared `not_applicable`.

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

## Checklist

- [n-a] Authorization and access control — no endpoint, action, role or permission changed.
- [n-a] Ownership boundaries (IDOR) — no object references or user data.
- [pass] Input handling — the runner's inputs are file arguments and the inherited `TMPDIR`. File arguments go to `spawn(process.execPath, ['--test', ...files])` without a shell, so they cannot become shell syntax. `TMPDIR` only chooses the parent of `fs.mkdtempSync`; the path removed is always the one `mkdtempSync` returned, and `removeRunRoot` refuses anything that is not a real directory, a direct child of the parent and prefixed `playbook-test-run-` (SEC-1). Scan: no `shell: true`, `eval`, `new Function` or template `execSync` added.
- [pass] Data exposure — the runner prints only its own error message (the parent path and the `mkdtemp` error) on EC-3; skills add text only. No receipt, manifest or log format changed.
- [pass] Secrets and credentials — no credential-shaped literal in any added line or new file (scan below); the identity example uses `<model-id>`, not a token.
- [pass] Dependencies and integrations — dependency fields unchanged; no npm lifecycle script declared (`scripts.test` changed only); no new integration.

## Risk rationale

Declared `risk: low` with no triggers. Detected risk is also low: the only destructive
operation is the removal of the run's own temporary root, bounded by SEC-1 and covered by a
negative test. Reconciled risk: `low`. No threat model required. Under ADR-043 (honest-error
threat model) a developer who points `TMPDIR` at an unusual parent still only loses the
runner's own `playbook-test-run-*` child; a deliberate local race (TOCTOU) between `lstat` and
`rmSync` is outside the accepted threat model, as for the rest of the CLI.

## Control checklist (control → evidence)

| Control | Evidence |
|---|---|
| SEC-1: removes only its own root under the parent | `test/run-tests.test.js` "SEC-1: …" refuses the outside directory, the parent, an unrelated child, a nested prefixed root, a prefixed symbolic link, traversal and `/`, and removes a real root; receipt `1791643437448-ca1f5bf0-HUznLW` (7 runner tests). EC-1/EC-2/AC-3 tests also assert the parent is empty after each exit path. |
| SEC-2: identity declared, not observed | identity rule in the seven skills ("declared by the caller, never observed by the CLI"), enforced by the skill contract test (receipt `1791643474106-c1515430-3MrHEw`, 65 tests); no CLI, receipt or manifest code changed (diff scope in `code-review-report.md`). |
| No secrets, unsafe execution or new dependencies | scan of the 34 files changed since `20c7248` (14 untracked): receipt `1791643436763-1300a116-I3AffC`, "no findings". |

## Threat model (when required)

Not required (`risk: low`, no triggers).

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| — | — | — | — | No findings. |
