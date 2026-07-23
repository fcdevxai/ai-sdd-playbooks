---
schema: adr
status: accepted
date: "2026-07-23"
ticket: bootstrap-repos-diff-on-rerun
---

# ADR: Stateful bootstrap skills treat existing config as a diff baseline, not a completion signal

## Context

`sdd-bootstrap-project`'s sibling-repo step (paso 3) proposes candidates from
`detectSiblingRepos` (`src/config/detect-siblings.js`), a stateless,
filesystem-only detector: every run lists every git-repo sibling in the parent
directory, regardless of what is already in `playbook.config.yaml`.

In production use, a consumer project ran `sdd-bootstrap-project` once,
approved a `repos:` block, then added a new sibling repo and re-ran the skill.
The new repo was never proposed. The detector itself was not at fault — it
would have listed the new sibling. The gap was in the skill's instructions:
paso 3 never told the executing model what to do on a re-run when `repos:`
already has entries, so the model reasonably read "already populated" as
"already resolved" and skipped re-detection entirely.

This is not unique to `repos:` — any bootstrap/onboarding skill that proposes
into a config block faces the same ambiguity on re-run: is a non-empty block a
completed decision, or a stale snapshot that needs to be reconciled with
current reality?

## Decision

A stateful bootstrap/re-run skill MUST treat a config value it previously
populated as a **diff baseline**, not a signal that the step is done. On every
run — first or Nth — it re-invokes its detector against current reality and
presents only the candidates not already reflected in the config. An
already-populated block never causes the skill to silently skip detection.

This change applies the rule to `sdd-bootstrap-project` paso 3 (`repos:`)
only — the scope proposing this ADR. Extending the same rule to the other
re-runnable steps of the same skill (capabilities, document mappings) or to
other bootstrap-style skills is a separate decision, made when/if that gap is
independently confirmed.

## Consequences

### Positive
- `sdd-bootstrap-project` re-runs become incremental: adding a sibling repo
  later in a project's life gets picked up without hand-editing
  `playbook.config.yaml`.
- Establishes a named precedent other bootstrap-style skills can cite instead
  of re-deriving the same reasoning independently.

### Negative
- Every re-run now always re-scans the parent directory for siblings, even
  when nothing changed — a cheap, read-only filesystem walk, not a
  meaningful cost.

### Risks
- None security-relevant: this only changes when a read-only, filesystem-only
  detector is invoked and what is shown to the human for approval; it never
  changes what gets written without explicit approval.

## Alternatives considered

### Only re-detect when the human explicitly asks ("re-scan for new repos")
Rejected: reintroduces the exact failure mode this ADR fixes — the human has
to remember the block might be stale and ask for a re-scan by name, instead of
the skill behaving correctly by default on every run.

### Track a "last scanned" timestamp/hash in `playbook.config.yaml` to skip unchanged re-scans
Rejected as unnecessary complexity: the detector is a cheap directory listing,
not an expensive operation; adding persisted scan-state to the config is a
schema change to solve a performance problem that does not exist.

## Impact

- backend: no impact — instruction-only change to a skill's canonical.md
- frontend: no impact
- security: no impact — read-only detection, human still approves before write
- data: no impact
- deployment: no impact
- testing: `test/skill-contract.test.js` gains a content assertion for the new instruction
