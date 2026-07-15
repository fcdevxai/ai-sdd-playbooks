# Changelog

## 2.0.0 — Global methodology, npm CLI, deterministic lifecycle

Ground-up redesign specified in [`openspec/changes/sdd-2.0/`](openspec/changes/sdd-2.0/).

### Added
- **`sdd` CLI** with `install`, `init`, `doctor`, `status`, `next`, `validate`,
  `sync`, `migrate` (+ `--version`).
- **Global install** of core skills into `~/.claude/skills` and `~/.agents/skills`;
  consumer projects keep only their own context + `sdd.lock`.
- **Canonical Agent Skills** at `skills/<name>/SKILL.md`, consumable by Claude
  Code and GitHub Copilot via one shared frontmatter contract.
- **Deterministic two-dimension lifecycle engine** (methodological `lifecycle` +
  GitHub `delivery`); `sdd status` / `sdd next` / the `sdd-next` skill.
- **Structured artifacts**: frontmatter metadata, normalized statuses, JSON
  Schemas, and `sdd validate --ci` (no verdict-string matching, no mutation).
- **Security as a core stage**: risk classified in the proposal, refined in the
  design, enforced by `sdd-security-gate` (blocking findings; non-replacement
  disclaimer).
- **`sdd-runtime-gate`** replacing the separate UX and E2E gates, driven by
  project `capabilities` (`browser`/`http` supported, `cli`/`worker`
  experimental → block when applicable).
- **New lifecycle skills**: `sdd-design`, `sdd-plan` (replaces `sdd-ff`).
- **`sdd migrate`** (diff-then-confirm) and the **`sdd-bootstrap-project`** skill
  (AI-assisted, human-approved onboarding).
- **Compatibility-by-range** methodology pinning (`sdd.lock`), enforced by
  `sdd doctor`.
- **Add-on separation**: Confluence flows under `addons/`, installed only on
  explicit opt-in.

### Changed
- Machine-readable fields (statuses, impact, security, capabilities) are stable
  in English; human-readable bodies may use the project language.
- GitHub is the only supported remote provider.

### Deprecated
- `sdd-ff` — prints a deprecation notice; use `sdd-design` + `sdd-plan`.
- The 1.x pipeline (`playbooks/`, `dist/claude-commands/`, `scripts/`) is frozen
  in place; physical removal is deferred to 3.0.

### Compatibility
- The 1.x submodule flow keeps working unchanged during the deprecation window.
- `sdd sync --legacy` regenerates the frozen 1.x command files.
