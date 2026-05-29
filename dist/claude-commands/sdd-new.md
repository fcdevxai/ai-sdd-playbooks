# /sdd-new — SDD New — Crear Artefactos de Feature

## Objetivo

Crear `openspec/changes/[ticket-slug]/` con sus artefactos iniciales a partir del borrador generado por `/enrich-us`. No avanzar sin un `proposal.md` existente.

## Uso

```
/sdd-new [ticket-slug]
```

## Cuándo ejecutar

Después de `/enrich-us` y aprobación del usuario del borrador de proposal.md. Antes de `/sdd-ff`.

## Instrucciones al agente

1. Verifica que existe `openspec/changes/[ticket-slug]/proposal.md` con contenido de `/enrich-us`. Si no existe, detente.
2. Lee `openspec/specs/system.md` y el spec del módulo afectado.
3. Crea la carpeta si no existe.
4. Genera `OWNER.md` con ticket, developer, fecha y rama.
5. Completa todas las secciones de `proposal.md` (sin "si aplica", sin "o", sin "puede ser"). Deja `status: draft`.
6. Crea `design.md` con secciones: capa backend, capa frontend, impacto en specs existentes, decisiones de arquitectura tomadas.
7. Crea `tasks.md` placeholder con estado "waiting (proposal not yet approved)".
8. Confirma al usuario los archivos creados.

## Checklist

- [ ] `proposal.md` existe como borrador de `/enrich-us`
- [ ] Carpeta `openspec/changes/[ticket-slug]/` creada
- [ ] `OWNER.md` generado
- [ ] `proposal.md` con todas las secciones cerradas
- [ ] `design.md` con estructura inicial
- [ ] `tasks.md` placeholder creado
- [ ] `status: draft` (NO cambiar a `pending`)

## Formato de reporte

No genera reporte. Confirma los archivos creados y el siguiente paso para el usuario.

## Criterio de bloqueo

No avanzar a `/sdd-ff` sin que el usuario apruebe `proposal.md` (cambie `status: draft` a `status: pending`).

## Qué NO reemplaza

- La aprobación humana del proposal (solo el revisor puede cambiar `status: pending`)
- El diseño técnico detallado (se completa durante `/sdd-ff` y `/sdd-apply`)
