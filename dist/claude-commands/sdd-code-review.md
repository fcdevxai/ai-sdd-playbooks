# /sdd-code-review — SDD Code Review — Revisión Automática Pre-PR

## Objetivo

Hacer una primera revisión del código generado contra la spec, detectar inconsistencias y resolverlas antes de que llegue al revisor humano. Genera un `code-review-report.md` con veredicto final.

## Uso

```
/sdd-code-review [ticket-slug]
```

## Cuándo ejecutar

Después de `/sdd-apply` y antes de `/sdd-commit`. Cuando `testing-report.md` está generado.

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/proposal.md` — los criterios de aceptación son los únicos criterios de éxito.
2. Lee `openspec/changes/[ticket-slug]/testing-report.md` para entender qué tests se generaron.
3. Lee el código implementado (archivos modificados según `tasks.md`).
4. Valida cada punto del checklist a continuación.
5. Guarda el reporte en `openspec/changes/[ticket-slug]/code-review-report.md`.

## Checklist

### Cobertura de spec
- [ ] Cada criterio de aceptación de `proposal.md` tiene al menos un test que lo cubre
- [ ] Cada caso de error de `proposal.md` tiene manejo explícito en el código
- [ ] El `testing-report.md` refleja todos los criterios de aceptación

### Scope
- [ ] El código no modifica módulos marcados como non-goals en `proposal.md`
- [ ] No se agregaron features no mencionadas en la spec (over-engineering)
- [ ] No hay hardcoded URLs en TypeScript (se usa Wayfinder)

### Convenciones
- [ ] Nombres de clases, métodos y variables siguen las convenciones de `openspec/specs/system.md`
- [ ] Form Requests usados para toda validación (no validación en controllers)
- [ ] Policies usadas para autorización (no guards en controllers)
- [ ] Constructor property promotion en todas las clases PHP nuevas
- [ ] Tipos explícitos en todos los métodos PHP nuevos
- [ ] Atributo `#[Test]` en todos los métodos de test (no prefijo `test_`)

### Calidad
- [ ] No hay business logic en controllers
- [ ] No hay lógica de orquestación en modelos
- [ ] Factories creadas para cada nuevo modelo
- [ ] `vendor/bin/pint --dirty --format agent` ejecutado (sin diff pendiente)
- [ ] `npm run types:check` pasa (si hay TypeScript)

## Formato de reporte

`openspec/changes/[ticket-slug]/code-review-report.md` con tabla de cobertura de spec, checklist de convenciones, lista de issues con archivo/línea/problema/corrección, y veredicto final.

## Criterio de bloqueo

El veredicto `REQUIERE CORRECCIONES` bloquea el avance a `/sdd-commit`. No abrir PR hasta resolver todos los issues.

## Qué NO reemplaza


