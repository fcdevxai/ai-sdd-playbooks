# /sdd-ff — SDD FF - Granularizar Tareas

## Objetivo

Leer `proposal.md` aprobada y generar tareas granularizadas en `tasks.md`, listas para ejecutar con `/sdd-apply`. Cada tarea debe ser atomica con criterio de exito verificable.

## Uso

```
/sdd-ff [ticket-slug]
```

## Cuándo ejecutar

Despues de que el usuario aprueba `proposal.md` (status: pending). Antes de `/sdd-apply`.

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/proposal.md`. Verifica `status: pending`. Si es `draft`, detente.
2. Lee `openspec/changes/[ticket-slug]/design.md` para decisiones tecnicas.
3. Lee `openspec/specs/system.md` para convenciones globales.
4. Lee `docs/doc_architecture.md` y `docs/doc_verification_guide.md` para estructura y comandos reales del proyecto.
5. Para cada criterio de aceptacion, identifica las capas que toca.
6. Genera `tasks.md` con `status: ready`, organizado en fases.
7. Cada tarea: nombre atomico, archivos a crear/modificar, comando opcional, criterio de exito, criterio de aceptacion vinculado.
8. Reporta el total de tareas y pregunta si procede con `/sdd-apply [ticket-slug]`.

## Checklist

- [ ] `proposal.md` tiene `status: pending`
- [ ] Cada criterio de aceptacion mapeado a tareas concretas
- [ ] Tareas separadas para permitir verificacion independiente
- [ ] Cada tarea tiene criterio de exito verificable
- [ ] Ninguna tarea fuera del scope de `proposal.md`
- [ ] Dependencias entre tareas documentadas explicitamente
- [ ] `tasks.md` guardado con `status: ready`

## Formato de reporte



## Criterio de bloqueo



## Qué NO reemplaza


