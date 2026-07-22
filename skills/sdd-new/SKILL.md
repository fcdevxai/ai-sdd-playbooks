---
name: sdd-new
description: >-
  Create the SDD change folder and initial artifacts (OWNER.md, a schema-valid
  proposal.md draft, tasks.md placeholder, ADR drafts for flagged decisions)
  under openspec/changes/ from a decision-closed requirement produced by
  sdd-enrich-us. Activate when the user says 'sdd-new', 'create change folder',
  or wants to scaffold openspec/changes/ after enrich. Triggers: crea el change,
  materializa la proposal.
description_es: >-
  Crear la carpeta de change y sus artefactos iniciales (OWNER.md, proposal.md
  borrador válido contra schema, tasks.md placeholder, drafts de ADR para
  decisiones marcadas) a partir de un requisito con decisiones cerradas
  producido por sdd-enrich-us.
title_es: SDD New — Crear Artefactos de Feature
version: 0.1.0
lifecycle_stage: new
produces:
  - OWNER.md
  - proposal.md
  - tasks.md
requires: {}
---
# SDD New — Create Feature Artifacts

**When to run:** After `sdd-enrich-us` produces a decision-closed requirement. Before `sdd-design`/`sdd-plan`.

## Purpose

Create `openspec/changes/<change-id>/` and its initial artifacts from the
decision-closed requirement produced by `sdd-enrich-us`. This is the first
**formal** lifecycle step; it produces `proposal_draft`.

Do not proceed without a decision-closed requirement. **Never** set
`status: approved` — only a human reviewer approves the proposal.

## Context

<The problem, constraints and forces in tension. Written to be standalone-readable years later.>

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

### 3. Create ADR drafts for decisions marked `[ADR candidate]`

Do this **before** writing `proposal.md` (step 4): the proposal template drops
the closed-decisions list, so the `[ADR candidate]` markers only exist in the
`sdd-enrich-us` draft still on disk at this point. Creating the drafts first
means an interrupted run never loses them.

For each marked decision, create `openspec/changes/<change-id>/adr-<decision-slug>.md`:

```markdown
---
schema: adr
status: proposed
date: <YYYY-MM-DD>
ticket: <change-id>
# supersedes: ADR-NNN   <- only when this decision replaces a promoted ADR
---

# ADR: <decision title>

## Output

Confirm `OWNER.md`, `proposal.md`, `tasks.md`, and any `adr-*.md` drafts
created. **Next step**: human review of `proposal.md` (confirm
`impact`/`security`/`runtime_relevant_capabilities` when proposed), then set
`status: approved`. Then run `playbook next`.

## Rules

- Never set `status: approved` — only a human reviewer approves.
- Never leave `## Security considerations` empty — if it truly does not apply, state why explicitly.
- Never create artifacts outside `openspec/changes/<change-id>/`.
- The proposal must be schema-valid and pass `playbook validate`; if unsure of
  `impact`/`security`, propose conservative values and flag them for the reviewer.
- ADR drafts are created with `status: proposed` — only a human moves them to
  `accepted` or `rejected`.
- Never put secrets, credentials, or internal endpoints with access details in
  an ADR — it documents architecture reasoning, not operational configuration.

## Decision

<The decision taken, stated as normative rules where possible.>

## Consequences

### Positive
- <benefit>

### Negative
- <cost accepted>

### Risks
- <what could go wrong; security-relevant risks belong here AND in docs/security-checklist.md "Known accepted risks" at archive time>

## Alternatives considered

### <Alternative name>
<Verdict-first reason to accept or discard it.>

## Impact

- backend: <impact — or "no impact">
- frontend: <impact — or "no impact">
- security: <impact — or "no impact">
- data: <impact — or "no impact">
- deployment: <impact — or "no impact">
- testing: <impact — or "no impact">
```

Drafts carry **no number** — `sdd-archive` assigns `ADR-NNN` at promotion time,
so parallel changes never collide. Section headers stay in English (a future
`validateADR` matches on them); prose follows the user's language. If no
decision was marked, skip this step — ADRs are optional.

### 4. Write a schema-valid `proposal.md` (status: draft)

The proposal MUST validate against the proposal schema. Propose the structured
`impact` and `security` blocks for the human to confirm — you propose, the
human approves or corrects:

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
different schema fields and will make `playbook validate` fail.

Also propose the optional `runtime_relevant_capabilities`: the subset of the
project's **already-enabled** capabilities (`playbook.config.yaml`) that this
requirement's `Impacted modules`/`Expected behavior` **concretely** touch.
**When unsure, omit the field entirely** — omission means every enabled
capability applies. Never propose an empty/partial list as a guess.

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
# runtime_relevant_capabilities: [http]   # optional — omit when unsure
---

# <Feature name>

## Objective



## Guiding principle



## Impacted modules



## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). One bullet per file, grouped by logical repo name: `- <repo-name>: <repo-relative-path>`. <repo-name> must exist in playbook.config.yaml's `repos:` — this is the source of truth `playbook repo-plan`/`commit-plan` use to map file → repo. Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)
### Edge cases

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1: **AC-1:** ..., **AC-2:** ... -->

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1: **EC-1:** ..., **EC-2:** ... -->

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1: **SEC-1:** ..., **SEC-2:** ... -->

## Constraints and non-goals



## Open technical decisions

<!-- Empty if none. -->
```

Criterion IDs (`AC-N`, `EC-N`, `SEC-N`) **freeze** once the proposal moves to
`status: approved`: never renumbered or reordered after approval: downstream
artifacts (tasks, reports) reference these IDs instead of repeating criterion
text. Changing an approved criterion requires a new change.

### 5. Create `tasks.md` placeholder (status: draft)

```markdown
---
schema: tasks
schema_version: 1
change_id: <change-id>
status: draft
---
# Tasks — <Feature name>

Waiting: proposal not yet approved. After human approval, run `playbook next`
(it will route to sdd-design when required, then sdd-plan).
```

### 6. Self-check

Run `playbook validate <change-id> --precondition sdd-plan` is premature here
(proposal isn't approved yet); instead run `playbook validate <change-id>` and
fix any frontmatter/section issue before presenting `proposal.md` for human
review. This fix→re-run loop is capped at 3 iterations — at the 4th failed
attempt, stop and report the pending issues exactly as `playbook validate`
returns them.

---

**Output file:** OWNER.md, proposal.md, tasks.md (placeholder), adr-*.md (drafts, one per [ADR candidate] decision)
**Requires terminal:** no
