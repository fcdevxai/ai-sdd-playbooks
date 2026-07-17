---
name: sdd-new
description: "Create the SDD change folder and initial artifacts (OWNER.md, a schema-valid proposal.md draft, tasks.md placeholder) under openspec/changes/ from a decision-closed requirement produced by sdd-enrich-us. Activate when the user says 'sdd-new', 'create change folder', or wants to scaffold openspec/changes/ after enrich."
lifecycle_stage: new
produces: [OWNER.md, proposal.md, tasks.md]
requires: {}
version: 2.0.0
---

## Purpose

Create `openspec/changes/<change-id>/` and its initial artifacts from the
decision-closed requirement produced by `sdd-enrich-us`. This is the first
**formal** lifecycle step; it produces `proposal_draft`.

Do not proceed without a decision-closed requirement. **Never** set
`status: approved` — only a human reviewer approves the proposal.

## Context

Read before acting: `openspec/specs/system.md` (global architecture/conventions)
and the affected domain spec if one exists.

## Behavior

### 1. Validate input & change-id

Confirm a decision-closed requirement exists and a `<change-id>` was given
(kebab-case, matches the git branch). If `openspec/changes/<change-id>/proposal.md`
already exists, only fill missing artifacts — never overwrite content.

### 2. Create the folder and `OWNER.md`

```markdown
# Change Owner
- **Change**: <change-id>
- **Developer**: <name or "pending">
- **Start date**: <YYYY-MM-DD>
- **Branch**: `<change-id>`
```

### 3. Write a schema-valid `proposal.md` (status: draft)

The proposal MUST validate against the proposal schema. Propose the structured
`impact` and `security` blocks for the human to confirm (C-03/C-04) — you propose,
the human approves or corrects:

Keep the three proposal taxonomies separate:

- `impact.*` describes delivery/design impact. For example, a public API or
  response contract change is `impact.public_contract: true`.
- `security.triggers` describes security-sensitive concerns only. Valid examples
  include `authentication`, `authorization`, `personal_data`, `sensitive_data`,
  `secrets`, `external_integration`, and `sensitive_logging`.
- `runtime_relevant_capabilities` describes which enabled runtime adapters this
  change must exercise, such as `http` or `browser`.

Never place capability names (`http`, `browser`, `cli`, `worker`) or impact keys
(`public_contract`, `data_model`, etc.) inside `security.triggers`; they are
different schema fields and will make `sdd validate` fail.

Also propose the optional `runtime_relevant_capabilities`: the subset of the
project's **already-enabled** capabilities (`sdd.config.yaml`) that this
requirement's `Impacted modules`/`Expected behavior` **concretely** touch —
grounded in the requirement, never guessed. This narrows `sdd-runtime-gate` to
what this change actually exercises (most useful for experimental capabilities
`cli`/`worker`, which otherwise block every change forever regardless of
relevance). **When unsure, omit the field entirely** — omission means every
enabled capability applies, today's behavior. Never propose an empty/partial
list as a guess; an honest omission is always safer than an inaccurate one.

```markdown
---
schema: proposal
schema_version: 1
change_id: <change-id>
status: draft
owner: <developer>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
impact:            # any true → sdd-design becomes required
  public_contract: false
  data_model: false
  architecture_boundary: false
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:          # http:true alone is NOT elevated
  risk: standard   # low | standard | elevated
  triggers: []     # e.g. authorization, personal_data, secrets, external_integration ...
# runtime_relevant_capabilities: [http]   # optional — see below; omit when unsure
---

# <Feature name>

## Objective
## Guiding principle
## Impacted modules
## Expected behavior (Given/When/Then + edge cases)
## Acceptance criteria      <!-- testable AC-01, AC-02 ... -->
## Error cases
## Constraints and non-goals
## Open technical decisions  <!-- empty if none -->
```

### 4. Create `tasks.md` placeholder (status: draft)

```markdown
---
schema: tasks
schema_version: 1
change_id: <change-id>
status: draft
---
# Tasks — <Feature name>

Waiting: proposal not yet approved. After human approval, run `sdd next`
(it will route to sdd-design when required, then sdd-plan).
```

## Output

Confirm `OWNER.md`, `proposal.md`, `tasks.md` created. **Next step**: human
review of `proposal.md` (confirm `impact`/`security`/`runtime_relevant_capabilities`
when proposed), then set `status: approved`. Then run `sdd next`.

## Rules

- Never set `status: approved` — only a human reviewer approves.
- Never create artifacts outside `openspec/changes/<change-id>/`.
- The proposal must be schema-valid; if unsure of `impact`/`security`, propose
  conservative values and flag them for the reviewer.
