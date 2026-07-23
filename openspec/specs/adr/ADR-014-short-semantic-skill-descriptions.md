---
status: accepted
date: 2026-07-05
ticket: catalog-kernel-token-reduction
---

# ADR: Short Semantic Skill Descriptions

## Context

SpecLoom Agent Skill activation depends on the `description` frontmatter field. The current convention preserves activation coverage by listing many English and Spanish trigger phrases, including systematic accented and unaccented duplicates. The token audit identified this catalog as fixed context paid in every agent turn, and `openspec/specs/playbooks/spec.md` currently encodes the long-description convention.

## Decision

Agent Skill descriptions will be short semantic activation contracts. Each canonical `description` must include the explicit `sdd-*` skill name, the lifecycle purpose, key artifacts, and compact English and Spanish trigger intent. Systematic trigger phrase lists and accent-variant duplication are not required. `description_es` remains supporting localized metadata and must stay aligned with `description`.

## Consequences

### Positive

- Reduces fixed catalog tokens in Claude Code and Codex sessions.
- Keeps activation intent in the frontmatter field that agents actually scan.
- Makes future playbook metadata easier to review and maintain.

### Negative

- Removes some exact phrase matches that previously appeared verbatim.
- Relies more on semantic matching by the agent harness.

### Risks

- A skill may trigger less reliably for an uncommon phrase that was removed from the long list.
- Future authors may shorten descriptions too far and omit lifecycle context.

## Alternatives considered

### Keep exhaustive phrase lists

Rejected because it preserves the fixed-token cost and manual drift that the token audit identified.

### Move Spanish trigger intent only to `description_es`

Rejected because Agent Skill matching uses `description` as the primary activation signal.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: sin impacto
- data: sin impacto
- deployment: sin impacto
- testing: tests must assert short descriptions keep explicit `sdd-*` and bilingual trigger intent
