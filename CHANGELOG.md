# Changelog

## 3.0.0 — Spec-Driven Development baseline

SDD 3.0 is the clean baseline: a globally-installed set of Agent Skills plus a
deterministic `sdd` CLI, shared by Claude Code, GitHub Copilot, and Codex. Every
project starts here.

### Methodology & CLI
- **`sdd` CLI** with seven commands: `install`, `init`, `doctor`, `status`,
  `next`, `validate`, `sync` (+ `--version`).
- **Global install** of core skills into `~/.claude/skills` and
  `~/.agents/skills`; GitHub Copilot and Codex share the `agents` target, and
  consumer projects keep only their own context + `sdd.lock`.
- **Deterministic two-dimension lifecycle engine** (methodological `lifecycle` +
  GitHub `delivery`); `sdd status` / `sdd next` / the `sdd-next` skill decide the
  state and the next step — not the language model.
- **Compatibility-by-range** methodology pinning in `sdd.lock`
  (`>=3.0.0 <4.0.0`), enforced by `sdd doctor`.

### Skills & artifacts
- **Canonical Agent Skills** at `skills/<name>/SKILL.md`, consumable by Claude
  Code, GitHub Copilot, and Codex through one shared frontmatter contract.
- **Structured artifacts**: frontmatter metadata, normalized statuses, JSON
  Schemas, and `sdd validate --ci` (no verdict-string matching, no mutation).
- **Security as a core stage**: risk classified in the proposal, refined in the
  design, enforced by `sdd-security-gate` (blocking findings; it does not replace
  a penetration test).
- **`sdd-runtime-gate`** unifies UX and E2E checks, driven by project
  `capabilities` (`browser`/`http` supported; `cli`/`worker` experimental and
  block when applicable).
- **`sdd-bootstrap-project`** skill for AI-assisted, human-approved onboarding of
  an existing repo.

### Consumer docs
- A four-doc consumer set scaffolded by `sdd init`: `agent_architecture.md` (how
  agents operate), `doc_architecture.md` (technical structure),
  `doc_verification_guide.md` (verification commands), `sdd-workflow.md` (the SDD
  lifecycle). Existing equivalents are adopted by configuration, never overwritten.

### Conventions
- Machine-readable fields (statuses, impact, security, capabilities) are stable
  in English; human-readable bodies may use the project language.
- **GitHub** is the only supported remote provider;
  `github.require_pull_request` and `github.require_ci` are mandatory.

### Add-ons
- Confluence flows live under `addons/` and install only on explicit opt-in.
