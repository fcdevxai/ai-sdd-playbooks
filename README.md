# sdd — Spec-Driven Development

SDD is a Spec-Driven Development methodology delivered as a **globally-installed**
set of Agent Skills plus a deterministic **`sdd` CLI**, shared by **Claude Code**
and **GitHub Copilot**. The methodology lives in one place; each project keeps
only its own context and a lockfile pinning the compatible methodology range.

> **2.0** is a ground-up redesign. The 1.x submodule/copy pipeline still works
> and is **frozen in place** (see [Legacy & deprecation](#legacy--deprecation)).
> The change is specified in [`openspec/changes/sdd-2.0/`](openspec/changes/sdd-2.0/).

## Install (global, once)

```bash
sdd install                 # copies core skills into ~/.claude/skills and ~/.agents/skills
sdd install --addon confluence   # optional add-ons, opt-in only
```

Core skills install into both runtime directories. Add-ons are never installed
implicitly.

## Connect a project

```bash
sdd init         # scaffold/connect project-local files (never overwrites)
sdd doctor       # read-only health check (--fix for safe additive fixes)
```

`sdd init` creates only what's missing: `sdd.config.yaml`, `sdd.lock`,
`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`,
`docs/{architecture,verification,sdd-workflow}.md`, `openspec/specs/system.md`,
`openspec/changes/`, and `.github/workflows/sdd-validation.yml`. Existing
equivalent docs are **adopted by configuration**, never overwritten. Core
methodology files are **not** copied into the project.

## Command reference

| Command | Purpose |
|---|---|
| `sdd install` | Install/refresh core skills into the global agent dirs |
| `sdd init` | Scaffold/connect the project-local structure (never overwrites) |
| `sdd doctor` | Read-only diagnostics (`--fix` = safe additive fixes) |
| `sdd status` | Print both dimensions: lifecycle + GitHub delivery |
| `sdd next` | The single next valid action (combines both dimensions) |
| `sdd validate` | Validate artifacts/config against the JSON Schemas (`--ci` for pipelines) |
| `sdd sync` | Reconcile `sdd.lock` with the installed version (`--legacy` = 1.x dual-emit) |
| `sdd migrate` | Convert a 1.x consumer to 2.0 (diff-then-confirm) |

Global flags: `--json`, `--cwd`, `--config`, `--quiet`, `--yes`, `--version`.

## Two-dimension state model

`sdd status` reports **two independent dimensions**:

- **lifecycle** (methodological, computed from local artifacts):
  `proposal_draft → proposal_approved → designed → planned → implementing →
  implemented → reviewed → security_cleared → runtime_cleared → verified →
  archived`. `failed`/`blocked` are exception views.
- **delivery** (local Git + GitHub): `uncommitted → committed → pr_open →
  ci_pending → ci_passed | ci_failed → merged`, or `unknown` when GitHub context
  is unavailable (never assumed).

`sdd next` combines them into one action. **The CLI — not the language model —
is the authority on state and next step.**

## Lifecycle skills

`sdd-enrich-us` (pre-process) → `sdd-new` → *human approval* → `sdd-design`
(when required) → `sdd-plan` → `sdd-apply` → `sdd-code-review` →
`sdd-security-gate` (when required) → `sdd-runtime-gate` → `sdd-commit` → *CI* →
*merge* → `sdd-verify` → `sdd-archive`. `sdd-next` asks the CLI what to run.

- **Security is core.** Risk is classified in the proposal, refined in the
  design, and enforced by `sdd-security-gate` (blocking findings block; it does
  **not** replace a penetration test).
- **One runtime gate.** `sdd-runtime-gate` replaces the old UX + E2E gates. It
  selects adapters from project `capabilities` (`browser`, `http`, `cli`,
  `worker`). A `false` capability is `not_applicable`; an unimplemented or
  dependency-missing adapter **blocks** — it never fabricates `passed`.

## Capability model

Set what your project actually is in `sdd.config.yaml`:

```yaml
capabilities:
  browser: true    # web UI → Playwright-driven runtime checks
  http: true       # REST surface → API runtime checks
  cli: false       # experimental adapter
  worker: false    # experimental adapter
```

Backend-only projects (`browser: false`) never invoke Playwright.

## Validation & CI

`sdd validate --ci` validates frontmatter against JSON Schemas, checks legal
lifecycle states, preconditions, gates, adapter consistency, and cross-artifact
consistency — using **structured statuses**, never verdict-string/heading/emoji
matching, and never mutating artifacts. The shipped
`.github/workflows/sdd-validation.yml` runs only `sdd validate --ci`.

## GitHub only

2.0 supports **GitHub** exclusively as the remote provider (branches, PRs,
Actions, checks, merge). GitLab/Bitbucket and generic forge abstractions are out
of scope. `github.require_pull_request` and `github.require_ci` are mandatory.

## Legacy & deprecation

The 1.x pipeline (`playbooks/`, `dist/claude-commands/`, `scripts/sync.js`,
`scripts/sync-consumer.sh`) is **frozen at its current paths** and keeps working
for un-migrated submodule consumers. See [`legacy/README.md`](legacy/README.md).
`sdd migrate` moves a consumer to 2.0 without deleting anything. The **physical
removal** of 1.x is deferred to **3.0** (announced deprecation window).

## Development (this repo)

```bash
npm ci
npm test          # node --test
npm run check     # legacy 1.x drift check
```

The repo dogfoods itself: `sdd status` / `sdd next` run against
`openspec/changes/sdd-2.0/`.

> **Publishing** (human-owned): choose the npm name/scope, remove `private` from
> `package.json`, then `npm publish`. `npm pack --dry-run` shows the exact
> contents.
