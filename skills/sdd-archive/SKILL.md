---
name: sdd-archive
description: "Integrate a completed, verified feature's decisions into the permanent specs in openspec/specs/, update system.md if architecture changed, and clean up openspec/changes/ after human confirmation. Activate when the user says 'sdd-archive', 'archive feature', or 'close the SDD cycle'."
lifecycle_stage: archive
produces: []
requires:
  artifacts:
    verification-report.md: { status: passed }
version: 2.0.0
---

## Purpose

Turn a completed feature into permanent project knowledge: integrate its
decisions into `openspec/specs/`, update `system.md` if global architecture
changed, and remove `openspec/changes/<change-id>/`. Final step of the cycle.

Do not proceed unless `verification-report.md` has `status: passed`.

## Context

Read completely before editing: `proposal.md` (which domain is affected, via
`## Impacted modules`), `design.md` (if present), `verification-report.md`, and
the **full** current content of the affected `openspec/specs/<domain>/spec.md`
and `openspec/specs/system.md`.

## Behavior

1. **Validate**: `verification-report.md` `status: passed`; identify the affected
   domain spec. If not passed, stop.
2. **Update the domain spec**: append/update the section describing the new
   behavior. Never delete documented behavior — only add or replace with updated
   information. Create `openspec/specs/<new-domain>/spec.md` if it's a new domain.
3. **Update `system.md` (conditionally)**: only if the feature introduced new
   tables/schema, new services/layers/patterns, decisions affecting future
   modules, or changes to main data flows.
4. **Clean up**: ask the user for explicit confirmation, then remove
   `openspec/changes/<change-id>/`. Set the change's `proposal.status: archived`
   before removal so the engine can report `archived`.

## Rules

- Never edit a spec without reading it completely first — only add/update, never
  silently delete documented behavior.
- Never archive without `status: passed` in `verification-report.md`.
- Always ask for explicit confirmation before deleting the change folder.
- If multiple domains are affected, update each `spec.md` separately.
