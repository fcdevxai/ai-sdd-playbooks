---
schema: proposal
schema_version: 1
change_id: runtime-gate-change-relevance
title: "Runtime gate: per-change capability relevance (fix the permanent experimental-adapter deadlock)"
status: draft
owner: felipe.campos
created: 2026-07-16
updated: 2026-07-16
delivery:
  provider: github
impact:
  public_contract: true          # new optional proposal.md field + adapter-planning signature change
  data_model: false
  architecture_boundary: true    # touches the runtime-gate/lifecycle contract
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: []
---

# Runtime gate: per-change capability relevance

## Objective

Fix a confirmed structural gap: a project-wide capability flag (`worker`/`cli`
in `sdd.config.yaml`) permanently blocks **every** change's runtime gate —
whether or not that specific change touches the capability's surface — because
`sdd-runtime-gate` has no notion of per-change relevance, only project-wide
capability. Add an optional, explicit **per-change relevance** declaration so a
change that genuinely doesn't touch an experimental (or any) capability can
correctly report `not_applicable` for it, without disabling the capability for
the rest of the project.

## Background

Confirmed in source (not assumed):

- `planRuntimeAdapters(capabilities)` (`src/adapters/index.js`) derives each
  adapter's status **purely from `sdd.config.yaml` capabilities** — `worker`/`cli`
  with capability `true` always plan `blocked` (`ADAPTER_NOT_IMPLEMENTED`), with
  zero awareness of what any specific change touches.
- The lifecycle engine (`src/lifecycle/engine.js`) requires
  `runtime-gate-report.md` status in `['passed', 'not_applicable']` to reach
  `runtime_cleared` — `blocked` can never satisfy that.
- `sdd validate --ci` (`src/cli/validate.js`) only checks that a report's
  declared `status` matches the aggregate of its own `adapters` — it never
  cross-checks the report's adapters against `sdd.config.yaml` or against what
  the change actually touches. Today, "never fabricate passed" is purely a
  skill-instruction convention, not something the CLI enforces or informs.

Net effect, observed on a real project: a project that legitimately has
background-job infrastructure (so `worker: true` is an honest project-level
fact) permanently freezes **every future change's** runtime gate — including
changes with zero relation to queues/jobs — because the capability is
all-or-nothing at the project level while its consequence (blocked forever)
applies uniformly to every change.

## Scope

**Add — per-change relevance declaration**

- New optional `proposal.md` field, sibling to `impact`/`security`:
  `runtime_relevant_capabilities: [<subset of browser|http|cli|worker>]`.
- **Absent** (all existing proposals) → fully backward compatible: treated as
  "every project-enabled capability is relevant to this change" (today's
  behavior, unchanged).
- **Present** → only the listed capabilities are evaluated for this change; a
  project-enabled capability **not** listed becomes `not_applicable` for this
  change's report, with a reason distinguishing "not relevant to this change"
  from "project doesn't have this capability at all" (`false`).
- Applies uniformly to all four capabilities (not just experimental ones) —
  same mechanism, same field; the acute pain point today is `cli`/`worker`
  (permanent block), but the relevance question is equally valid for
  `browser`/`http`.

**Change — adapter planning**

- `planRuntimeAdapters(capabilities, relevantCapabilities?)`: when the second
  argument is provided, a capability `true` at the project level but absent
  from it plans `not_applicable` with a new reason code
  (`NOT_RELEVANT_TO_CHANGE`) instead of its normal outcome. When the second
  argument is omitted, behavior is identical to today (backward compatible).

**Change — two skills**

- `sdd-new` (or `sdd-enrich-us`, whichever authors the proposal): propose
  `runtime_relevant_capabilities` from concrete signals grounded in the actual
  requirement — mirroring how `sdd-bootstrap-project` proposes `capabilities`
  from real signals, never guessed silently. Human approves/corrects alongside
  `impact`/`security`.
- `sdd-runtime-gate`: read `runtime_relevant_capabilities` from `proposal.md`
  (when present) alongside `sdd.config.yaml` capabilities to determine which
  adapters need real evidence for **this** change; excluded-but-project-enabled
  capabilities are `not_applicable` with the new reason code.

**Add — a cross-artifact validate check**

- `sdd validate --ci`: when a runtime-gate-report marks an adapter with a
  status other than `not_applicable` / `blocked(ADAPTER_NOT_IMPLEMENTED)` for a
  capability the proposal explicitly excluded via
  `runtime_relevant_capabilities`, flag it — closes the honor-system gap so
  this isn't purely convention.

**Out of scope (non-goals)**

- Not implementing a real `worker`/`cli` runtime adapter (that's a separate,
  much larger effort).
- Not adding a "waived" report status — relevance is declared **before**
  implementation (at proposal time), not used to retroactively excuse a gate
  result.
- Not changing `browser`/`http` adapter behavior when they ARE relevant —
  unaffected.
- Not touching `sdd.config.yaml`'s project-level `capabilities:` semantics —
  it still means "does the project have this surface at all."

## Acceptance criteria

- **AC-01** `proposal.schema.json` accepts an optional `runtime_relevant_capabilities` (array, subset of `browser|http|cli|worker`); absent → schema-valid, no behavior change.
- **AC-02** `planRuntimeAdapters(capabilities, relevantCapabilities)`: with the second arg omitted, output is byte-identical to today for all existing tests. With it provided, a project-enabled capability excluded from the list plans `not_applicable` / `NOT_RELEVANT_TO_CHANGE`; one included keeps its normal outcome (`pending` supported / `blocked ADAPTER_NOT_IMPLEMENTED` experimental).
- **AC-03** A change whose proposal declares `runtime_relevant_capabilities: []` (or omits `worker`) in a project with `worker: true` can reach `runtime_cleared` — the permanent deadlock is fixed for changes that genuinely don't touch the capability.
- **AC-04** A change that DOES declare `worker` as relevant still blocks exactly as today (`ADAPTER_NOT_IMPLEMENTED`) — the fix narrows scope, it does not weaken the "never fabricate passed" guarantee for changes that actually touch the capability.
- **AC-05** `sdd-new`/`sdd-enrich-us` propose `runtime_relevant_capabilities` from concrete requirement signals (never silently guessed) for human approval; `sdd-runtime-gate` reads and honors it.
- **AC-06** `sdd validate --ci` flags a runtime-gate-report that reports anything other than `not_applicable` for a capability the proposal explicitly excluded.
- **AC-07** Full test suite green; no regression in existing adapter/engine/validate/skill-contract tests.

## Risks

- **R-01 — Silent under-declaration.** A change could under-declare relevance to dodge a legitimate gate (the exact abuse "never fabricate passed" guards against). *Mitigation:* relevance is proposed from concrete signals and requires explicit human approval at proposal time (AC-05), same trust model as `impact`/`security`; AC-06's validate check catches an inconsistent report after the fact.
- **R-02 — Backward-compat break.** Existing proposals/tests assume today's all-capabilities-relevant behavior. *Mitigation:* the field is optional and its absence is defined to mean exactly today's behavior (AC-02); every existing test must stay green.
- **R-03 — Scope creep into "waived" territory.** Confusing per-change relevance (declared before implementation) with a retroactive waiver invites gaming after the fact. *Mitigation:* explicitly out of scope (no waived status); relevance is a pre-implementation declaration, reviewed like any other proposal field.

## Design

`design_required` is **true** (architecture_boundary + public_contract). See
`design.md` for the exact schema addition, the `planRuntimeAdapters` signature
change, the two skill updates, the new reason code, and the validate cross-check.

## Open technical decisions

- Exact field name (`runtime_relevant_capabilities` vs alternatives) and reason
  code name (`NOT_RELEVANT_TO_CHANGE` vs alternatives) — confirm in design.
- Whether `sdd-new` or `sdd-enrich-us` is the right place to propose the field —
  confirm in design (mirrors where `impact`/`security` get proposed today).
