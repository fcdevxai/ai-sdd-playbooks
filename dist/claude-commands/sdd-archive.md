# /sdd-archive — SDD Archive — Close the SDD Cycle

## Usage

```
/sdd-archive [ticket-slug]
```

## When to run

Después de `/sdd-verify` con veredicto ✅ FEATURE VERIFICADA y PR mergeado en main.

## Purpose

Integrate the completed feature's architectural decisions into `openspec/specs/` (permanent source of truth), update `system.md` if global architecture changed, and clean up `openspec/changes/[ticket-slug]/`.

This is the final step of the SDD cycle — it turns a completed feature into permanent project knowledge.

Do not proceed without a `✅ FEATURE VERIFIED` verdict in `verification-report.md`.

## Context

Read completely before archiving:

1. `openspec/changes/[ticket-slug]/proposal.md` — determines which domain spec is affected (`## Impacted modules`)
2. `openspec/changes/[ticket-slug]/design.md` — technical decisions taken (if it exists)
3. `openspec/changes/[ticket-slug]/verification-report.md` — must have verdict `✅ FEATURE VERIFIED`
4. **Full content** of `openspec/specs/[affected-domain]/spec.md` — read completely before making any edit
5. **Full content** of `openspec/specs/system.md` — read completely before making any edit

## Behavior

### 1. Validate pre-conditions

- Read `verification-report.md`. If verdict is not `✅ FEATURE VERIFIED`, stop and report. Do not archive.
- Identify which domain spec is affected from `## Impacted modules` in `proposal.md`.

### 2. Update the domain spec

- Open `openspec/specs/[affected-domain]/spec.md`.
- Append or update the section describing the feature's new behavior.
- If the spec's `status:` was `pending` or `replanning`, change it to `implemented`.
- Never delete documented behavior — only add or replace with updated information.

If the feature introduces a **new domain**, create `openspec/specs/[new-domain]/spec.md` with `status: implemented`.

### 3. Update system.md (conditionally)

Update `openspec/specs/system.md` only if the feature introduced:

- New database tables or significant schema changes
- New services, architectural layers, or design patterns used for the first time
- Decisions that affect how future modules must be built
- Changes to main system data flows

### 4. Clean up openspec/changes/

Ask the user for confirmation before deleting. Default action: delete `openspec/changes/[ticket-slug]/`.

```bash
rm -rf openspec/changes/[ticket-slug]/
```

### 5. Confirm

```
✅ Archive complete for [ticket-slug]:

Specs updated:
- openspec/specs/[domain]/spec.md → [brief description of what changed]
- openspec/specs/system.md → [section updated] (if applicable)

Folder removed: openspec/changes/[ticket-slug]/

The SDD cycle for this feature is closed.
```

## Output

- `openspec/specs/[domain]/spec.md` updated
- `openspec/specs/system.md` updated (if architecture changed)
- `openspec/changes/[ticket-slug]/` removed (after user confirmation)

## Rules

- Never edit a spec without reading it completely first — only add or update, never silently delete documented behavior.
- Never archive without a `✅ FEATURE VERIFIED` verdict.
- Always ask for explicit user confirmation before running `rm -rf` on `openspec/changes/[ticket-slug]/`.
- If multiple domains are affected, update each domain's `spec.md` separately.
