# /sdd-archive — SDD Archive — Cerrar el Ciclo SDD

## Objetivo

Integrar el delta de la feature completada en `openspec/specs/`, actualizar `system.md` si se tomaron decisiones de arquitectura, y limpiar `openspec/changes/[ticket-slug]/`.

## Uso

```
/sdd-archive [ticket-slug]
```

## Cuándo ejecutar

Después de `/sdd-verify` con veredicto ✅ FEATURE VERIFICADA y PR mergeado en main.

## Instrucciones al agente

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

## Checklist

- [ ] `verification-report.md` con veredicto ✅ FEATURE VERIFICADA
- [ ] `proposal.md`, `design.md` y specs afectadas leídas completamente
- [ ] Delta de comportamiento nuevo integrado en spec permanente
- [ ] `status` del spec afectado actualizado a `implemented`
- [ ] `system.md` actualizado si aplica (nuevas tablas, servicios, decisiones de arq.)
- [ ] Usuario confirmó eliminación de `openspec/changes/[ticket-slug]/`
- [ ] Carpeta eliminada tras confirmación

## Formato de reporte

No genera archivo. Confirma al usuario: specs actualizadas (con descripción breve del cambio) y carpeta eliminada.

## Criterio de bloqueo

No archivar sin veredicto `✅ FEATURE VERIFICADA` en `verification-report.md`. No eliminar la carpeta sin confirmación explícita del usuario.

## Qué NO reemplaza

- La verificación técnica de tests (`/sdd-verify`)
- La revisión humana del PR
- El decision log de arquitectura (debe estar en `design.md` antes de archivar)
