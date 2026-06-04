# /sdd-code-review — SDD Code Review - Revision Automatizada Pre-PR

## Objetivo

Hacer una primera revision del codigo generado contra la spec, detectar inconsistencias y resolverlas antes de revision humana. Genera `code-review-report.md` con veredicto final.

## Uso

```
/sdd-code-review [ticket-slug]
```

## Cuándo ejecutar

Despues de `/sdd-apply` y antes de `/sdd-commit`, cuando `testing-report.md` esta generado.

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/proposal.md`.
2. Lee `openspec/changes/[ticket-slug]/testing-report.md`.
3. Lee `tasks.md` y el codigo implementado.
4. Valida checklist de cobertura, scope, convenciones y calidad.
5. Guarda reporte en `openspec/changes/[ticket-slug]/code-review-report.md`.

## Checklist

### Cobertura de spec
- [ ] Cada criterio de aceptacion tiene evidencia passing
- [ ] Cada caso de error tiene manejo explicito y evidencia
- [ ] `testing-report.md` refleja todos los criterios

### Scope
- [ ] No hay cambios fuera de `proposal.md`
- [ ] No hay over-engineering fuera de spec
- [ ] Cambios de contrato justificados/documentados

### Convenciones y calidad
- [ ] Convenciones de `openspec/specs/system.md` respetadas
- [ ] Reglas de arquitectura de `docs/doc_architecture.md` respetadas
- [ ] Comandos de calidad definidos en `docs/doc_verification_guide.md` ejecutados
- [ ] Tests/checks nuevos cubren comportamiento modificado

## Formato de reporte



## Criterio de bloqueo

El veredicto `REQUIRES FIXES` bloquea avance a `/sdd-commit`. No abrir PR hasta resolver todos los issues.

## Qué NO reemplaza


