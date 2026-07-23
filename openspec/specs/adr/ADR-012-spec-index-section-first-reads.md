---
status: accepted
date: 2026-07-04
ticket: spec-index-section-reads
# supersedes: ADR-NNN
---

# ADR: Spec index establishes section-first reads for permanent specs

## Context

SpecLoom playbooks repeatedly read permanent source-of-truth files such as `openspec/specs/system.md` and domain specs. Earlier token-optimization phases reduced command output volume and introduced `context-packet.md`, but permanent spec reads still scale with file size and cycle length.

The next optimization needs a cross-cutting convention that lets playbooks locate relevant sections without turning generated metadata into a second source of truth or persisting full spec bodies.

## Decision

SpecLoom will introduce `loom index` as the canonical way to generate structural metadata for permanent specs.

The first version indexes only `openspec/specs/system.md` and `openspec/specs/*/spec.md`. It writes `.specloom/index/spec-index.json` and prints a compact summary. The persisted JSON contains file metadata and heading ranges only: it never stores section bodies.

Section-first playbook consumers are `sdd-ff`, `sdd-code-review`, `sdd-security-gate`, `sdd-ux-gate`, `sdd-commit`, and `sdd-verify`. `sdd-apply` and `sdd-archive` remain full-read flows because they implement from full context or edit permanent specs.

If the index is missing, section-first playbooks regenerate it with `loom index`. If regeneration fails, they fall back to full reads and report the failure reason.

## Consequences

### Positive

- Reduces repeated full reads of `system.md` and domain specs in phases that only need targeted context.
- Keeps permanent specs as the only source of truth because the index stores navigation metadata, not bodies.
- Provides a reusable convention for future token-budget and context-policy work.

### Negative

- Adds another generated local artifact under `.specloom/`.
- Adds parser and line-range logic that must be tested and maintained.
- Playbooks become slightly more complex because they need fallback behavior.

### Risks

- A stale or missing index can cause an agent to miss relevant sections if fallback instructions are not followed.
- Incorrect line ranges can make agents read incomplete sections.
- If future versions store bodies, the index could duplicate sensitive spec content; this ADR rejects that behavior for the first version.

## Alternatives considered

### Keep full reads everywhere

Rejected: this preserves current correctness but does not address the token-growth problem identified after phases 1-3.

### Store section summaries instead of structural metadata

Rejected: summaries introduce drift and can become an alternate source of truth. Section bodies should stay in the permanent specs.

### Enforce index freshness through `loom validate`

Rejected for this phase: `.specloom/index/spec-index.json` is a local generated cache. Blocking PR readiness on cache freshness adds friction before token-budget enforcement is designed.

### Index ADRs, docs, and active changes too

Rejected for this phase: ADRs, docs, and active change artifacts have different read patterns and would broaden scope without directly solving the permanent-spec read hotspot.

## Impact

- backend: Impacts the Node CLI implementation in `framework/cli/loom.js` and supporting helpers in `framework/cli/lib.js`.
- frontend: sin impacto.
- security: Low impact. The feature reads local specs and writes local structural metadata; no external calls, permissions, or command execution are introduced.
- data: Adds local generated metadata under `.specloom/index/spec-index.json`; no section bodies are persisted.
- deployment: sin impacto.
- testing: Requires tests for CLI output, JSON shape, inclusion/exclusion rules, code-fence handling, line ranges, and installed-consumer root resolution.
