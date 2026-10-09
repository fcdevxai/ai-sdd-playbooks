---
schema: adr
status: accepted
date: "2026-10-08"
ticket: harness-trust-restoration
---

# ADR: A change that modifies the lifecycle gate itself is delivered outside that gate (bootstrap exception)

## Context

This repository dogfoods SDD: its own changes normally go through the lifecycle that
`playbook` enforces. Change `harness-trust-restoration` rewrote that enforcement — the
evidence capture, the handoff manifest, the single eligibility evaluator behind
`validate`, `status`, `next` and stage preconditions, and the seal, bind and retain
operations.

Running that change through its own gate meant that the program under review was also the
judge. Three effects made the change unable to finish:

- The globally installed `playbook` resolved to the development checkout, and this
  repository's CI validates a pull request with the binary from that same pull request.
  Every remediation changed the rules the next review applied.
- The change declared its `cli` surface relevant. The `cli` adapter is experimental and
  can never emit `passed` (ADR-032), so the change's own runtime gate could not clear as
  declared.
- The review exit rule was itself written inside the change (design Amendments R5 and
  R6). Ten reviews produced 34 issues without converging, and the eleventh moved to a new
  class (filesystem races).

## Decision

A change whose subject is the lifecycle gate itself — the code that decides eligibility,
freshness, sealing, binding or retention — is delivered outside the SDD lifecycle gate
under a written closure contract:

1. **Closed checklist.** The change's design records a closed acceptance checklist and a
   bounded threat model. The checklist is the only completion criterion.
2. **Bounded review.** One closure review against that checklist, plus one delta round
   restricted to its blocking findings. A finding blocks only if it cites a checklist
   item, describes a realistic scenario inside the threat model and reproduces in the real
   flow. Anything still open after the delta round is a human decision.
3. **Independent completion evidence.** The test suite on the CI matrix, a private-clone
   simulation of pull-request and post-merge CI, human approval of the pull request and a
   release tag. The change's failed gate reports remain as history and are never
   rewritten to `passed`.
4. **The installed CLI is always a release.** The global `playbook` resolves to a clean
   checkout of a released tag. Development happens in a separate worktree and is run by
   explicit path, so no consumer is governed by unreleased code.

Ordinary changes to this repository — skills, documentation, or code that does not alter
the gate — keep dogfooding the lifecycle. This exception does not extend to consumer
projects.

## Consequences

### Positive

- A change to the gate can finish: its completion no longer depends on rules it is still
  rewriting.
- Consumers are never governed by unreleased lifecycle rules.

### Negative

- The repository loses dogfooding for this class of change; traceability comes from the
  closure contract, the review report and the pull request instead of sealed gates.

### Risks

- The exception could be used to skip the lifecycle for ordinary work. Mitigation: it
  applies only when the change modifies the gate code itself, and the closure contract
  must be written into the design and approved by a human before the closure review.

## Alternatives considered

### Keep dogfooding with the development checkout as the judge

Rejected: this is the configuration that did not converge after ten reviews.

### Dogfood with the last released CLI as the judge

Viable, but of little value for this class of change: the previous release judges by
scalar statuses, so passing its gates certifies nothing about the new rules while keeping
the full ceremony, and the review exit rule still has to be bounded. A future gate change
may choose it in its closure contract.

## Impact

- backend: none
- frontend: none
- security: the closure contract keeps the threat model and accepted limits explicit
  (ADR-043)
- data: none
- deployment: the global installation must resolve to a released tag
- testing: the full suite on Node 18 and Node 20, plus private-clone CI simulation
