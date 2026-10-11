---
schema: security-report
schema_version: 2
change_id: bounded-review-loops
status: passed
risk: standard
threat_model_required: false
updated: '2026-10-11'
source_binding:
  manifest_path: >-
    openspec/changes/bounded-review-loops/handoff-manifest-sdd-security-gate-e85286bd3a237d7872b9dd7f37370bb4fbc51767f0cc31994a94c711dece78b5.json
  manifest_hash: e85286bd3a237d7872b9dd7f37370bb4fbc51767f0cc31994a94c711dece78b5
  governed_manifest_hash: 806e0ee736b902307e0b846a0f02f2ad19c189550be4de0d49d8434d98f8c7a8
  repositories:
    - name: loom
      branch: bounded-review-loops
      commit_sha: 749bc97cede527899499a796505801c6060adedc
      source_hash: bf1752a93a0d95e5d9986f9698001592d1ba7f2304fd8557d04b43aeac7bb445
      tree_hash: 08506e2484d23cab7966e6e51da8c33c873d407ba6159ba258138bbe87605954
  proposal_hash: 65fc6807733cc85c8f48f73ee25b071efc5a8400a1eed084ca94cfc96054ec41
  design_hash: unknown
  normative_tasks_hash: 4cf491efd4a5ceb78e989af8f78976f7474ae433606d5960bc0cf64224cd1f5a
  contract_hashes:
    - path: openspec/specs/contracts/openapi.yaml
      hash: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
  receipts:
    - repository: loom
      path: .specloom/runs/1791748526792-e743c175-H8vFJP/execution-receipt.json
      sha256: 419da20d166df9e4b4230d2ae58f66075176f04ed0191e458e68e8d7b2ace25c
    - repository: loom
      path: .specloom/runs/1791748541894-8472b89e-HRzkH1/execution-receipt.json
      sha256: 92768d1b222efe2bfd6e489de16a60f9f5fe4650ee4e0b96f3fb445c47f5635a
    - repository: loom
      path: .specloom/runs/1791748570393-b56eeb21-HMwrFG/execution-receipt.json
      sha256: 6d0683bd401f88c5bc10c32edbd7325c464b5b46f4f879c64a148916c4874165
  delivery_state: uncommitted
---
# Security Report — Bounded review loops, bounded sensitive designs and a released global CLI

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: Full review. The change edits security-gate instructions and
adds a read-only `git` subprocess to `playbook doctor` (SEC-1 to SEC-5). It adds
no authentication, tenant data, external endpoint, dependency or integration.
The approved proposal declares `security.risk: standard` and `triggers: []`;
no `design.md` is required.

## Checklist

- [n/a] Authorization and access control — No endpoint, role, permission or
  authorization decision changes. SEC-1 still names every always-blocking
  authorization class in `skills/sdd-security-gate/canonical.md` and its
  generated `SKILL.md`.
- [n/a] Ownership boundaries (IDOR) — No user or tenant objects are read or
  written. SEC-1 still makes cross-tenant access blocking.
- [pass] Input handling — SEC-4: `src/cli/doctor.js:129-135` uses `execFileSync`
  with four fixed argument arrays, `cwd` set to the module-derived package root,
  a 2-second timeout and no shell. It removes inherited `GIT_*` selectors except
  the fixed `GIT_NO_REPLACE_OBJECTS=1`. The negative test at
  `test/doctor.test.js:112` passed. A real-Git run with `GIT_DIR` set to a
  nonexistent repository still inspected this package worktree and exited 0.
- [pass] Data exposure — SEC-4: the warning uses the package root, short commit,
  tag names and a changed-tree boolean; the note uses fixed failure categories,
  not raw Git stderr. No new response, log or error path exposes sensitive data.
- [pass] Secrets and credentials — No added secret or credential use. A scan of
  added tracked lines and new change artifacts found no common private-key or
  token signatures. This is a targeted check, not a guarantee against every
  credential format.
- [pass] Dependencies and integrations — `package.json` and `package-lock.json`
  change only the package version to `0.11.0`; the CI templates change only the
  install version. There is no new dependency or third-party integration.

## Risk rationale

Risk remains **standard**, as approved. The new process invocation is local,
read-only, bounded by a timeout and independent of user-supplied repository
selectors. The changed security instructions preserve the always-blocking
classes and the rule that risk may rise but never falls automatically (SEC-1,
SEC-5). The evidence did not show a new exposure requiring elevated risk.

## Control checklist (control → evidence)

| control | evidence |
|---|---|
| SEC-1 | `skills/sdd-security-gate/canonical.md:135-138,208-210` and generated `SKILL.md` retain the always-blocking classes; the skill contract test passed. The changed code has no authorization, tenant-data, query or template path. |
| SEC-2 | `skills/sdd-security-gate/canonical.md:140-148` keeps a failing delta report unsealed and stops after the second round; the skill contract test passed. |
| SEC-3 | `skills/sdd-security-gate/canonical.md:182-186` includes severity, unmet condition, owner and destination in `## Follow-ups`; the skill contract test passed. F-1 is recorded below. |
| SEC-4 | `src/cli/doctor.js:129-167`, `test/doctor.test.js:68-134`, the 92-test receipt and the real-Git `GIT_DIR` receipt. The latter reported this worktree at `749bc97`, no tags, changed tree, and no note despite the invalid selector. |
| SEC-5 | `skills/sdd-security-gate/canonical.md:30-37,135-138` retains “may raise, never lowers”; this report keeps the approved `standard` risk. |

## Threat model (when required)

Not required: proposal risk is `standard`, triggers are empty and this change
has no design. The practical boundary reviewed here is a caller-controlled
environment around `playbook doctor`; `GIT_*` repository selectors must not
redirect its local Git inspection.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| None | — | no | — | No blocking security finding in this full round. |

## Follow-ups

| finding | severity | unmet condition | owner | destination (new change, issue, accepted as-is) |
|---|---|---|---|---|
| F-1 — With translated Git stderr, a package install outside a checkout may get the fixed note `release provenance could not be checked: git failed (128)` instead of no provenance message. This changes only advisory text; it does not expose Git stderr, change `healthy` or change the exit code. | low | The localized Git case was not reproduced in the real code path on this host, which has no Git translations installed; the third blocking condition is unmet. No always-blocking SEC-1 class is involved. | Methodology maintainer | Open a small follow-up issue/change to set `LC_ALL=C` for the provenance Git calls and verify a package install under a translated locale. |

F-2 is resolved by the `GIT_*` filter and is covered by the real-Git run above.
F-3 and F-4 are wording gaps accepted by code review for `0.11.0`; neither
changes a security control in this gate.

## Review rounds

| round | full or delta | date | commit reviewed | blocking findings | result |
|---|---|---|---|---|---|
| 1 | full | 2026-10-11 | `749bc97` plus uncommitted `bounded-review-loops` worktree (source hash `bf1752a93a0d95e5d9986f9698001592d1ba7f2304fd8557d04b43aeac7bb445`) | 0 | passed |

## Evidence receipts

- Doctor and skill contract tests: `.specloom/runs/1791748526792-e743c175-H8vFJP/execution-receipt.json` (92 passed).
- Real Git with invalid `GIT_DIR`: `.specloom/runs/1791748541894-8472b89e-HRzkH1/execution-receipt.json` (exit 0; inspected package root).
- Targeted secret-signature scan: `.specloom/runs/1791748570393-b56eeb21-HMwrFG/execution-receipt.json` (exit 0; no matches).
