---
schema: design
schema_version: 1
change_id: runtime-gate-change-relevance
title: "Runtime gate: per-change capability relevance — design"
status: draft
owner: felipe.campos
created: 2026-07-16
updated: 2026-07-16
depends_on: proposal.md
security:
  risk: standard
  threat_model_required: false
  controls: []
---

# Runtime gate: per-change capability relevance — design

Technical contract for `proposal.md`. Narrows the runtime gate from
project-wide capability to per-change relevance, additively — no existing
artifact's computed state changes until a human opts a specific change in.

## 1. Schema — `proposal.schema.json`

The proposal schema root has **no `additionalProperties: false`**, so this is
a pure addition (existing proposals validate unchanged either way; the explicit
definition below is for enum/type checking quality, not compatibility):

```json
"runtime_relevant_capabilities": {
  "type": "array",
  "items": { "enum": ["browser", "http", "cli", "worker"] }
}
```

Optional, no `default` in the schema itself (JSON Schema defaults don't apply
to consumers reading raw YAML/frontmatter) — **the "absent" semantics are
enforced in code** (§2), not the schema.

## 2. `planRuntimeAdapters` — signature + semantics

`src/adapters/index.js`:

```js
export function planRuntimeAdapters(capabilities = {}, relevantCapabilities = null) {
  const plan = {};
  for (const [key, desc] of Object.entries(ADAPTERS)) {
    if (!capabilities[desc.capability]) {
      plan[key] = { status: 'not_applicable' };
    } else if (relevantCapabilities && !relevantCapabilities.includes(desc.capability)) {
      plan[key] = { status: 'not_applicable', reason_code: REASON_CODES.NOT_RELEVANT_TO_CHANGE };
    } else if (desc.support === 'experimental') {
      plan[key] = { status: 'blocked', reason_code: REASON_CODES.ADAPTER_NOT_IMPLEMENTED };
    } else {
      plan[key] = { status: 'pending' };
    }
  }
  return plan;
}
```

- `relevantCapabilities = null` (default — **every existing call site**, until a
  caller is updated) → identical output to today, byte-for-byte (AC-02).
- `relevantCapabilities = []`/array → a project-enabled capability **absent**
  from the list plans `not_applicable` / `NOT_RELEVANT_TO_CHANGE` **before** the
  experimental/supported branch — so it takes precedence over
  `ADAPTER_NOT_IMPLEMENTED` for an excluded experimental capability (AC-03),
  while an *included* one falls through to its normal outcome unchanged (AC-04).
- New reason code: `REASON_CODES.NOT_RELEVANT_TO_CHANGE = 'NOT_RELEVANT_TO_CHANGE'`,
  distinct from `ADAPTER_NOT_IMPLEMENTED` (distinguishes "irrelevant to this
  change" from "the project doesn't have this at all" — the latter needs no
  reason code since `not_applicable` from a `false` capability is
  self-explanatory).

## 3. `sdd-new` — propose the field

Add to the proposal template (alongside `impact`/`security`) in
`skills/sdd-new/SKILL.md` step 3:

```yaml
runtime_relevant_capabilities:   # subset of the project's enabled capabilities
  this change genuinely exercises; omit the whole field when unsure/all apply
```

Behavior addition: propose the subset of the **project's already-enabled**
capabilities (from `sdd.config.yaml`) that the requirement's `Impacted modules`
/ `Expected behavior` concretely touch — same "propose from signals, never
guess silently" discipline as `sdd-bootstrap-project`'s capability detection.
**When unsure, omit the field entirely** (falls back to today's strict
behavior) rather than guess an empty/partial list — omission is always the
safe default. Human confirms/corrects alongside `impact`/`security` at
approval.

## 4. `sdd-runtime-gate` — honor the field

Add to `skills/sdd-runtime-gate/SKILL.md`, before the adapter-selection table:

> Read `proposal.md`'s `runtime_relevant_capabilities` if present. A project
> capability `true` but **excluded** from that list is `not_applicable` /
> `NOT_RELEVANT_TO_CHANGE` for this change — it is not evaluated against the
> table below. If the field is absent, every project-enabled capability is
> relevant (today's behavior, unchanged).

Update the adapter-selection table with a new row:

| Condition | Adapter status |
|---|---|
| capability `true`, excluded via `runtime_relevant_capabilities` | `not_applicable` (`NOT_RELEVANT_TO_CHANGE`) |

And the Rules section gains: *"A capability the proposal explicitly marks
irrelevant to this change is `not_applicable`, not `blocked` — even if
experimental."*

## 5. `sdd validate --ci` — cross-artifact check

`src/cli/validate.js`, alongside the existing status-vs-adapters-aggregate
check: when `runtime_relevant_capabilities` is **present** on the change's
`proposal.md`, for each project-enabled capability excluded from it, the
`runtime-gate-report.md` (if present) must report that adapter as
`not_applicable`. Any other status → validation error naming the capability and
the conflicting proposal field.

- **Only activates when the field is present** — a proposal without it (every
  existing proposal today) triggers zero new checks (AC-08 guarantee).
- Needs both `proposal.md` and `runtime-gate-report.md` frontmatter, already
  loaded together per change by `loadChange`/`validateCommand` — no new file
  reads.

## 6. README — summarized documentation

Short new subsection near the existing "Capability model" section:

> **Per-change runtime relevance.** A project capability (`sdd.config.yaml`)
> means "the project has this surface"; an optional `runtime_relevant_capabilities`
> on a change's `proposal.md` means "*this* change touches it." Omit it and
> every enabled capability applies (today's behavior). List a subset to exclude
> capabilities this change doesn't touch — most useful for experimental
> adapters (`cli`/`worker`), which otherwise block forever. Upgrading `sdd`
> alone never changes any existing artifact's state; the new behavior only
> applies when a human adds the field to a specific proposal and re-runs
> `sdd-runtime-gate`.

## 7. No-auto-reconfiguration guarantee (AC-08) — why it holds

Three independent facts make this true, not just a promise:

1. **Schema**: the field is optional; no `required` list gains it.
2. **Code**: `planRuntimeAdapters`'s new parameter defaults to `null`
   (≡ today's behavior); nothing in `src/` calls it with a second argument —
   only skill *instructions* (prose, not enforced code) would ever pass one,
   and only when a human-authored `proposal.md` already carries the field.
3. **Artifacts**: nothing in this change writes/rewrites any existing
   `proposal.md`, `sdd.config.yaml`, or `*-report.md`. The deterministic engine
   only ever *reads* what's on disk; an old report stays exactly as written
   until a human re-runs the skill that produces it.

## 8. Test plan

- **`test/adapters.test.js`** (or wherever `planRuntimeAdapters` is covered):
  - no second arg → identical to current fixtures (regression guard for AC-02).
  - `relevantCapabilities` excludes `worker` (capability `true`) → `not_applicable` / `NOT_RELEVANT_TO_CHANGE`.
  - `relevantCapabilities` includes `worker` → unchanged `blocked` / `ADAPTER_NOT_IMPLEMENTED` (AC-04).
  - `relevantCapabilities` excludes a *supported* capability (`http`) → `not_applicable`, not `pending`.
- **`schemas`/`test/schema.test.js`**: a proposal with `runtime_relevant_capabilities: ['http']` validates; an invalid entry (e.g. `'queue'`) fails.
- **`test/validate.cli.test.js`**: new case — proposal excludes `worker`, report marks `worker` `blocked` → validate error; report marks it `not_applicable` → valid; proposal has no field at all → no new check fires either way (AC-08).
- **`test/skill-contract.test.js`**: `sdd-new` body mentions `runtime_relevant_capabilities`; `sdd-runtime-gate` body mentions `NOT_RELEVANT_TO_CHANGE` and the "omit → today's behavior" rule.
- **Full suite**: green, zero regressions (AC-07).

## 9. Traceability

| AC | Design section |
|---|---|
| AC-01 | §1 |
| AC-02 | §2 |
| AC-03 | §2, §4 |
| AC-04 | §2, §4 |
| AC-05 | §3, §4 |
| AC-06 | §5 |
| AC-07 | §8 |
| AC-08 | §6, §7 |
