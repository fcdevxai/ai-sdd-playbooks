---
status: accepted
date: 2026-07-03
ticket: loom-run-usage-telemetry
---

# ADR: Schema de `usage.json` y convención `.specloom/runs/<run-id>/` como base de telemetría

## Context

El plan de optimización de tokens del framework (informe de auditoría 2026-07-03, §17/§19) tiene fases posteriores — context-packet (Fase 3), spec index (Fase 4), token budget (Fase 6) — que necesitarán leer y validar datos de ejecución (por ejemplo, frescura de un context-packet comparada contra el timestamp de un run, o enforcement de `maxToolOutputLines`/`maxTddRetriesPerTask` desde `config.yaml`). Si el schema de `usage.json` y la ubicación de los logs no se fijan como convención estable desde esta primera feature, cada fase futura tendría que renegociar el formato, generando fragmentación y migraciones innecesarias.

## Decision

- Todo run de `loom run` escribe a `.specloom/runs/<run-id>/`, con exactamente dos archivos: `full.log` (texto plano) y `usage.json` (JSON con el schema fijado en `proposal.md` bajo `## Expected output`: `timestamp`, `command`, `changeId`, `step`, `harness`, `exitCode`, `rawOutputLines`, `retryCount`, `filesInChange`).
- `<run-id>` es único por invocación (no reutilizable), de forma que escanear `.specloom/runs/` siempre refleja el historial completo de ejecuciones sin necesidad de un índice separado.
- Este schema y esta ubicación se tratan como una convención transversal: cualquier feature futura que necesite leer telemetría de ejecución (context-packet, budget enforcement, `loom status`) debe leer desde aquí, no inventar un segundo formato paralelo.

## Consequences

### Positive

- Las Fases 2–7 del plan tienen un contrato estable del que partir sin tener que re-diseñar dónde y cómo se registran las ejecuciones.
- Consultar telemetría histórica (ej. cuántos reintentos tuvo una tarea) es una operación de solo lectura sobre archivos JSON simples, sin necesitar una base de datos o servicio adicional.

### Negative

- Cambiar el schema de `usage.json` en el futuro (agregar/quitar campos) requiere pensar en compatibilidad hacia atrás con runs ya escritos en disco, o aceptar que herramientas de análisis históricas deban tolerar múltiples versiones de schema.
- Fijar la convención temprano, con datos de un solo repo (este, mayormente placeholder), implica el riesgo de que no escale bien a repos consumidores con volumen de runs mucho mayor — mitigado porque el formato es JSON plano y fácil de versionar si hace falta.

### Risks

- Si una fase futura decide que `.specloom/runs/` no escala (demasiados directorios), migrar la convención afecta a cualquier herramienta que ya la lea. Mitigación: mantener el schema deliberadamente simple (sin campos anidados complejos) para que una futura migración (ej. a un índice consolidado) pueda derivarse de los mismos archivos sin pérdida de información.

## Alternatives considered

### No fijar convención ahora; decidir el schema recién en la Fase 3 (context-packet)

Descartada: la Fase 1 (esta feature) ya necesita escribir algo a disco para medir; posponer la decisión de schema solo difiere el mismo problema y arriesga tener que reescribir `loom run` cuando llegue la Fase 3, en vez de diseñarlo una vez con las fases futuras en mente.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: ver consideraciones de seguridad de `proposal.md` (`.specloom/` gitignoreado, sin redacción automática de secretos en `full.log`)
- data: define la única fuente de verdad de telemetría de ejecución del framework; futuras fases dependerán de este formato
- deployment: sin impacto
- testing: agrega tests unitarios que validan el schema de `usage.json` y la detección de `retryCount` por escaneo de runs previos
