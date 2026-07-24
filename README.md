# playbook-ai — Spec-Driven Development

`playbook-ai` is a Spec-Driven Development methodology delivered as a
**globally-installed** set of Agent Skills plus a deterministic **`playbook`
CLI**, shared by **Claude Code**, **GitHub Copilot**, and **Codex**. It unifies
two prior sibling frameworks:

- the deterministic two-dimension lifecycle engine, JSON-Schema validation,
  capability-driven runtime gate, and multi-runtime install model (formerly
  `ai-sdd-playbooks`), and
- Architecture Decision Records, token-efficiency tooling (context packets,
  compacted verification runs, section-first spec reads), and multi-repo
  orchestration (formerly `specloom`).

The methodology lives in one place; each project keeps only its own context
and a lockfile pinning the compatible methodology range.

## Install (global, once)

```bash
playbook install                      # install core skills into all targets (default)
playbook install --runtime claude     # only Claude Code                 (~/.claude/skills)
playbook install --runtime copilot    # only GitHub Copilot              (~/.agents/skills)
playbook install --runtime codex      # only Codex                       (~/.agents/skills)
playbook install --runtime all        # Claude + shared agents target    (default)
playbook install --addon confluence   # opt-in add-ons (combine with --runtime)
```

Claude Code uses `~/.claude/skills`; GitHub Copilot and Codex share
`~/.agents/skills`. Add-ons are never installed implicitly. Install locations
can be redirected (CI, sandboxes) with `PLAYBOOK_CLAUDE_SKILLS_DIR` and
`PLAYBOOK_AGENTS_SKILLS_DIR`.

## Connect a project

```bash
playbook init         # scaffold/connect project-local files (never overwrites)
playbook doctor        # read-only health check (--fix for safe additive fixes)
```

`playbook init` creates only what's missing: `playbook.config.yaml`,
`playbook.lock`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`,
the consumer doc set
`docs/{agent_architecture,doc_architecture,doc_verification_guide,sdd-workflow,security-checklist}.md`,
`openspec/specs/system.md`, `openspec/changes/`, and
`.github/workflows/{playbook-validation,archive-cleanup}.yml`. Existing
equivalent docs are **adopted by configuration**, never overwritten.

Run the **`sdd-bootstrap-project`** skill (say "sdd-bootstrap-project" in
Claude Code, GitHub Copilot, or Codex) to detect real capabilities from
concrete signals, propose candidate sibling repos for multi-repo topology
(scanning the parent directory for git repos — see
[Multi-repo](#multi-repo-optional)), and propose a diff — it never writes
without approval.

## Command reference

| Command | Purpose |
|---|---|
| `install` | Install/refresh core skills into the global agent dirs |
| `init` | Scaffold/connect the project-local structure (never overwrites) |
| `doctor` | Read-only diagnostics (`--fix` = safe additive fixes) |
| `status` | Print both dimensions: lifecycle + GitHub delivery |
| `next` | The single next valid action (combines both dimensions) |
| `validate` | Validate artifacts/config against JSON Schemas (`--ci` for pipelines) |
| `sync` | Reconcile `playbook.lock` with the installed methodology version |
| `adr promote <change-id>` | Promote accepted/rejected ADR drafts to numbered records |
| `packet <change-id>` | (Re)generate `context-packet.md` from proposal + tasks |
| `spec-read <file#anchor>` | Read one section of a permanent spec |
| `spec-index` | Rebuild the local structural index of permanent specs |
| `run -- <cmd>` | Run a verification command with compacted output + telemetry |
| `repo-plan <change-id>` | Read-only multi-repo plan (requires `repos:` in config) |
| `commit-plan <change-id>` | Read-only PR-payload plan per impacted repo |
| `prepare-repos <change-id>` | Create/switch the change branch per impacted repo (branches only) |
| `gate-check <change-id>` | Run each impacted repo's verification commands locally |
| `changed-files <change-id>` | Diff-first changed-file list (optionally `--repo`) |
| `contract-drift <generated.yaml>` | Structural OpenAPI diff vs. the canonical contract |

Global flags: `--json`, `--cwd`, `--config`, `--quiet`, `--yes`, `--version`.

## Two-dimension state model

`playbook status` reports **two independent dimensions**:

- **lifecycle** (methodological, computed from local artifacts):
  `proposal_draft → proposal_approved → designed → planned → implementing →
  implemented → reviewed → security_cleared → runtime_cleared → verified →
  archived`. `failed`/`blocked` are exception views.
- **delivery** (local Git + GitHub): `uncommitted → committed → pr_open →
  ci_pending → ci_passed | ci_failed → merged`, or `unknown` when GitHub context
  is unavailable (never assumed).

`playbook next` combines them into one action. **The CLI — not the language
model — is the authority on state and next step.**

## Lifecycle skills

`sdd-enrich-us` (pre-process) → `sdd-new` → *human approval* → `sdd-design`
(when required) → `sdd-plan` → `sdd-apply` → `sdd-code-review` →
`sdd-security-gate` → `sdd-runtime-gate` → `sdd-commit` → *CI* → *merge* →
`sdd-verify` → `sdd-archive`. `sdd-next` asks the CLI what to run.

- **Security is core.** Risk is classified in the proposal, refined in the
  design, and enforced by `sdd-security-gate` (blocking findings block; it does
  **not** replace a penetration test).
- **One runtime gate.** `sdd-runtime-gate` unifies UX/UI and E2E checks into a
  single gate, selecting adapters from project `capabilities` (`browser`,
  `http`, `cli`, `worker`). A `false` capability is `not_applicable`; an
  unimplemented or dependency-missing adapter **blocks** — it never fabricates
  `passed`.
- **ADRs are a first-class artifact.** A hard-to-reverse decision made during
  `sdd-new`/`sdd-apply` becomes an `adr-*.md` draft; `sdd-archive` promotes it
  to a numbered, immutable record under `openspec/specs/adr/`.

## Capability model

Set what your project actually is in `playbook.config.yaml`:

```yaml
capabilities:
  browser: true    # web UI → Playwright-driven runtime checks
  http: true       # REST surface → API runtime checks
  cli: false       # experimental adapter
  worker: false    # experimental adapter
```

Backend-only projects (`browser: false`) never invoke Playwright. Set these by
running `sdd-bootstrap-project` or by editing the file directly.

## Multi-repo (optional)

A project that spans more than one repository (e.g. a `loom` hub + `backend` +
`frontend`) declares them under `repos:` in `playbook.config.yaml`:

```yaml
repos:
  loom:
    role: sdd
    path: "."
  backend:
    path: "../backend"
    default_base: main
    verification:
      test: "npm test"
contract:
  source_of_truth: "loom-first"
  path_in_loom: "openspec/specs/contracts/openapi.yaml"
gating:
  strategy: "per-feature"
```

A single-repo project omits `repos:` entirely — nothing above is required.
`sdd-bootstrap-project` can propose this block for you: it scans the parent
directory for git-repo siblings and presents **every** one it finds — naming
affinity (e.g. a shared `myproduct-` prefix) only sorts likelier candidates
first, it never filters, since a hub can be named unlike its siblings
(`playbook-ai` + `frontend` + `backend` share no token) and a real dev machine
is usually full of unrelated repos too. You confirm which ones apply and
supply their verification commands; nothing is written without approval.

A change's `## Impacted repos` + `## Files touched` (grouped by repo name,
`- <repo>: <path>`) in `proposal.md` drive `repo-plan`/`commit-plan`;
`prepare-repos` is the only mutator (branches only — never
add/commit/push/`--force`).

## Contract-first (optional)

When a backend's API is shared by one or more frontends, the hub owns the
contract: it's authored in `openspec/specs/contracts/openapi.yaml` —
**loom-first**, during `sdd-design`, before the backend implements it — and
starts as `paths: {}`, filled in feature by feature. It lands in the design
stage so the endpoints enter the same human sign-off as `design.md`; a change
triggers the step by declaring `impact.public_contract: true`.
`playbook contract-drift
<generated-openapi>` runs a structural diff (missing/extra endpoints,
missing/extra required fields — not full semantic equivalence: it won't catch
a field's type silently changing) between that canonical contract and an
OpenAPI document generated from the backend's actual implementation:

```bash
playbook contract-drift path/to/generated-openapi.yaml
```

It reads `contract.path_in_loom` from `playbook.config.yaml` (see the
`Multi-repo` block above) — set it once the hub has a real contract to check
against. The check runs in **the backend's own CI**, not in this hub repo:
install `templates/project/github/workflows/contract-drift-check.yml` there
and fill in its two stack-specific TODOs (how to reach the hub's contract,
how to generate this backend's OpenAPI document).

## Token efficiency

- **`context-packet.md`** — generated by `sdd-plan` from `proposal.md` +
  `tasks.md` (verbatim acceptance criteria, constraints, security
  considerations, files touched, verification commands). Gates/commit/verify
  read this instead of both full sources.
- **`playbook run`** — every verification command goes through here: a
  one-line summary on success, exit code + last 40 lines on failure, with the
  full output always on disk at `.playbook/runs/<run-id>/full.log`.
- **`playbook spec-read`/`spec-index`** — section-first reads over permanent
  specs, backed by a structural index that stores headings, never bodies.

## Validation & CI

`playbook validate --ci` validates frontmatter against JSON Schemas, checks
body-section completeness (proposal/design/ADR/context-packet), legal
lifecycle states, preconditions, gates, adapter consistency, and cross-artifact
consistency — using **structured statuses**, never verdict-string/heading/emoji
matching, and never mutating artifacts. The shipped
`.github/workflows/playbook-validation.yml` runs only `playbook validate --ci`.

## GitHub only

`playbook-ai` supports **GitHub** exclusively as the remote provider (branches,
PRs, Actions, checks, merge). `github.require_pull_request` and
`github.require_ci` are mandatory.

## Add-ons

Confluence flows live under `addons/` and install only on explicit opt-in
(`--addon confluence` or `addons.confluence: true`):
`document-code` (AS-IS technical docs), `operational-guide` (Spanish user
manuals for Operations/Support), `code-audit-comment` (evidence-anchored
inline audit comments against existing docs).

## Development (this repo)

```bash
npm ci
npm test              # node --test test/*.test.js
npm run generate       # regenerate skills/<name>/SKILL.md from canonical.md
npm run generate:check # CI: fail if SKILL.md is out of sync with canonical.md
```

Skills are authored once as `skills/<name>/canonical.md` (frontmatter +
Purpose/Context/Behavior/Output/Rules body) and generated into
`skills/<name>/SKILL.md` — the file `playbook install` actually copies into the
global targets. Never edit a `SKILL.md` by hand; edit `canonical.md` and run
`npm run generate`.

The repo dogfoods itself: `playbook status` / `playbook next` run against the
active change under `openspec/changes/`.
