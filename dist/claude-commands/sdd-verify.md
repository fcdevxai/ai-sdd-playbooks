# /sdd-verify — SDD Verify — Verificar Criterios de Aceptación post-PR

## Objetivo

Verificar que todos los criterios de aceptación de la spec se cumplen en el estado actual del código, post-merge del PR. Genera un reporte de verificación final.

## Uso

```
/sdd-verify [ticket-slug]
```

## Cuándo ejecutar

Después de que el PR fue aprobado y mergeado en main. Antes de `/sdd-archive`.

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/proposal.md` — lista completa de criterios de aceptación.
2. Lee `openspec/changes/[ticket-slug]/testing-report.md` para los tests del ciclo `/sdd-apply`.
3. Ejecuta los tests de la feature: `php artisan test --compact tests/Feature/[Domain]/`
4. Para cada criterio de aceptación:
   - Identifica el test que lo cubre
   - Confirma que el test pasa en el estado actual del código
   - Si no tiene test → señalar como gap
5. Verifica que no hay regresiones: `php artisan test --compact`
6. Genera `openspec/changes/[ticket-slug]/verification-report.md`

## Checklist

- [ ] `proposal.md` leído — todos los criterios de aceptación listados
- [ ] `testing-report.md` leído — tests del ciclo apply identificados
- [ ] Tests de la feature ejecutados y pasan
- [ ] Cada criterio de aceptación mapeado a un test
- [ ] Criterios sin test marcados como gaps
- [ ] Suite completa ejecutada — sin regresiones
- [ ] `verification-report.md` generado con veredicto

## Formato de reporte

`openspec/changes/[ticket-slug]/verification-report.md` con tabla de criterios vs tests, resultado de suite completa y veredicto final.

## Criterio de bloqueo

El veredicto debe ser `❌ GAPS DETECTADOS` si algún criterio de aceptación no tiene test que pase. No proceder con `/sdd-archive` sin veredicto `✅ FEATURE VERIFICADA`.

## Qué NO reemplaza

- La aprobación del PR por el revisor humano
- El análisis de si los criterios de aceptación capturan correctamente la necesidad de negocio
- La validación UX/UI (cubierta por `/sdd-ux-gate`)
