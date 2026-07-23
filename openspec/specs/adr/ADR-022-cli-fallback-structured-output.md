---
status: accepted
date: 2026-07-08
ticket: resilient-changed-files-fallback
---

# ADR: CLI fallback structured output for agent workflows

## Context

Several SDD playbooks ask agents to start from bounded CLI helpers before reading broad files or diffs. When a helper such as `loom changed-files` fails because local git state is incomplete, the agent currently has to spend tokens designing a fallback plan from prose: inspect `context-packet.md`, read `tasks.md`, grep relevant files, or compute alternative git state.

That fallback is predictable enough to encode in the framework. Keeping it in playbook prose creates repeated cost and uneven behavior across agents and harnesses.

## Decision

CLI commands that are first-class inputs to agent workflows should prefer bounded, structured, and actionable fallback output when local environmental assumptions fail.

For `loom changed-files`, an explicit `--base` remains strict. Without `--base`, the CLI may try known base refs and then recover through deterministic local SDD sources and local git state. The command should expose fallback metadata through `--json` and compact stderr warnings so agents can continue without inventing a manual plan.

## Consequences

### Positive

- Agents spend fewer tokens recovering from common local checkout differences.
- Playbooks can rely on one CLI contract instead of repeating fallback prose.
- JSON metadata makes fallback state inspectable without parsing human text.
- Explicit flags remain strict for CI and reviewer-controlled flows.

### Negative

- `loom changed-files` becomes more complex than a direct `git diff` wrapper.
- Fallback from `context-packet.md` or `tasks.md` can be less precise than a real merge-base diff.
- Tests must cover more local git topologies.

### Risks

- A stale `context-packet.md` could list files that no longer match implementation reality. This is mitigated by including local git state in fallback results and keeping packet freshness validation in `loom validate`.
- A loose fallback could hide a real CI failure if applied to explicit bases. This is mitigated by preserving strict behavior whenever `--base` is provided.
- Git ref handling remains security-sensitive. Existing ref validation and argv-array git calls must be preserved.

## Alternatives considered

### Keep playbook-only fallback

Rejected. This preserves compatibility but keeps charging every agent for the same recovery reasoning and creates inconsistent fallbacks.

### Always fail when no base is resoluble

Rejected. This is appropriate for explicit CI-style refs, but poor for local agent workflows where useful bounded sources already exist.

### Require agents to pass `--base origin/main`

Rejected. It handles one common checkout shape but does not solve shallow clones, detached worktrees, repos with `master`, or no remote-tracking branch.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: mantiene la superficie local de git/filesystem; requiere conservar validacion de slugs, refs y repos allowlisted
- data: sin impacto en datos de usuario; solo lee artefactos SDD locales
- deployment: sin impacto
- testing: requiere fixtures de git para bases implicitas, fallbacks y salida JSON
