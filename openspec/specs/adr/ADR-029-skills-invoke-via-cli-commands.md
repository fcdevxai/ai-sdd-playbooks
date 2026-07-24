---
schema: adr
status: accepted
date: "2026-07-24"
ticket: cli-detect-siblings
---

# ADR: Skills invoke capabilities through `playbook` commands, never through internal source references

## Context

`sdd-bootstrap-project` step 3 tells the executing agent to run the sibling
detector "`detectSiblingRepos` in `src/config/detect-siblings.js`". That is an
internal JavaScript function with no CLI wrapper — no `playbook` command exposes
it (confirmed: no `detect`-family command in `src/cli/dispatch.js`). To follow
the instruction, the agent must open the source file and execute JS by hand, or
eyeball the parent directory. Both are fragile and non-deterministic.

This is a symptom of a broader class of defect inherited from the specloom
merge (see ADR-026): capabilities that are implemented and tested in `src/` but
reachable from the workflow only through prose that names an internal function
or file path, rather than through a stable command. When the "invocation" is a
source reference, the skill's contract silently depends on the agent's ability
to run arbitrary JS and on the internal file layout — and it breaks quietly when
the agent can't or the layout changes. This is part of why the ADR-028 bootstrap
re-run bug was so easy to introduce: the fix says "re-invoke the detector" but
there was never a clean way to invoke it.

## Decision

A skill MUST invoke a capability through a stable `playbook <command>`, never by
referencing an internal source function or file path as the thing to execute.
If a capability a skill needs is implemented in `src/` but has no CLI surface, a
thin CLI command is added to expose it before the skill is wired to it. Internal
function/file references in skill prose are allowed only as explanatory context
(e.g. "the same heuristic as `detectSiblingRepos`"), never as the invocation
mechanism.

This change applies the rule to `sdd-bootstrap-project` step 3 by adding
`playbook detect-siblings` (a read-only wrapper over the existing, unchanged
`detectSiblingRepos`) and pointing the skill at the command. It establishes the
precedent for the remaining wiring gaps catalogued in the workspace migration
plan (notably wiring `playbook spec-index` for discovery).

## Consequences

### Positive
- Skill instructions become executable and deterministic — the agent runs a
  documented command, not ad-hoc JS.
- The CLI becomes the single, testable surface between skills and capabilities;
  internal refactors of `src/` no longer silently break skill contracts.
- Names a reusable rule other skills/capabilities can be audited against, which
  is exactly the class of gap the specloom merge left behind.

### Negative
- Exposing a capability now costs a thin CLI command (handler + dispatch entry +
  tests) rather than a one-line prose reference. Accepted: the wrapper is small
  and the pattern already exists (`repo-plan`, `commit-plan`).

### Risks
- None security-relevant for this change: the command exposed is read-only and
  adds no new surface beyond what `detectSiblingRepos` already read. The general
  rule could, in principle, be used to expose a sensitive capability via CLI —
  but each such command is gated by its own security review, unchanged by this ADR.

## Alternatives considered

### Keep the internal function reference, teach the agent to run JS
Rejected: makes every skill depend on the agent's ability and willingness to
execute arbitrary source, and on the internal file layout. Non-deterministic and
brittle — the exact failure mode this ADR removes.

### Expose the capability ad-hoc per skill, without a stated convention
Rejected: fixes the one instance (bootstrap) but leaves the class open. The
value here is the named, auditable rule, so the other ported-but-unwired
capabilities get closed the same way instead of re-litigated each time.

## Impact

- backend: adds a thin read-only CLI command (`detect-siblings`) wrapping an existing function
- frontend: no impact
- security: no impact — read-only, no new surface beyond existing `detectSiblingRepos`
- data: no impact
- deployment: no impact
- testing: new command tests + a skill-contract content assertion
