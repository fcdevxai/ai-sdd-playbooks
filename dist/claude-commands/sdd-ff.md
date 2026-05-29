# /sdd-ff — SDD FF — Granularizar Tareas

## Objetivo

Leer `proposal.md` aprobada y generar las tareas granularizadas en `tasks.md`, listas para ejecutar con `/sdd-apply`. Cada tarea debe ser atómica con criterio de éxito verificable.

## Uso

```
/sdd-ff [ticket-slug]
```

## Cuándo ejecutar

Después de que el usuario aprueba `proposal.md` (status: pending). Antes de `/sdd-apply`.

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/proposal.md`. Verifica `status: pending`. Si es `draft`, detente.
2. Lee `openspec/changes/[ticket-slug]/design.md` para decisiones técnicas.
3. Lee `openspec/specs/system.md` para convenciones globales.
4. Lee los archivos de implementación existentes relacionados para entender el estado actual del código.
5. Para cada criterio de aceptación, identifica las capas que toca (backend, frontend, tests).
6. Genera `tasks.md` con `status: ready`, organizado en fases (Backend → Frontend → Tests → Closure).
7. Cada tarea: nombre atómico, archivos a crear/modificar, comando artisan si aplica, criterio de éxito, criterio de aceptación vinculado.
8. Reporta el total de tareas y pregunta si procede con `/sdd-apply [ticket-slug]`.

## Checklist

- [ ] `proposal.md` tiene `status: pending`
- [ ] Cada criterio de aceptación mapeado a tareas concretas
- [ ] Tareas separadas por capa (sin mezclar backend y frontend)
- [ ] Cada tarea tiene criterio de éxito verificable (test o comportamiento observable)
- [ ] Ninguna tarea fuera del scope de "Restricciones y non-goals"
- [ ] Dependencias entre tareas documentadas explícitamente
- [ ] `tasks.md` guardado con `status: ready`

## Formato de reporte

No genera reporte. Presenta el `tasks.md` generado al usuario y pide confirmación para proceder con `/sdd-apply`.

## Criterio de bloqueo

No generar tareas si `proposal.md` tiene `status: draft`. El usuario debe aprobar primero.

## Qué NO reemplaza

- El diseño técnico detallado (se discute en `design.md` antes de `/sdd-ff`)
- La estimación de esfuerzo (responsabilidad del equipo)
