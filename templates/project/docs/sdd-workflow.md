<!-- sdd-methodology: 3.0 -->
# SDD workflow

The methodology is global; this project keeps only its own context. Claude Code
uses `~/.claude/skills`; GitHub Copilot and Codex share `~/.agents/skills`. Let
the CLI drive: run `sdd next` at any time to get the single next valid step.

## Lifecycle

```
sdd-enrich-us (pre-process)
  → sdd-new → [human approval]
  → sdd-design (when required) → sdd-plan
  → sdd-apply → sdd-code-review
  → sdd-security-gate (when required) → sdd-runtime-gate
  → sdd-commit → [CI] → [merge]
  → sdd-verify → sdd-archive
```

`sdd status` shows two dimensions: the methodological **lifecycle** and the
**GitHub delivery** state. `sdd next` combines them into one action.

## Runtime prerequisites

The SDD skills are shared by filesystem, but runtime tools are not. Claude Code,
GitHub Copilot, and Codex each need their own MCP/tool configuration.

- `capabilities.browser: true` means `sdd-runtime-gate` needs a Playwright MCP
  available in the active runtime. If it is missing, the browser adapter is
  `blocked` with `DEPENDENCY_UNAVAILABLE`; do not simulate UI evidence.
- `addons.confluence: true` means the Confluence add-on skills need an
  authenticated Atlassian MCP in the active runtime before publishing or
  commenting in Confluence.
- `sdd doctor` reports these as readiness notes. It does not install or
  authenticate MCP servers.

## Rules

- Only a human sets `proposal.status: approved` (and `design.status: approved`).
- Machine-readable fields (status, impact, security, capabilities) stay in English.
- Never skip a gate; a blocking finding blocks the change until resolved.
