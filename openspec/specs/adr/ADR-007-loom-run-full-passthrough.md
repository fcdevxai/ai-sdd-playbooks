---
status: superseded
superseded_by: ADR-009
date: 2026-07-03
ticket: loom-run-usage-telemetry
---

# ADR: `loom run` no comprime salida en su primera versión — full passthrough + log a disco

## Context

El informe de auditoría de consumo de tokens de SpecLoom (2026-07-03) identificó que ningún comando del framework compacta su salida antes de que entre al historial del agente, y que esta es la mayor fuente de consumo en `sdd-apply`/`sdd-verify`. La solución final propuesta (Fase 2 del plan) es que `loom run` devuelva al modelo solo exit code + fallos + stacktrace recortado, con el log completo a disco. Pero esta feature es exclusivamente la Fase 1 (medición): antes de decidir cómo comprimir, se necesita un baseline real de cuánto se ahorraría y qué información se pierde al hacerlo.

## Decision

`loom run` en esta primera versión es full passthrough: muestra stdout/stderr del comando ejecutado sin ningún cambio en el terminal (comportamiento idéntico a correr el comando directo), y adicionalmente escribe una copia exacta de esa salida a `.specloom/runs/<run-id>/full.log` junto con `usage.json`. Ninguna lógica de truncado, resumen o extracción de fallos se implementa en esta iteración.

## Consequences

### Positive

- Cero riesgo de que un resumen mal diseñado oculte información real durante la fase de medición — el agente ve exactamente lo que vería sin esta feature.
- El log en disco ya queda disponible para que una feature futura (Fase 2) calcule cuánto se ahorraría comprimiendo, usando datos reales en vez de estimación.
- Reduce el scope y riesgo de esta feature: no hay que diseñar todavía el formato del resumen compacto (qué cuenta como "fallo", cuántas líneas de stacktrace, cómo deduplicar warnings).

### Negative

- Esta feature por sí sola no reduce el consumo de tokens de las sesiones reales — solo lo mide. El beneficio de compactación llega recién con la Fase 2.
- Cualquiera que use `loom run` esperando ya un output corto se llevará una sorpresa; debe documentarse claramente que esta versión es solo de medición.

### Risks

- Si la Fase 2 nunca se implementa, `loom run` queda como un wrapper que solo agrega overhead de escritura a disco sin beneficio de consumo. Mitigación: la Fase 2 ya está priorizada en el plan de optimización y tiene su propio ticket futuro.

## Alternatives considered

### Implementar ya la compactación (exit code + fallos + stacktrace ≤40 líneas) en esta misma feature

Descartada: adelantar la Fase 2 dentro de esta feature de Fase 1 mezcla dos decisiones independientes (qué medir vs. cómo comprimir) y aumenta el riesgo de que un resumen oculte errores reales antes de tener un baseline que lo valide. Preferible cerrar la medición primero y diseñar la compactación con datos reales de esta misma telemetría.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: sin impacto directo — el log completo queda a disco local, ver ADR de `.specloom/runs/` y consideraciones de seguridad en `proposal.md`
- data: ninguno (no hay persistencia de datos de usuario, solo logs de ejecución de comandos)
- deployment: sin impacto
- testing: agrega tests unitarios para `loom run` (passthrough de exit code, escritura de full.log)
