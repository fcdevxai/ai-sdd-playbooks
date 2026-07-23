---
status: accepted
date: 2026-07-03
ticket: loom-run-compaction
supersedes: ADR-007
---

# ADR: La compactación pasa a ser el comportamiento default de `loom run`

## Context

ADR-007 fijó que la primera versión de `loom run` (Fase 1 del plan de optimización de tokens) fuera full passthrough deliberado: mostrar stdout/stderr sin cambios y escribir una copia exacta a `full.log`, para medir un baseline real antes de decidir cómo comprimir. Con esa telemetría ya disponible (`.specloom/runs/`, `usage.json`), la Fase 2 debe decidir cómo `loom run` entrega su salida al agente de aquí en adelante — y esta decisión afecta a todo consumidor presente y futuro del wrapper (proyectos que ya instalaron specloom vía `npm update` heredan el nuevo comportamiento sin acción propia).

## Decision

`loom run` deja de ser full passthrough por default. De ahora en adelante:

- Si el comando ejecutado termina con exit code 0, se imprime una única línea de resumen (recuento de líneas + path a `full.log`), nunca el output crudo.
- Si termina con exit code distinto de 0, se imprime el exit code + las últimas 40 líneas del output combinado (stdout+stderr) + el path a `full.log`.
- No hay streaming en vivo del output del comando hijo mientras corre — el buffer se arma en silencio y el resumen se imprime recién al cerrar el proceso.
- No se agrega ningún flag de opt-out (`--verbose`) en esta feature: quien necesite ver el output completo en vivo corre el comando directo (sin `loom run`) o lee `full.log`.
- `full.log`/`usage.json` siguen conteniendo exactamente lo mismo que en Fase 1 — la compactación solo cambia qué se imprime en terminal, nunca qué se persiste a disco.

## Consequences

### Positive

- Reduce directamente el consumo de tokens de `sdd-apply`/`sdd-verify` en el camino feliz (la mayoría de las ejecuciones), no solo en fallos.
- El comportamiento se propaga automáticamente a todo consumidor vía `npm update` + `loom sync` (ver README "Después de actualizar specloom"), sin requerir que cada proyecto opte in explícitamente.
- Mantiene una vía de escape simple y sin mantenimiento adicional: correr el comando directo o leer `full.log` cubre el caso de querer ver todo.

### Negative

- Rompe la expectativa de "identical a correr el comando directo" que ADR-007 documentó como propiedad explícita de `loom run` en su primera versión — cualquiera que dependiera de ese passthrough en un script propio se ve afectado.
- Un humano que use `loom run` interactivamente (fuera del flujo de agente) pierde el streaming en vivo que tenía antes; debe esperar a que el comando termine para ver el resumen.

### Risks

- Si el tail de 40 líneas no incluye el mensaje de error clave (ej. aparece al principio del output y no al final), el agente puede necesitar un paso extra de leer `full.log` para diagnosticar — mitigado documentando esta limitación explícitamente en los playbooks (sdd-apply/sdd-verify indican leer `full.log` ante un fallo relacionado con seguridad o poco claro).
- Si una fase futura necesita un modo verbose real (ej. debugging interactivo de CI), habrá que reabrir esta decisión con un ADR nuevo que declare `supersedes` sobre este.

## Alternatives considered

### Opt-in vía flag `--compact`, manteniendo passthrough como default

Descartada: el ahorro de tokens solo se materializa si los playbooks (que corren desde agente) pasan el flag consistentemente; mantener passthrough como default no cambia nada para el caso de uso real de `loom run` (invocación desde agente), y agrega un flag más que mantener y documentar sin beneficio claro.

### Streaming en vivo + resumen al final

Descartada: el streaming en vivo ya consume tokens del agente en tiempo real (el output entra al historial de la sesión apenas se imprime), así que agregar un resumen al final no reduce el consumo real — solo lo duplica.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: ver `proposal.md` — el resumen compacto puede omitir detalle de seguridad relevante; mitigado exigiendo lectura de `full.log` ante fallos de seguridad, no confiando solo en el tail de 40 líneas
- data: ninguno — no cambia el schema de `usage.json` ni la convención `.specloom/runs/` (ADR-008)
- deployment: el cambio de comportamiento llega a todo consumidor vía `npm update` + `loom sync`, sin migración manual requerida
- testing: agrega tests unitarios para el resumen compacto (éxito y fallo) en `framework/cli/test/run.test.js`
