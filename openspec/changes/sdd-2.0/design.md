---
schema: design
schema_version: 1
change_id: sdd-2.0
title: "SDD 2.0 — Technical design"
status: approved
owner: felipe.campos
created: 2026-07-14
updated: 2026-07-14
depends_on: proposal.md
security:
  risk: elevated
  threat_model_required: true
  controls:
    - SEC-001
    - SEC-002
    - SEC-003
    - SEC-004
    - SEC-005
    - SEC-006
---

# SDD 2.0 — Technical design

Technical contract for `proposal.md`, incorporating the mandatory corrections C-01…C-12. Machine-readable identifiers (command names, field names, statuses, capability keys, reason codes, schema `$id`s) are stable in English. Human-readable bodies may use the project language.

---

## 1. Package and CLI architecture

### 1.1 Package shape

```jsonc
// package.json (relevant fields)
{
  "name": "@fcdevxai/sdd",
  "version": "2.0.0",
  "type": "module",
  "bin": { "sdd": "bin/sdd.js" },
  "files": ["bin/", "src/", "skills/", "addons/", "schemas/", "templates/"],
  "engines": { "node": ">=18" }
}
```

`bin/sdd.js` is a thin argv dispatcher; all logic lives in `src/` so it is unit-testable without spawning a process.

### 1.2 Command surface

```
sdd install      Install/refresh core skills into the global agent dirs.
sdd init         Scaffold/connect project-local structure (never overwrites).
sdd doctor       Read-only diagnostics (optionally --fix for safe additive fixes).
sdd status       Print BOTH dimensions: lifecycle + GitHub delivery.
sdd next         Print the single next valid action (combines both dimensions).
sdd validate     Validate artifacts/config against schemas (--ci for pipelines).
sdd sync         Reconcile installed global skills with the compatible range; update resolved.
sdd migrate      Convert a 1.x consumer to 2.0 (diff-then-confirm).
```

Global flags: `--json`, `--cwd <path>`, `--config <path>`, `--quiet`, `--yes` (assume confirmation; `migrate`/`--fix` still print the diff first).

### 1.3 Module layout

```
src/
├── cli/            install.js init.js doctor.js status.js next.js validate.js sync.js migrate.js dispatch.js
├── lifecycle/
│   ├── model.js            # lifecycle state table + transitions + delivery state table (§3)
│   ├── engine.js           # pure: compute {lifecycle, delivery, next} (§3.4)
│   ├── impact.js           # design-required predicate from structured impact (§4.4, C-03)
│   └── preconditions.js    # per-skill precondition predicates (§3.6)
├── schema/         load.js  validate.js
├── config/         config.js  lock.js  docmap.js
├── github/         repository.js  pull-request.js  checks.js  auth.js   # GitHub delivery (C-01, C-10, C-11)
├── adapters/       browser.js  http.js  cli.js  worker.js                # runtime-gate descriptors (§7)
└── util/           fs-safe.js  diff.js  log.js
```

Design rules:

- `lifecycle/engine.js` is **pure**: `(config, lock, artifactIndex, deliveryStatus) → { lifecycle, delivery, next, blockedReason }`. It performs no filesystem, model, or network calls. The **delivery** input is supplied by `src/github/` (or `unknown`); the engine only combines dimensions.
- The CLI never asks a language model to decide state or next step. Skills call a model to *do work*; they read the CLI's answer for *what* to do.
- All destructive/outward-facing behavior funnels through `util/fs-safe.js`, which refuses to overwrite without a per-file confirmation token.

### 1.4 Exit codes

`0` healthy/passed · `1` schema or state violation (CI-actionable) · `2` blocked (a gate found blocking issues) · `3` usage error · `4` environment/precondition error (e.g. global skills missing, incompatible version, GitHub context unavailable when required).

---

## 2. Install model — global methodology, local context

### 2.1 Targets

| Runtime | Skill directory |
|---|---|
| Claude Code | `~/.claude/skills/<skill-name>/SKILL.md` |
| GitHub Copilot | `~/.agents/skills/<skill-name>/SKILL.md` |

Resolved by `src/install/targets.js` from `$HOME` (overridable by `SDD_CLAUDE_SKILLS_DIR` / `SDD_AGENTS_SKILLS_DIR`). `sdd install` copies each `skills/<name>/` into both dirs, stamps the version, installs **core only** (add-ons need `--addon`), and creates **no** consumer-repo files.

### 2.2 One skill, two runtimes

```yaml
---
name: sdd-plan
description: "<one-line trigger description used by both loaders>"
lifecycle_stage: plan
produces: [tasks.md]
requires:
  artifacts:
    proposal.md: { status: approved }
    design.md: { status: [approved, not_applicable], when: design_required }   # enforced only when design is required (§4.4)
  capabilities: []
version: 2.0.0
---
```

Both runtimes read the same file; no per-runtime generation is required for the core path. Legacy `.claude/commands` generation is retained transitionally (§8.5) but is not how 2.0 skills are consumed.

---

## 3. Deterministic state model — two dimensions (C-01)

The engine reports two **independent** dimensions. The methodological `lifecycle` is computed from local artifacts; the `delivery` state is resolved from local Git and GitHub. Example `sdd status --json`:

```yaml
lifecycle:
  state: runtime_cleared
delivery:
  provider: github
  state: ci_pending
```

### 3.1 Lifecycle states (methodological, local)

| # | State | Entry condition (computed from artifacts) |
|---|---|---|
| 1 | `proposal_draft` | `proposal.md` exists, `status: draft` |
| 2 | `proposal_approved` | `proposal.md` `status: approved` (human gate) |
| 3 | `designed` | `design.md` `status: approved`, **or** `design_required == false` (design not required, §4.4 — no file needed) |
| 4 | `planned` | `tasks.md` `status: ready` |
| 5 | `implementing` | `tasks.md` `status: in_progress` |
| 6 | `implemented` | `tasks.md` `status: passed` |
| 7 | `reviewed` | `code-review-report.md` `status: passed` |
| 8 | `security_cleared` | `security-report.md` `status: passed`/`not_applicable`, no blocking findings |
| 9 | `runtime_cleared` | `runtime-gate-report.md` `status: passed`/`not_applicable` |
| 10 | `verified` | `verification-report.md` `status: passed` (requires `delivery: merged`) |
| 11 | `archived` | change archived into `openspec/specs/<domain>/spec.md` |

`sdd-enrich-us` is a **pre-process** and has no lifecycle state (C-02): the first state, `proposal_draft`, is produced by `sdd-new`.

`failed` and `blocked` are **exception views** (§3.5), not extra linear states: any artifact in `status: failed`/`blocked`, or any blocking security finding, overrides the reported lifecycle to a blocked view whose `next` is the remediation step.

### 3.2 Delivery states (local Git + GitHub)

Delivery is resolved from **two sources**:

- **Local Git** (`src/github/repository.js`, no remote needed) → `uncommitted`, `committed`.
- **GitHub** (`pull-request.js` / `checks.js`) → `pr_open`, `ci_pending`, `ci_passed`, `ci_failed`, `merged`, plus `unknown`.

Combined resolver: `local Git state + GitHub PR/check state = delivery state`. When GitHub context is unavailable:

```yaml
delivery:
  provider: github
  state: unknown
  blocked_reason: GITHUB_CONTEXT_UNAVAILABLE
```

GitHub-sourced delivery is **never assumed** (no implicit `ci_passed`/`pr_open`/`merged`) and its current value is **never persisted in `sdd.lock`** (C-10). `unknown` blocks **only when remote information is required** (§3.4): e.g. `planned + unknown` does not block `sdd-apply` (a local step), but `runtime_cleared + unknown` blocks `sdd-commit` / PR resolution.

### 3.3 Lifecycle transition table

`lifecycle/model.js` encodes transitions as data.

| From | Skill (`/command`) | To | Guard |
|---|---|---|---|
| *(pre-process)* | `sdd-enrich-us` | — | refine request; no lifecycle state (C-02) |
| *(none)* | `sdd-new` | `proposal_draft` | decision-closed requirement present |
| `proposal_draft` | *(human)* | `proposal_approved` | reviewer sets `proposal.status: approved` |
| `proposal_approved` | `sdd-design` | `designed` | `design_required == true` (§4.4) |
| `proposal_approved` | *(skip, no write)* | `designed` | `design_required == false` → no `design.md` created; engine computes `designed` (§4.4) |
| `designed` | `sdd-plan` | `planned` | proposal `approved` ∧ (`design_required == false` ∨ design `approved`/`not_applicable`) |
| `planned` | `sdd-apply` | `implementing`→`implemented` | tasks `ready` |
| `implemented` | `sdd-code-review` | `reviewed` | tasks `passed` |
| `reviewed` | `sdd-security-gate` | `security_cleared` | **required?** = §6 risk rule |
| `reviewed` | *(auto-skip)* | `security_cleared` | risk `low` → report `not_applicable` |
| `security_cleared` | `sdd-runtime-gate` | `runtime_cleared` | ≥1 applicable capability (else `not_applicable`) |
| `merged` + `runtime_cleared` | `sdd-verify` | `verified` | all ACs have passing tests |
| `verified` | `sdd-archive` | `archived` | verification `passed` |

### 3.4 Combining dimensions in `sdd next`

`sdd next` applies the lifecycle transition table **and** the delivery state to return one action:

| lifecycle | delivery | `sdd next` |
|---|---|---|
| `runtime_cleared` | `uncommitted` | `next skill: sdd-commit` |
| `runtime_cleared` | `ci_pending` | `wait_for_github_ci` |
| `runtime_cleared` | `ci_failed` | `blocked: GITHUB_CI_FAILED` |
| `runtime_cleared` | `ci_passed` (not merged) | `merge` (human action) |
| `runtime_cleared` | `merged` | `next skill: sdd-verify` |
| `verified` | `merged` | `next skill: sdd-archive` |
| any | `unknown` (only when the step needs remote state) | `blocked: GITHUB_CONTEXT_UNAVAILABLE` |

`unknown` is blocking **only** for actions that need remote state (commit/PR/CI/merge); it never blocks local-only steps such as `sdd-apply`. `uncommitted`/`committed` are read from the local Git tree and remain available even when GitHub is unreachable.

### 3.5 Exception views

If any artifact is `failed`/`blocked`, or a blocking security finding exists, `sdd status` reports the underlying lifecycle plus an `exception` block, and `sdd next` returns the remediation step (e.g. re-run the gate that failed). Exceptions do not advance or invent states.

### 3.6 Precondition self-validation

Every skill declares `requires:` (§2.2) and, at run time, calls `sdd validate --precondition <skill>`. If unmet, it stops and names the missing precondition. `sdd-apply`'s precondition is exactly (C-07):

```
proposal.status == approved
(design_required == false) OR (design.status in [approved, not_applicable])
tasks.status == ready
```

### 3.7 `status`, `next`, `/sdd-next`

- `sdd status [<change-id>]` → both dimensions (branch → change-id if omitted).
- `sdd next [<change-id>]` → one action per §3.4.
- `/sdd-next` (the `sdd-next` skill) shells `sdd next --json` and tells the agent what to do; it does not re-derive state.

---

## 4. Artifact schemas and validation

### 4.1 Common frontmatter contract

```yaml
---
schema: <proposal|design|tasks|code-review-report|security-report|runtime-gate-report|verification-report>
schema_version: 1
change_id: <slug>
status: <normalized status>
owner: <handle>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
---
```

### 4.2 Normalized status enum and legal subsets (C-07)

Enum: `draft` · `approved` · `ready` · `in_progress` · `passed` · `failed` · `blocked` · `not_applicable` · `archived`.

| Artifact | Legal statuses |
|---|---|
| `proposal` | `draft`, `approved`, `archived` |
| `design` | `draft`, `approved`, `not_applicable`, `archived` |
| `tasks` | `draft`, `ready`, `in_progress`, `passed`, `blocked` |
| `code-review-report` | `passed`, `failed` |
| `security-report` | `passed`, `failed`, `blocked`, `not_applicable` |
| `runtime-gate-report` | `passed`, `failed`, `blocked`, `not_applicable` |
| `verification-report` | `passed`, `failed` |

State progression:

```
# before human approval          # after human approval
proposal: draft                   proposal: approved
design:   draft                   design:   approved   (or not_applicable)
tasks:    draft                   tasks:    ready
```

`design` uses `approved` (never `ready`); `ready` belongs to `tasks` only. Verdicts are **statuses**, not free-text strings.

### 4.3 Structured proposal fields — impact and security

The `proposal` schema requires structured blocks used by the engine:

```jsonc
// proposal.schema.json (abridged)
{
  "required": ["schema","schema_version","change_id","status","impact","security","acceptance_criteria"],
  "properties": {
    "status": { "enum": ["draft","approved","archived"] },
    "impact": {
      "type": "object",
      "required": ["public_contract","data_model","architecture_boundary","external_integration",
                   "cross_repository","authentication","authorization","infrastructure",
                   "concurrency","migration"],
      "additionalProperties": false,
      "patternProperties": { "^[a-z_]+$": { "type": "boolean" } }
    },
    "security": {
      "type": "object",
      "required": ["risk","triggers"],
      "properties": {
        "risk": { "enum": ["low","standard","elevated"] },
        "triggers": { "type": "array", "items": { "enum": [
          "authentication","authorization","roles_or_privileges","tenant_boundary",
          "personal_data","sensitive_data","secrets","file_upload","external_integration",
          "payments","infrastructure","sensitive_logging","ai_tool_execution",
          "critical_dependency" ] } }
      }
    },
    "acceptance_criteria": { "type": "array", "minItems": 1,
      "items": { "required": ["id","text"], "properties": { "id": { "pattern": "^AC-[0-9]{2,}$" } } } }
  }
}
```

### 4.4 Design-required predicate (C-03)

`lifecycle/impact.js`: `sdd-design` is required iff any `proposal.impact.*` is `true`, or `sdd.config.yaml` `design.always: true`. Non-authoritative signals (file/module/task counts, size, affected repos) may surface a recommendation but never decide. `sdd-new` proposes the `impact` block; human approval confirms/corrects it; `sdd next` uses the approved values. The computed `design_required` boolean drives the state model: when `false`, `design.md` is **optional** — no file is created, `sdd status`/`sdd next` never write, and the engine computes `designed` directly. A `design.md` with `not_applicable` may exist but is never required, so the pure engine performs no mutation (C-03).

### 4.5 Design and runtime-gate schemas

`design.schema.json` `status ∈ {draft, approved, not_applicable, archived}` and requires a `security` block:

```yaml
security:
  risk: <low|standard|elevated>
  threat_model_required: <bool>
  controls: [SEC-001, SEC-002]
```

`runtime-gate-report.schema.json` requires a per-adapter block whose `status` includes **`blocked`** (C-06):

```jsonc
"adapters": {
  "type": "object",
  "additionalProperties": {
    "required": ["status"],
    "properties": {
      "status": { "enum": ["passed","failed","blocked","not_applicable"] },
      "reason_code": { "type": "string" },   // e.g. ADAPTER_NOT_IMPLEMENTED, DEPENDENCY_UNAVAILABLE, INSUFFICIENT_EVIDENCE
      "findings": { "type": "array" }
    }
  }
}
```

### 4.6 `sdd validate` and `--ci` (C-12)

- `sdd validate` — validate all artifacts + `sdd.config.yaml` + `sdd.lock` against schemas; structured results.
- `sdd validate --ci` — additionally verifies: legal lifecycle state (no illegal skip), unmet preconditions, required gates present, applicable adapters resolved (no `blocked` left unaddressed), no blocking findings, and cross-artifact consistency (proposal ↔ design ↔ tasks ↔ reports). Exits non-zero on any violation, emits `--json`. It **does not** check translated headings, phrases like `READY FOR PR`, emojis, or free text, and it **never mutates artifacts or completes states**.
- `sdd validate --precondition <skill>` — evaluate one skill's `requires:` block (§3.6).

The provided `sdd-validation.yml` runs **only** `sdd validate --ci`.

---

## 5. Project configuration and lock

### 5.1 `sdd.config.yaml`

```yaml
version: 2
project:
  name: my-app
  language: es
methodology:
  scope: user                 # global install (C-08)
  compatible: ">=2.0.0 <3.0.0"
capabilities:                 # drives runtime-gate adapters (§7)
  browser: true
  http: true
  cli: false
  worker: false
design:
  always: false               # force sdd-design regardless of impact (§4.4)
security:
  default_risk: standard      # feeds the proposal's initial classification (§6)
  threat_model: auto          # auto | always | never
github:                       # delivery integration (C-11)
  base_branch: master         # never hardcoded in code; read from here or GitHub
  require_pull_request: true   # MANDATORY in 2.0 — schema `const: true`; no direct-merge path (AC-21)
  require_ci: true             # MANDATORY in 2.0 — schema `const: true`; no CI-optional path (AC-21)
documents:                    # doc adoption map (C-09)
  system_spec: openspec/specs/system.md
  architecture: docs/arquitectura.md
  verification: docs/verificacion.md
  workflow: docs/sdd-workflow.md
addons:
  confluence: false
```

`config/config.js` merges package defaults → `sdd.config.yaml` → env overrides. `docmap.js` resolves logical doc names through `documents:` before touching the filesystem.

### 5.2 `sdd.lock` (C-08, C-10)

```yaml
version: 2
methodology:
  compatible: ">=2.0.0 <3.0.0"   # the project's contract (authoritative)
  resolved: 2.0.3                # version used at the last validation (informational)
installed_at: 2026-07-14
skills:
  sdd-plan: { version: 2.0.3 }
  # ...
capabilities_snapshot: { browser: true, http: true, cli: false, worker: false }
```

`compatible` is the contract; `resolved` records the last-validated version. `sdd doctor` reads the installed global version and **blocks** if it falls outside `compatible` (C-08). The lock **never** stores current GitHub delivery state (C-10). Exact per-project resolution (`scope: project`, `version: x.y.z`) is documented as a possible later mode, not implemented in 2.0.

---

## 6. Security across three moments (C-04)

### 6.1 Classification, refinement, enforcement

- **Proposal** — `security.risk` (`low|standard|elevated`) + `security.triggers` (from the recommended trigger list). Recommended triggers: `authentication`, `authorization`, `roles_or_privileges`, `tenant_boundary`, `personal_data`, `sensitive_data`, `secrets`, `file_upload`, `external_integration`, `payments`, `infrastructure`, `sensitive_logging`, `ai_tool_execution`, `critical_dependency`. **`http: true` alone is not `elevated`.**
- **Design** — refines `risk`, sets `threat_model_required`, lists `controls` (`SEC-00x`). `security.threat_model: always` forces a threat model at any level; `elevated` requires one.
- **Security gate** (`sdd-security-gate`) — validates coherence across proposal/design/implementation; checks that declared controls exist with evidence; **may raise** risk on omitted signals; **never lowers** an approved risk automatically; produces `security-report.md`.

### 6.2 `security-report.md`

```yaml
---
schema: security-report
schema_version: 1
change_id: <slug>
status: <passed|failed|blocked|not_applicable>
risk: <low|standard|elevated>
threat_model_required: <bool>
---
```

Body: risk rationale, control checklist with evidence, threat model when required, and a **structured findings** table (id, severity, blocking, location, remediation). Any `blocking: true` finding forces `status: blocked` and the blocked exception view (§3.5). A `low`-risk change still produces a report with `status: not_applicable`.

**Mandatory disclaimer** (report body + CLI output): *this gate is an automated pre-check and does not replace a penetration test or a human security audit.*

### 6.3 Security controls for this change (`sdd-2.0`)

This change is classified `risk: elevated` (`threat_model_required: true`) because it installs global Agent Skills, executes system commands, writes to repositories, creates commits/pushes/PRs, reads GitHub credentials/context, modifies GitHub Actions, publishes an npm package, and migrates consumer projects. The design declares these minimum controls; each maps to implementation tasks (`tasks.md` T7.4):

| Control | Scope |
|---|---|
| `SEC-001` | Explicit confirmation for global, destructive, or remote writes |
| `SEC-002` | Protection against path traversal, unsafe symlinks, and writes outside allowed roots |
| `SEC-003` | Safe argument escaping / shell-injection prevention |
| `SEC-004` | Redaction of tokens, secrets, and credentials in logs |
| `SEC-005` | Integrity and ownership verification of installed skills |
| `SEC-006` | Repository, base-branch, and PR validation before any remote action |

---

## 7. Runtime gate and capability adapters (C-06)

`sdd-runtime-gate` replaces `sdd-ux-gate` + `sdd-e2e-gate`. It selects adapters from `capabilities:`.

| Adapter | Capability | Support | Validates |
|---|---|---|---|
| `browser` | `browser` | **supported** | UX flow, accessibility basics, responsive states, UI↔backend integration, network, auth on protected routes, console errors |
| `http` | `http` | **supported** | REST routes, auth, authorization, request/response contracts, persistence, failure paths |
| `cli` | `cli` | **experimental** | command invocations, exit codes, stdout/stderr contracts |
| `worker` | `worker` | **experimental** | message handling, retries, observable side effects |

Adapter status rules:

- capability `false` → `not_applicable` (non-blocking);
- capability `true` and adapter available with sufficient evidence → runs, `passed`/`failed`;
- capability `true` and adapter **not implemented** → `blocked` (`reason_code: ADAPTER_NOT_IMPLEMENTED`);
- required dependency absent (e.g. Playwright MCP) → `blocked` (`reason_code: DEPENDENCY_UNAVAILABLE`);
- insufficient evidence → `blocked` (`reason_code: INSUFFICIENT_EVIDENCE`);
- `passed` is **never fabricated**.

Experimental adapters (`cli`, `worker`) **block** when their capability is `true` — they never emit `passed` in 2.0. The gate `status` is `passed` iff every applicable adapter is `passed`, `not_applicable` if none apply, and `blocked` if any applicable adapter is `blocked`.

---

## 8. Safe document behavior and migration mechanics

### 8.1 `init` (never overwrites; adoption is explicit — C-09)

`sdd init`:
1. Loads/creates `sdd.config.yaml` (prompting for `capabilities`, `methodology.compatible`, `github`).
2. For each logical document, resolves the target through `documents:`. Adoption is tiered:
   - **automatic** — only when the path is declared in config, the name matches exactly, or it is an officially recognized alias;
   - **confirmation** — a plausible candidate prompts `Found <file>. Use it as <role>? [y/N]`;
   - **semantic** — deeper analysis is delegated to `sdd-bootstrap-project`, never done by `init`.
   If missing, copies the template. Never writes an ambiguous mapping without confirmation.
3. Creates `openspec/specs/system.md`, `openspec/changes/`, and `.github/workflows/sdd-validation.yml` if absent.
4. Writes `sdd.lock` (with `methodology.compatible`).
5. Prints created vs skipped-because-existing; modifies no existing content.

### 8.2 `doctor` (read-only)

Reports: global-skill presence, **version-vs-compatible-range** check (blocks on incompatibility, C-08), config schema validity, missing docs, capability/adapter mismatches, illegal artifact states, and delivery reachability (marks `unknown` if GitHub is unreachable). Writes nothing unless `--fix`; `--fix` performs only safe additive fixes and never edits customized content.

### 8.3 `migrate` (diff-then-confirm)

Converts a 1.x consumer: detect the 1.x layout (submodule `.ai-sdd-playbooks`, `.claude/commands/`, `sync-consumer.sh`) → compute the 2.0 target (`sdd.config.yaml`/`sdd.lock`, doc adoption, `sdd-validation.yml`) → render a full diff → apply only on explicit confirmation (`--yes` still prints the diff). Legacy files stay; a later separate change removes them.

### 8.4 `sdd-bootstrap-project` (AI-assisted, human-approved)

Inspects the repository, proposes document mappings and improved `AGENTS.md`/`docs/*` content, presents a **diff**, and writes only on human approval. Declining is a no-op.

### 8.5 Legacy compatibility surface

Legacy 1.x artifacts stay **at their current paths, frozen in place** — `playbooks/`, `dist/claude-commands/`, `scripts/sync.js`, `scripts/sync-consumer.sh` are **not relocated** in 2.0, so submodule consumers keep resolving `dist/claude-commands/` and `scripts/sync-consumer.sh` unchanged (AC-16). Only `legacy/README.md` documents the freeze policy and deprecation window; the physical move under `legacy/` is deferred to 3.0. A build step may dual-emit legacy command files during the deprecation window. No new features land in legacy.

### 8.6 `sdd-ff` deprecation (C-05)

`sdd-ff` is **not** a silent alias for `sdd-plan`. In 2.0 it emits:

```
sdd-ff is deprecated in SDD 2.0.
The equivalent lifecycle is:
  1. sdd-design, when required
  2. sdd-plan
Run `sdd next` to determine the applicable step.
```

It does not execute `sdd-plan`. Original single-command behavior survives only in the frozen `legacy/` wrapper for un-migrated consumers.

---

## 9. GitHub delivery integration (C-01, C-10, C-11)

`src/github/` provides delivery state and actions; it is GitHub-specific (no generic forge abstraction):

```
src/github/
├── auth.js            # detect gh CLI / token; report availability
├── repository.js      # base branch, current branch, remote
├── pull-request.js    # create/update/read PR
└── checks.js          # CI run + check status
```

### 9.1 Reading delivery state

`repository.js` reads the **local** Git working tree for `uncommitted`/`committed` (no remote needed). `checks.js`/`pull-request.js` map GitHub reality to the remaining delivery states in §3.2. If `auth.js` reports no context, the GitHub-sourced state is `unknown` with `blocked_reason: GITHUB_CONTEXT_UNAVAILABLE` — CI/PR/merge are **never** assumed, and current state is **never** persisted in `sdd.lock` (C-10). Local reports may record historical evidence, but the *current* GitHub state is always queried or marked unknown.

### 9.2 `sdd-commit` behavior (C-11)

`sdd-commit`:
1. validates local preconditions;
2. runs `sdd validate`;
3. verifies security/runtime gates are `passed` or legitimately `not_applicable`;
4. detects the base branch from `github.base_branch` or GitHub (**never hardcodes** `main`/`master`);
5. creates the commit;
6. pushes;
7. creates or updates the Pull Request;
8. returns the delivery state.

Restrictions: does not create a PR unless the user authorized remote actions; does not mark `ci_passed` immediately after push; does **not** merge automatically in 2.0.

---

## 10. Testing strategy (design-level)

- **Lifecycle engine**: table-driven tests over every lifecycle state (§3.1) and transition (§3.3), the dimension-combination matrix (§3.4), exception views (§3.5), and design/security skip rules — pure function, exhaustive (R-03). Assert the `design_required == false` path yields `designed` with **no** `design.md` and no write.
- **Delivery**: fixtures for each delivery state including `unknown`/`GITHUB_CONTEXT_UNAVAILABLE`; assert nothing is assumed and nothing is written to the lock (C-10).
- **Schemas**: golden valid/invalid fixtures per schema, including `design: approved` (not `ready`), `tasks: draft→ready`, adapter `blocked`, and a config with `require_ci: false` / `require_pull_request: false` **rejected** (AC-21).
- **Version compatibility**: `doctor` blocks when the installed global version is outside `compatible` (C-08).
- **Safe FS**: `init` never modifies existing content; `migrate`/`--fix` never write without confirmation; ambiguous doc adoption requires confirmation (C-09).
- **Adapters**: capability matrix → expected adapter set; experimental `cli`/`worker` yield `blocked` (never `passed`) when applicable (C-06).
- **CI**: `sdd validate --ci` exit-code matrix; assert no heading/phrase/emoji matching and no artifact mutation (C-12).

---

## 11. Traceability

| AC | Design section |
|---|---|
| AC-01 | §1.2 |
| AC-02 | §2.1 |
| AC-03/04 | §8.1, §5.1 |
| AC-05 | §8.2 |
| AC-06/07 | §3.1–§3.4, §3.7 |
| AC-08 | §3.6, §2.2 |
| AC-09 | §4.1–§4.5 |
| AC-10 | §4.6 |
| AC-11 | §7 |
| AC-12 | §6 |
| AC-13 | §8.3 |
| AC-14 | §2.1, §5.1 |
| AC-15 | §8.4 |
| AC-16 | §8.5 |
| AC-17 | §3.2, §9.1 |
| AC-18 | §9.2 |
| AC-19 | §5.2, §8.2 |
| AC-20 | §8.6 |
| AC-21 | §5.1, §9.2 |
