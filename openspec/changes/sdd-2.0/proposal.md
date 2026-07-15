---
schema: proposal
schema_version: 1
change_id: sdd-2.0
title: "SDD 2.0 — Global methodology, npm CLI, deterministic lifecycle"
status: approved
owner: felipe.campos
created: 2026-07-14
updated: 2026-07-14
supersedes: sync-consumer-submodule-architecture
delivery:
  provider: github          # GitHub is the only supported remote provider (decision scope §Integration)
impact:                      # structured impact — drives whether sdd-design is required (C-03)
  public_contract: true
  data_model: false
  architecture_boundary: true
  external_integration: true   # GitHub integration (C-01/C-11)
  cross_repository: true       # operates on consumer repositories (init/migrate/bootstrap)
  authentication: false
  authorization: false         # not an architectural impact; retained as a security trigger below
  infrastructure: true         # modifies GitHub Actions / CI workflows
  concurrency: false
  migration: true
security:                    # initial risk classification lives in the proposal (C-04)
  risk: elevated
  triggers:
    - ai_tool_execution
    - critical_dependency
    - external_integration
    - authorization
    - secrets
    - infrastructure
---

# SDD 2.0 — Global methodology, npm CLI, deterministic lifecycle

## Objective

Turn `ai-sdd-playbooks` from a **per-project copy machine** (canonical Markdown → generated commands → git-submodule sync) into a **product**: a publishable npm package that installs the SDD methodology **once, globally**, exposes a deterministic `sdd` CLI, and drives consumer projects through a single, schema-validated lifecycle shared by Claude Code and GitHub Copilot.

The core methodology stops living inside every consumer repository. Consumer repositories keep only their **own** context (specs, config, project docs) plus a lockfile that pins the compatible methodology range they use.

## Problem with the current architecture (1.x)

1. **Duplication of the methodology.** Every consumer receives a full copy of the commands via `dist/claude-commands/` + `sync-consumer.sh` + git submodule. A fix must be re-synced into every project; methodology and project context are entangled.
2. **Two sources of truth per flow.** `playbooks/<slug>/canonical.md` is the source and `dist/claude-commands/<slug>.md` is generated, coupling "what the flow does" to "how one agent consumes it".
3. **State lives in the model's head.** The lifecycle is enforced by prose inside each command and by `grep`-ing verdict strings (`READY FOR PR`) in CI. There is no deterministic authority for "what state is this change in" or "what is the next valid step".

## Guiding principle

**The methodology is global and versioned; the project carries only its own context; the CLI — not the language model — is the authority on lifecycle state. The methodological state of a change and its GitHub delivery state are two separate dimensions.**

Machine-readable contracts (statuses, schemas, capabilities, impact, security) are stable and in English. Human-readable document bodies may use the project's language.

## Integration scope — GitHub only

SDD 2.0 supports **GitHub exclusively** as the remote delivery, review, and CI platform. Explicitly **out of scope** for this version: GitLab, Bitbucket, other remote Git providers, and any generic forge/SCM abstraction.

The delivery integration may use GitHub-specific concepts and APIs directly — branches, commits, Pull Requests, GitHub Actions, checks, merge state — and lives under `src/github/`, **not** a generic `src/providers/`. This GitHub-specificity does not remove the need to separate the SDD lifecycle from GitHub delivery conceptually (see §Two-dimension state model): the two have different sources of truth, timing, and resolution mechanisms.

## Two-dimension state model

The lifecycle engine reports **two independent dimensions** (detail in `design.md` §3):

- **`lifecycle`** — the methodological state, computed purely from local artifacts:
  `proposal_draft → proposal_approved → designed → planned → implementing → implemented → reviewed → security_cleared → runtime_cleared → verified → archived`.
  `failed` and `blocked` are **exception views** derived from artifacts, not extra linear phases.
- **`delivery`** — the delivery state, resolved from **two sources**: local Git provides `uncommitted → committed`; GitHub provides `pr_open → ci_pending → ci_passed | ci_failed → merged`, plus `unknown` when GitHub context is unavailable. Combined resolver = local Git state + GitHub PR/check state; GitHub-sourced states are never assumed.

`sdd status` prints both dimensions; `sdd next` combines them into a single recommended action (a skill to run, `wait_for_github_ci`, `merge`, or `blocked: <reason>`).

## Requirements ideation is a pre-process

`sdd-enrich-us` refines an initial request **before** a formal OpenSpec change exists. It is a **pre-process**, kept outside the main state machine. The formal change begins at `sdd-new`, which produces `proposal_draft`. No new `requirements.md` artifact is introduced in 2.0 (C-02).

```
initial request → sdd-enrich-us → decision-closed requirement → sdd-new → proposal_draft
```

## Deciding when `sdd-design` is required

The proposal declares a **structured impact** block (see frontmatter `impact:`). `sdd-design` is required when **any** impact indicator is `true`, or when `design.always: true` in `sdd.config.yaml`. File count, module count, estimated size, task count, and affected-repository count are **non-authoritative signals** — they may raise a recommendation but are never the deciding criterion. `sdd-new` proposes the classification; human approval confirms or corrects it; `sdd next` uses the approved values (C-03). When design is **not** required (`design_required == false`), `design.md` is optional: no placeholder file is created and the engine computes the lifecycle as `designed` with no file mutation.

## Security is classified from the proposal

Security operates at three moments (detail in `design.md` §6), starting in the proposal (C-04):

- **Proposal** — declares `security.risk` (`low | standard | elevated`) and `security.triggers`.
- **Design** — refines risk, sets `threat_model_required`, and lists `controls` (`SEC-00x`).
- **Security gate** — validates coherence across proposal/design/implementation, checks controls and evidence, may **raise** risk on omitted signals, **never lowers** an approved risk automatically, and produces `security-report.md`.

The capability `http: true` alone does **not** make a change `elevated`.

## Target repository structure

```
ai-sdd-playbooks/                    # the npm package "sdd"
├── package.json                     # bin: { "sdd": "./bin/sdd.js" }
├── bin/sdd.js                       # CLI entry point
├── src/
│   ├── cli/                         # install/init/doctor/status/next/validate/sync/migrate
│   ├── lifecycle/                   # deterministic state engine (two dimensions)
│   ├── schema/                      # schema loader + validators
│   ├── config/                      # sdd.config.yaml + sdd.lock IO
│   ├── github/                      # GitHub delivery: repository/pull-request/checks/auth (C-01, C-10)
│   └── adapters/                    # runtime-gate capability adapters (descriptors)
├── skills/                          # CANONICAL source of truth (decision 1)
│   ├── sdd-enrich-us/SKILL.md       # pre-process (outside the state machine)
│   ├── sdd-new/SKILL.md
│   ├── sdd-design/SKILL.md
│   ├── sdd-plan/SKILL.md
│   ├── sdd-apply/SKILL.md
│   ├── sdd-code-review/SKILL.md
│   ├── sdd-security-gate/SKILL.md
│   ├── sdd-runtime-gate/SKILL.md
│   ├── sdd-commit/SKILL.md
│   ├── sdd-verify/SKILL.md
│   ├── sdd-archive/SKILL.md
│   ├── sdd-next/SKILL.md
│   └── sdd-bootstrap-project/SKILL.md
├── addons/confluence/               # optional, never installed implicitly (decision 12)
│   ├── document-code/SKILL.md
│   └── write-in-confluence/SKILL.md
├── schemas/                         # JSON Schemas (artifacts + config + lock)
├── templates/                       # scaffolds copied by `sdd init` (project-local)
├── playbooks/                       # legacy 1.x — FROZEN IN PLACE, not relocated (decision 11)
├── dist/claude-commands/            # legacy 1.x generated commands — FROZEN IN PLACE
├── scripts/{sync.js,sync-consumer.sh}   # legacy sync — FROZEN IN PLACE
└── legacy/
    └── README.md                    # freeze policy + deprecation window (physical move deferred to 3.0)
```

## Project-local structure (consumer repository)

`sdd init` creates only what is missing:

```
<consumer-repo>/
├── sdd.config.yaml                  # capabilities, impact/design policy, security, github, doc map, add-ons
├── sdd.lock                         # compatible methodology range + last resolved version
├── AGENTS.md                        # cross-agent project context
├── CLAUDE.md                        # Claude Code entry (references AGENTS.md)
├── .github/
│   ├── copilot-instructions.md      # GitHub Copilot entry (references AGENTS.md)
│   └── workflows/sdd-validation.yml # runs `sdd validate --ci` only
├── docs/{architecture,verification,sdd-workflow}.md
└── openspec/
    ├── specs/system.md
    └── changes/
```

Core SDD skills are **not** copied here — they live in `~/.claude/skills/` and `~/.agents/skills/`.

## Scope

**In scope**

- npm packaging and the `sdd` executable: `install`, `init`, `doctor`, `status`, `next`, `validate`, `sync`, `migrate`, plus `sdd-bootstrap-project`.
- Global skill install into `~/.claude/skills/` and `~/.agents/skills/`.
- Deterministic two-dimension lifecycle engine (`status`, `next`, `/sdd-next`) with per-skill precondition checks.
- Structured artifacts: frontmatter metadata, normalized statuses, JSON Schemas, `sdd validate --ci`.
- Revised lifecycle skills: `sdd-design`, `sdd-plan` (replaces `sdd-ff`), `sdd-security-gate`, `sdd-runtime-gate` (replaces `sdd-ux-gate` + `sdd-e2e-gate`).
- Security as a core stage classified from the proposal onward.
- Project capability model driving runtime-gate adapter applicability, with incomplete adapters that **block** rather than pass.
- GitHub delivery integration (branch/commit/PR/checks/merge) as a separate dimension, GitHub-specific.
- Safe project scaffolding (`init`), diagnostics (`doctor`), guided migration (`migrate`), and the bootstrap skill.
- Core/add-on separation with Confluence under `addons/`.
- A documented, reversible migration path from 1.x.

**Out of scope (non-goals)**

- GitLab, Bitbucket, any other remote provider, or a generic forge abstraction.
- Replacing human penetration testing, human code review, or product sign-off. Gates are pre-checks.
- Auto-editing consumer documentation without human approval (all doc refactoring is diff-then-confirm).
- Automatic merge. 2.0 never merges on the user's behalf.
- Exact per-project version pinning of the global methodology (see compatibility note below).
- Removing legacy artifacts in this change. Deprecation is documented; deletion is a later change.
- A hosted service, telemetry, or account system.

## Global install vs versioning (no false pinning promise)

A global skill directory (e.g. `~/.claude/skills/sdd-plan/`) holds only **one** active version. Therefore an exact `sdd.lock` version cannot guarantee reproducibility across projects that need different versions. 2.0 uses **compatibility-by-range** in global mode: the project declares a `compatible` range and records the `resolved` version last validated; `sdd doctor` blocks when the installed global version is incompatible (C-08). Exact per-project resolution is documented as a possible later mode, **not** implemented or promised in 2.0.

## Compatibility policy (transitional)

- The 1.x pipeline (`playbooks/*/canonical.md` → `dist/claude-commands/`, distributed by git submodule + `scripts/sync-consumer.sh`) stays **at its current paths, frozen in place** — **not** relocated — so submodule consumers keep resolving `dist/claude-commands/` and `scripts/sync-consumer.sh` unchanged. Only documentation marks it legacy; the physical move under `legacy/` is deferred to 3.0.
- The build may **dual-emit** during the transition: `skills/<name>/SKILL.md` stays canonical; a compatibility step can still regenerate legacy command files.
- `sdd migrate` converts a 1.x consumer to 2.0 (diff-then-confirm) and never deletes legacy files silently.
- A deprecation window is announced in the README and `CHANGELOG`. Legacy removal is a separate, explicitly-scheduled change.

## Core vs add-ons

Core = SDD lifecycle skills + CLI + schemas, installed by `sdd install`. Add-ons (Confluence `document-code`, `write-in-confluence`) live under `addons/` and install only on explicit opt-in (`sdd install --addon confluence` and/or `addons:` in `sdd.config.yaml`). They are never pulled in implicitly.

## Acceptance criteria

Machine-readable identifiers are stable in English.

- **AC-01** `sdd --help` lists exactly: `install`, `init`, `doctor`, `status`, `next`, `validate`, `sync`, `migrate`.
- **AC-02** `sdd install` places core skills in `~/.claude/skills/` and `~/.agents/skills/`, records the installed version, and creates no consumer-repo files.
- **AC-03** `sdd init` on a fresh repo creates every file in *Project-local structure* and no core copies. Re-running creates only missing files, reports what it skipped, and modifies no existing file's content.
- **AC-04** An existing equivalent document is adopted only when unambiguous (declared path, exact name, or official alias); a plausible-but-uncertain candidate requires explicit confirmation; ambiguous mappings are never written silently (C-09).
- **AC-05** `sdd doctor` is read-only by default (writes nothing) and exits `0` healthy / non-zero with a structured problem list otherwise. `--fix` performs only safe additive fixes and never edits customized content.
- **AC-06** `sdd status` prints **two dimensions** — `lifecycle` and `delivery` — computed without any model call. The `lifecycle` dimension is derived purely from local artifacts.
- **AC-07** `sdd next` combines both dimensions into a single next action (`next skill`, `wait_for_github_ci`, `merge`, or `blocked: <reason>`), consistent with `sdd status`. `/sdd-next` returns the same answer.
- **AC-08** Each SDD skill refuses to run when its declared preconditions are unmet and names the missing precondition (e.g. `sdd-apply` refuses unless `proposal=approved`, `tasks=ready`, and — only when `design_required` — `design∈{approved,not_applicable}`; a skipped design requires no file).
- **AC-09** Every artifact carries `schema`, `schema_version`, and a `status` from the normalized enum; per-artifact legal subsets are enforced. `design` uses `approved` (not `ready`); `tasks` uses `ready` only after human approval.
- **AC-10** `sdd validate --ci` exits non-zero on any schema violation, illegal state, unmet precondition, missing required gate, blocking finding, or cross-artifact inconsistency; emits machine-readable output; performs no verdict-string/heading/emoji `grep`; and never mutates artifacts or completes states.
- **AC-11** `sdd-runtime-gate` selects adapters solely from `capabilities:`. A capability `false` → `not_applicable` (non-blocking). A capability `true` whose adapter is unimplemented, whose dependency is absent, or whose evidence is insufficient → **`blocked`**. `passed` is never fabricated (C-06).
- **AC-12** Security risk is declared in the proposal, refined in the design, and enforced by `sdd-security-gate`, which validates coherence, may raise risk, never lowers it automatically, and produces `security-report.md` with a structured status and a disclaimer that it does not replace a penetration test. `http: true` alone is not `elevated`.
- **AC-13** `sdd migrate` shows a diff and applies nothing without explicit confirmation; legacy files remain until a later, separate removal.
- **AC-14** Installing the core never installs an add-on; Confluence skills appear only after explicit opt-in.
- **AC-15** `sdd-bootstrap-project` inspects the repo, proposes a documentation diff, and writes only on human approval; declining leaves the repo unchanged.
- **AC-16** The legacy 1.x flow still functions unchanged for an un-migrated consumer throughout the deprecation window.
- **AC-17** Delivery combines local Git (`uncommitted`/`committed`, resolved offline) with GitHub-sourced state (PR/CI/merge). GitHub-sourced state is queried or reported as `unknown` with `blocked_reason: GITHUB_CONTEXT_UNAVAILABLE`; it is never assumed and never persisted as current state in `sdd.lock` (C-10). `unknown` blocks only when remote information is required (commit/PR/CI/merge), never local-only steps such as `sdd-apply`.
- **AC-18** `sdd-commit` detects the base branch from GitHub or `github.base_branch` config (never hardcodes `main`/`master`), creates commit + push + PR only when remote actions are authorized, does not mark `ci_passed` on push, and never auto-merges (C-11).
- **AC-19** `sdd.lock` records `methodology.compatible` (range) and `methodology.resolved` (last validated version); `sdd doctor` blocks when the installed global version is outside the compatible range (C-08).
- **AC-20** `sdd-ff` is deprecated: it does not run `sdd-plan`, emits a deprecation notice explaining `sdd-design` → `sdd-plan`, and recommends `sdd next`. Original behavior survives only in the frozen `legacy/` wrapper (C-05).
- **AC-21** In 2.0, `github.require_pull_request` and `github.require_ci` are mandatory (`const: true` in the config schema); direct-merge and CI-optional paths are out of scope. The delivery flow is fixed: commit → push → PR → CI → human merge.

## Risks

- **R-01 — Global vs project drift.** Global methodology can diverge from a project's `compatible` range. *Mitigation:* `sdd doctor` compares installed version against the range and blocks; `sdd sync` reconciles (C-08).
- **R-02 — Skill dual-consumption gaps.** One `SKILL.md` must satisfy Claude Code and Copilot. *Mitigation:* shared frontmatter contract + `sdd doctor` lint.
- **R-03 — Lifecycle engine correctness.** *Mitigation:* both dimensions are table-driven and unit-tested against fixtures for every state and transition.
- **R-04 — Migration data loss.** *Mitigation:* diff-then-confirm; `init` never overwrites; adoption-by-config with confirmation; legacy kept.
- **R-05 — Security theater.** *Mitigation:* explicit non-replacement disclaimer; risk recorded from the proposal; gate can raise but not silently lower risk.
- **R-06 — Runtime adapter over-reach.** *Mitigation:* `browser`/`http` supported; `cli`/`worker` experimental and **blocking** when applicable — never a false `passed`.
- **R-07 — Backward-compat maintenance cost.** *Mitigation:* legacy frozen at its current paths, documented through `legacy/README.md`, and time-boxed by an announced deprecation window.
- **R-08 — GitHub state staleness.** *Mitigation:* delivery state is queried live or marked `unknown`; never persisted as current in the lock (C-10).

## Open technical decisions

None. All direction is settled by the approved decisions and the mandatory corrections (C-01…C-12). Design details are specified in `design.md`.
