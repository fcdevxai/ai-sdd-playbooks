# /sdd-verify — SDD Verify - Verificar Criterios de Aceptacion post-PR

## Objetivo

Verificar que todos los criterios de aceptacion de la spec se cumplen en el estado actual del codigo, post-merge. Genera un reporte de verificacion final.

## Uso

```
/sdd-verify [ticket-slug]
```

## Cuándo ejecutar

Despues de que el PR fue aprobado y mergeado en main. Antes de `/sdd-archive`.

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/proposal.md`.
2. Lee `openspec/changes/[ticket-slug]/testing-report.md`.
3. Ejecuta los comandos de verificacion de feature/dominio definidos en `docs/doc_verification_guide.md`.
4. Para cada criterio de aceptacion: identifica evidencia passing; si no existe, marcar gap.
5. Verifica casos de error con evidencia passing.
6. Ejecuta regresion segun guia del proyecto.
7. Genera `openspec/changes/[ticket-slug]/verification-report.md`.

## Checklist

- [ ] `proposal.md` leido - criterios de aceptacion listados
- [ ] `testing-report.md` leido - evidencia inicial identificada
- [ ] Verificacion de feature/dominio ejecutada
- [ ] Cada criterio de aceptacion mapeado a evidencia
- [ ] Criterios sin evidencia marcados como gaps
- [ ] Regresion ejecutada segun guia del proyecto
- [ ] `verification-report.md` generado con veredicto

## Formato de reporte



## Criterio de bloqueo



## Qué NO reemplaza


