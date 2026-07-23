---
name: sdd-archive
description: >-
  Integrate a completed, verified feature's decisions into the permanent specs
  in openspec/specs/, promote any ADR drafts, update system.md if architecture
  changed, and clean up openspec/changes/ after human confirmation. Activate
  when the user says 'sdd-archive', 'archive feature', or 'close the SDD cycle'.
  Triggers: archiva la feature, cierra el ciclo, promueve ADR.
description_es: >-
  Integrar las decisiones de una feature completada y verificada en las specs
  permanentes de openspec/specs/, promover los drafts de ADR, actualizar
  system.md si cambió la arquitectura, y limpiar openspec/changes/ tras
  confirmación humana.
title_es: SDD Archive — Cerrar el Ciclo
version: 0.1.0
lifecycle_stage: archive
produces: []
requires:
  artifacts:
    verification-report.md:
      status: passed
---
# SDD Archive — Close the Cycle

**When to run:** After verification-report.md has status: passed. Final step of the cycle.

## Purpose

Turn a completed feature into permanent project knowledge: integrate its
decisions into `openspec/specs/`, promote any ADR drafts to numbered records,
update `system.md` if global architecture changed, and remove
`openspec/changes/<change-id>/`. Final step of the cycle.

Do not proceed unless `verification-report.md` has `status: passed`.

## Context

Read completely before editing: `proposal.md` (which domain is affected, via
`## Impacted modules`), `design.md` (if present), `verification-report.md`, any
`adr-*.md` drafts in the change folder, and the **full** current content of the
affected `openspec/specs/<domain>/spec.md`, `openspec/specs/system.md`, and
`openspec/specs/adr/README.md`.

## Behavior

1. **Validate**: `verification-report.md` `status: passed`; identify the affected
   domain spec. If not passed, stop. If `## Impacted repos` in `proposal.md`
   is non-empty, also run `playbook gate-check <change-id>` — it re-runs every
   impacted repo's configured verification commands locally (not remote CI).
   Any failure stops the archive. Also confirm the per-repo breakdown with
   `playbook status --json` (`delivery.per_repo`): no impacted repo may be
   unmerged — the aggregate only reaches `merged` when every repo does.
2. **Promote ADR drafts.** Run `playbook adr promote <change-id>` (use
   `--dry-run` first to preview). It assigns the next sequential `ADR-NNN`
   (never reuses or renumbers an existing one) to every `adr-<decision-slug>.md`
   in the change folder with `status: accepted` or `rejected`, moves it to
   `openspec/specs/adr/ADR-NNN-<decision-slug>.md`, updates
   `openspec/specs/adr/README.md`'s index, and stages everything with git
   (transactional — it rolls back on any failure). A draft still
   `status: proposed` blocks promotion — stop and ask the human to accept or
   reject it first. If it supersedes a promoted ADR, the command sets
   `superseded_by` on the superseded record automatically.
3. **Update the domain spec**: append/update the section describing the new
   behavior. Never delete documented behavior — only add or replace with updated
   information. Create `openspec/specs/<new-domain>/spec.md` if it's a new domain.
4. **Update `system.md` (conditionally)**: only if the feature introduced new
   tables/schema, new services/layers/patterns, decisions affecting future
   modules, or changes to main data flows.
5. **Update the security checklist (conditionally)**: if this feature introduced
   a new sensitive surface (per `docs/security-checklist.md`'s conventions),
   record it there — including any accepted risk noted in a promoted ADR.
6. **Clean up**: ask the user for explicit confirmation, then remove
   `openspec/changes/<change-id>/`. Set the change's `proposal.status: archived`
   before removal so the engine can report `archived`.

## Rules

- Never edit a spec without reading it completely first — only add/update, never
  silently delete documented behavior.
- Never archive without `status: passed` in `verification-report.md`.
- Never promote an ADR still in `status: proposed` — a human must accept or reject it first.
- Never renumber or reuse an existing `ADR-NNN`.
- Always ask for explicit confirmation before deleting the change folder.
- If multiple domains are affected, update each `spec.md` separately.

---

**Output file:** N/A — updates openspec/specs/**, promotes adr-*.md, removes openspec/changes/<change-id>/
**Requires terminal:** no
