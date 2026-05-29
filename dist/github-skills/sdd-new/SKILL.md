---
name: sdd-new
description: Create the SDD feature folder and initial artifacts (OWNER.md, proposal.md, tasks.md) in openspec/changes/ from a Refined User Story produced by enrich-us. Activate when the user says "sdd-new", "create feature folder", "initialize feature artifacts", or wants to scaffold openspec/changes/ after running enrich-us.
---

# SDD New — Create Feature Artifacts

## Purpose

Create `openspec/changes/[ticket-slug]/` and its initial artifacts from the draft produced by `enrich-us`. This is the first step after all decisions are closed.

Do not proceed if no `proposal.md` draft exists.
Do not set `status: pending` — only a human reviewer can approve the proposal.

---

## Context

Read before acting:

1. `openspec/specs/system.md` — global architecture, conventions, data model
2. `openspec/specs/[affected-domain]/spec.md` — current state of the impacted module

---

## Behavior

### 1. Validate input

- Confirm a `[ticket-slug]` was provided (kebab-case, matches the git branch name).
- Check whether `openspec/changes/[ticket-slug]/proposal.md` already exists from `enrich-us`. If it does not, stop and ask the user to run `enrich-us` first.

### 2. Create folder

Create `openspec/changes/[ticket-slug]/` if it does not exist.

### 3. Generate OWNER.md

```markdown
# Feature Owner

- **Ticket**: [ticket-slug]
- **Developer**: [name — or "pending" if unassigned]
- **Start date**: [YYYY-MM-DD]
- **Estimate**: [story points or days — or "pending"]
- **Branch**: `[ticket-slug]`
```

### 4. Complete proposal.md

Finalize the `enrich-us` draft so all sections are fully closed:

```markdown
---
status: draft
ticket: [ticket-slug]
owner: [developer]
date: [YYYY-MM-DD]
---

# [Feature name]

---

## Output

Confirm files created: `OWNER.md`, `proposal.md`, `tasks.md`.

**Next step**: human review of `proposal.md` → change `status: draft` to `status: pending` → run `sdd-ff [ticket-slug]`.

---

## Rules

- Never set `status: pending` — only a human reviewer can approve the proposal.
- Never create artifacts outside `openspec/changes/[ticket-slug]/`.
- If the folder already exists, only create missing artifacts; do not overwrite existing content.
