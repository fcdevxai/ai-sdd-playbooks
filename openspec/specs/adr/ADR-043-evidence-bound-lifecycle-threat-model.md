---
schema: adr
status: accepted
date: "2026-10-08"
ticket: harness-trust-restoration
---

# ADR: Lifecycle gates require source-bound evidence, under an honest-error threat model

## Context

Before `0.10.0`, the lifecycle advanced on scalar report statuses: a report claiming
`status: passed` was enough, `playbook run` buffered and truncated output, child exit
codes were collapsed, nothing recorded which source a gate had judged, and archive could
delete the only proof of verification. An audit of the LIA harness showed agents and
humans could, by mistake, advance a change on stale, partial or missing evidence.

## Decision

1. **Lossless capture.** `playbook run` captures stdout and stderr losslessly to private
   files, preserves the child exit (127, 126 and `128 + signal` for spawn and signal
   failures) and writes a schema-validated execution receipt per run.
2. **Source-bound handoff.** `playbook packet --stage` writes a handoff manifest that
   references every governed artifact by repository, path and byte hash, plus each
   repository's branch, commit and governed-content digest.
3. **Sealed gates.** A gate counts only when its report is sealed to the current stage
   manifest and to valid receipts, and its governed content is still fresh. Identical
   content across a later commit is accepted only through an explicit, immutable binding.
4. **One evaluator.** `validate`, `status`, `next` and stage preconditions share one
   eligibility evaluator, so no command can bypass a rule another enforces.
5. **Complete runtime coverage.** Every AC, EC and SEC maps to runtime evidence or is
   declared non-runtime with a rationale; every enabled capability of every impacted
   repository needs a passed adapter or a validated exclusion.
6. **Retained closure.** Archive retains a closure index with the verified sources, gate
   reports, receipts and raw evidence before removing the change folder.

**Threat model.** The mechanism defends against honest mistakes by agents and humans:
evidence left stale by real edits, skipped or reordered steps, the wrong stage or report,
missing adapters, paths that escape by accident, partial captures, altered exit codes,
statuses declared without evidence, and verification or archive before merge.

**Accepted limits.**
- It does not defend against deliberate forgery by an actor with write access to the
  repository, its Git internals or index flags, the run store or the private evidence
  store: without signatures, any hash can be recomputed.
- It does not defend against concurrent filesystem mutation during a CLI invocation
  (time-of-check/time-of-use races); its containment checks are static.
- Inputs that supported repositories do not contain are not modeled. Submodules with
  unreviewed content and ambiguous Markdown containers are rejected fail-closed or kept
  as normative content. Non-UTF-8 path names are hashed as ordinary content: a `.env`
  file under a non-UTF-8 directory inside a declared untracked path is read and hashed,
  while the same file under UTF-8 names is excluded. Rejecting such names is a follow-up.
- Hashes prove provenance and internal consistency, not the truth of an external event; a
  receipt for a browser or worker observation is correlation, not attestation.

## Consequences

### Positive

- A gate can no longer be passed by a status line; stale evidence is detected
  mechanically.
- Raw evidence survives the run and the archive.

### Negative

- Every gate costs more steps (packet, run, seal, bind), and multi-repository changes
  without a product runtime surface must declare explicit exclusions.

### Risks

- Stronger guarantees than the threat model can be demanded in review, which does not
  converge. Mitigation: findings outside this threat model are follow-ups, not blockers.

## Alternatives considered

### Cryptographic signing of receipts and reports

Deferred: it needs key management and an external trust anchor. It would be required to
defend against deliberate local forgery, which is outside this threat model.

### Keep scalar statuses with stronger prose instructions

Rejected: the audit showed that prose-only rules are skipped under context pressure.

## Impact

- backend: none
- frontend: none
- security: explicit threat model and accepted limits; no permission decisions in output
  handling
- data: new artifact schemas (handoff manifest, execution receipt, source and evidence
  bindings, closure index)
- deployment: consumers adopt `0.10.0` explicitly; see the CHANGELOG migration notes
- testing: permanent adversarial and regression suites under `test/`
