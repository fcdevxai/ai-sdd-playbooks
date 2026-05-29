---
slug: sdd-archive
title_en: "SDD Archive — Close the SDD Cycle"
title_es: "SDD Archive — Cerrar el Ciclo SDD"
description: "Integrate completed feature decisions into permanent specs in openspec/specs/, update system.md if architecture changed, and clean up openspec/changes/. Activate when the user says \"sdd-archive\", \"archive feature\", \"close the SDD cycle\", or asks to archive after a verified merge."
description_es: "Integra el delta de la feature completada en openspec/specs/, actualiza system.md si hay cambios de arquitectura, y limpia openspec/changes/."
when_es: "Después de `/sdd-verify` con veredicto ✅ FEATURE VERIFICADA y PR mergeado en main."
output_file: ""
verdict_pass: ""
verdict_fail: ""
requires_terminal: false
---

## Purpose

Integrate the completed feature's architectural decisions into `openspec/specs/` (permanent source of truth), update `system.md` if global architecture changed, and clean up `openspec/changes/[ticket-slug]/`.

This is the final step of the SDD cycle — it turns a completed feature into permanent project knowledge.

Do not proceed without a `✅ FEATURE VERIFIED` verdict in `verification-report.md`.

---

## Context

Read completely before archiving:

1. `openspec/changes/[ticket-slug]/proposal.md` — determines which domain spec is affected (`## Impacted modules`)
2. `openspec/changes/[ticket-slug]/design.md` — technical decisions taken (if it exists)
3. `openspec/changes/[ticket-slug]/verification-report.md` — must have verdict `✅ FEATURE VERIFIED`
4. **Full content** of `openspec/specs/[affected-domain]/spec.md` — read completely before making any edit
5. **Full content** of `openspec/specs/system.md` — read completely before making any edit

---

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

---

## Output

- `openspec/specs/[domain]/spec.md` updated
- `openspec/specs/system.md` updated (if architecture changed)
- `openspec/changes/[ticket-slug]/` removed (after user confirmation)

---

## Rules

- Never edit a spec without reading it completely first — only add or update, never silently delete documented behavior.
- Never archive without a `✅ FEATURE VERIFIED` verdict.
- Always ask for explicit user confirmation before running `rm -rf` on `openspec/changes/[ticket-slug]/`.
- If multiple domains are affected, update each domain's `spec.md` separately.

---

## Objetivo

Integrar el delta de la feature completada en `openspec/specs/`, actualizar `system.md` si se tomaron decisiones de arquitectura, y limpiar `openspec/changes/[ticket-slug]/`.

---

## Instrucciones

1. Lee `openspec/changes/[ticket-slug]/proposal.md` — determina qué spec permanente impacta.
2. Lee `openspec/changes/[ticket-slug]/design.md` — identifica decisiones de arquitectura tomadas.
3. Lee `openspec/changes/[ticket-slug]/verification-report.md` — confirma veredicto ✅.
4. **Lee completamente** `openspec/specs/[dominio-afectado]/spec.md` antes de editar.
5. **Lee completamente** `openspec/specs/system.md` antes de editar.
6. **Integrar delta en spec permanente**:
   - Actualiza `openspec/specs/spec-XX-[módulo].md` con el nuevo comportamiento.
   - Si es un módulo nuevo: crea `openspec/specs/[slug]/spec.md` con `status: implemented`.
   - Cambia `status` del spec afectado a `implemented` si era `pending` o `replanning`.
7. **Actualizar `openspec/specs/system.md`** solo si la feature introdujo nuevas tablas, nuevos servicios, decisiones de arquitectura nuevas o cambios en flujos principales.
8. **Pedir confirmación** al usuario antes de eliminar `openspec/changes/[ticket-slug]/`.
9. Ejecutar `rm -rf openspec/changes/[ticket-slug]/` tras confirmación.
10. Confirmar specs actualizadas y carpeta eliminada.

---

## Checklist

- [ ] `verification-report.md` con veredicto ✅ FEATURE VERIFICADA
- [ ] `proposal.md`, `design.md` y specs afectadas leídas completamente
- [ ] Delta de comportamiento nuevo integrado en spec permanente
- [ ] `status` del spec afectado actualizado a `implemented`
- [ ] `system.md` actualizado si aplica (nuevas tablas, servicios, decisiones de arq.)
- [ ] Usuario confirmó eliminación de `openspec/changes/[ticket-slug]/`
- [ ] Carpeta eliminada tras confirmación

---

## Formato de reporte

No genera archivo. Confirma al usuario: specs actualizadas (con descripción breve del cambio) y carpeta eliminada.

---

## Criterio de bloqueo

No archivar sin veredicto `✅ FEATURE VERIFICADA` en `verification-report.md`. No eliminar la carpeta sin confirmación explícita del usuario.

---

## Qué NO reemplaza

- La verificación técnica de tests (`/sdd-verify`)
- La revisión humana del PR
- El decision log de arquitectura (debe estar en `design.md` antes de archivar)
