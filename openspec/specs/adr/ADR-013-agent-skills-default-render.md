---
status: accepted
date: 2026-07-05
ticket: catalog-kernel-token-reduction
---

# ADR: Agent Skills Default Render

## Context

SpecLoom originally defaulted `sync` and Claude initialization to slash commands. After Codex support was added, the same playbooks can render to Agent Skills for both Claude Code and Codex. In Claude Code dogfooding, generating both slash commands and skills duplicates the SDD catalog in fixed context. The token audit identified the duplicated catalog as a universal per-turn cost for Claude Code sessions, while Agent Skills are the shared surface across both supported harnesses.

## Decision

The default generated surface becomes Agent Skills. `node framework/scripts/sync.js` and `loom sync` without `--target` generate skills. `commands` remains an explicit target for Claude slash-command users, and `all` remains available for projects that intentionally want both surfaces. `loom init` without `--agent` scaffolds `CLAUDE.md` and generates Agent Skills by default.

## Consequences

### Positive

- Aligns the default with the shared Claude/Codex Agent Skills surface.
- Reduces duplicated Claude Code catalog context when projects avoid `all`.
- Keeps slash-command support for users that explicitly choose it.

### Negative

- Users accustomed to default slash-command generation must pass `--target commands`.
- Documentation and tests must be updated wherever they describe legacy defaults.

### Risks

- Existing consumer automation that calls `sync` without `--target` and expects slash commands will stop updating `.claude/commands`.
- Claude Code users who rely only on slash commands may need a one-time workflow adjustment.

## Alternatives considered

### Keep `commands` as the default

Rejected because it leaves the highest-frequency fixed-context duplication in place and makes the portable Agent Skills surface opt-in.

### Change only the specloom dogfood repo

Rejected because consumers would keep inheriting the less efficient default and documentation would diverge from framework behavior.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: supply-chain/dev-tooling surface only; destination helpers must continue preventing writes inside `node_modules`
- data: sin impacto
- deployment: consumers may need to adjust post-update commands or automation that assumed default commands
- testing: sync/init tests must cover default skills, explicit commands, and all targets
