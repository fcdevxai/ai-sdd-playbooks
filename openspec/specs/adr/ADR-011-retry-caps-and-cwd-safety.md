---
status: accepted
date: 2026-07-04
ticket: retry-caps-cwd-safety
---

# ADR: Topes numéricos de reintento con stop/report, y comandos independientes del cwd, como convención de playbook

## Context

La auditoría de tokens de SpecLoom (2026-07-03) verificó por grep exhaustivo que ninguno de los 10 playbooks canónicos tiene un límite numérico en sus bucles: el TDD por tarea en `sdd-apply` ("never mark a task complete without its verification passing"), el loop fix→`loom validate`→re-run en `sdd-new`/`sdd-commit`, y el Q&A de `sdd-enrich-us` ("no artificial limit", literal) son todos "repite hasta que pase". La auditoría los marcó como causa #3 de consumo de tokens: "las sesiones malas son las caras".

Esto se confirmó empíricamente en la medición de la Fase 3 (context-packet.md): dos sesiones de Claude Code, mismo ticket, mismo modelo, mismo nivel de esfuerzo, corriendo exactamente los mismos 5 comandos, variaron +47% en tokens de output y +25% en cache-read entre sí. La causa no fue la feature bajo prueba — fue que una de las dos sesiones tuvo más errores de navegación de shell (un `cd` a un path inexistente, un comando `git` con un argumento ambiguo), cada uno disparando un turno de retry que reprocesa todo el historial acumulado. Esta decisión afecta cómo se construye todo playbook futuro que tenga un bucle de reintento o que genere/ejecute comandos de shell.

## Decision

- **Topes de reintento, con stop/report (nunca abort)**:
  - `sdd-apply`: máximo 2 reintentos por tarea en el loop TDD. Al 3er rojo, se detiene y reporta el estado de la tarea + la ruta al `full.log` del último `loom run`, sin marcar la tarea `[x]`.
  - `sdd-new` y `sdd-commit`: máximo 3 iteraciones del loop fix→`loom validate`→re-run. Al 4to intento fallido, se detiene y reporta los issues pendientes tal como los devuelve `loom validate`.
  - `sdd-enrich-us`: máximo 4 rondas de Q&A. A la 5ta ronda con decisiones aún abiertas, se detiene y resume qué dimensiones siguen sin cerrar, preguntando explícitamente si el usuario quiere seguir iterando.
  - En los tres casos, el tope nunca aborta el trabajo — dispara un stop/report que describe el estado actual y espera instrucción humana. Si el humano decide continuar, eso resetea el contador conscientemente.
  - El tope de retries de TDD nunca puede resultar en marcar una tarea completa con un test de seguridad fallando — la regla existente de `sdd-apply` ("never implement a task tied to a security consideration without its negative test passing") es una condición más fuerte que prevalece sobre el stop/report.
  - Los topes viven como texto en los propios `canonical.md`, no en `config.yaml` — la Fase 6 del roadmap de optimización de tokens puede parametrizarlos después sin romper esta convención.

- **Comandos independientes del cwd (cwd-safe)**:
  - `sdd-ff`, al generar comandos en `tasks.md`/`context-packet.md`, debe escribirlos de forma que sean ejecutables desde la raíz del repo sin depender de un `cd` previo (paths root-relative, o flags como `-C`/`--prefix` en vez de `cd X && comando`).
  - `sdd-apply` y `sdd-verify`, al ejecutar esos comandos, deben verificar el cwd (`pwd`) antes de correrlos y nunca asumir el cwd heredado del paso o tarea anterior.

## Consequences

### Positive

- Acota la cola cara de sesiones problemáticas: un test flaky o un error de shell ya no puede degenerar en un número indefinido de reintentos, cada uno repagando el historial acumulado completo.
- El stop/report da al humano un punto de control explícito exactamente donde el costo empieza a acumularse, en vez de descubrirlo al final de una sesión cara.
- Elimina una clase completa de error (path relativo mal asumido) que la propia medición de Fase 3 identificó como más impactante en tokens que la feature que se intentaba medir.

### Negative

- Introduce fricción human-in-the-loop en casos legítimos donde un problema simplemente necesita más de 2-3-4 intentos para resolverse — el humano tiene que intervenir explícitamente para que el agente siga.
- Los topes son instrucciones textuales, no mecanismos de código — el framework no puede forzar que el modelo los respete; dependen de que el agente los seąa y los aplique correctamente en cada sesión.

### Risks

- Un agente puede ignorar el tope textual bajo presión de contexto (igual que puede ignorar cualquier otra regla de un playbook) — mitigado porque el stop/report es una instrucción de bajo costo cognitivo (un conteo simple), no una regla que compita con el objetivo principal de la tarea.
- Si los números elegidos (2/3/4) resultan demasiado bajos para casos reales legítimos (ej. un entorno de CI lento que necesita más reintentos por causas ajenas al código), se generará fricción innecesaria — mitigado porque el humano puede simplemente decir "seguí" y el contador se resetea; no es un límite duro del sistema.

## Alternatives considered

### Límites configurables en config.yaml desde el día uno

Descartada por ahora: requiere código nuevo en el framework para leer y citar `tokenBudget` desde los playbooks, acoplando este ticket con el diseño de la Fase 6 (que todavía no está cerrado). Hardcodear los números en el texto de los playbooks es más simple, no bloquea la Fase 6, y esta puede parametrizarlos después sin romper la convención.

### Conteo automático de reintentos vía código del CLI

Descartada: el framework no tiene forma de instrumentar cuántas veces el modelo reintenta una tarea sin agregar un mecanismo de tracking nuevo (fuera de scope de este ticket, y de valor dudoso dado que `loom run` ya registra cada invocación en `.specloom/runs/` — un análisis post-hoc con `countPriorRuns` ya existente podría servir para esto en una fase futura, pero no es necesario para resolver el problema ahora).

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: la regla de que el tope de retries nunca permite marcar completa una tarea de seguridad con test en rojo se documenta explícitamente en `sdd-apply`, reforzando (no debilitando) la regla existente
- data: ninguno
- deployment: el cambio llega a todo consumidor de specloom vía `npm update` + `loom sync --target all`, sin migración manual requerida
- testing: no aplica testing automatizado tradicional — la verificación es una revisión manual de que cada `canonical.md` editado menciona su tope/regla correctamente y no contradice reglas de seguridad existentes
