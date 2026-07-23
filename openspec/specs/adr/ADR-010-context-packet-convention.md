---
status: accepted
date: 2026-07-03
ticket: context-packet
---

# ADR: context-packet.md como artefacto intermedio generado en sdd-ff y consumido por gates, commit y verify

## Context

El plan de optimización de tokens de specloom (Fase 3, tras Fases 1-2 de telemetría y compactación de `loom run`) identificó que `sdd-code-review`, `sdd-security-gate`, `sdd-ux-gate`, `sdd-commit` y `sdd-verify` releen `proposal.md` + `tasks.md` + `system.md` completos en cada ejecución, aunque cada uno solo necesita una fracción específica de ese contenido (criterios de aceptación, constraints, security considerations, archivos tocados, comandos de verificación). Esta decisión afecta cómo se construye todo playbook futuro que revise o cierre un change: define qué artefacto generan, en qué paso, y qué deben consumir en vez de releer las fuentes completas.

## Decision

- `sdd-ff` genera `context-packet.md` en el mismo paso donde genera `tasks.md` (inmediatamente después, para poder extraer de ahí archivos tocados y comandos de verificación).
- El packet tiene 7 secciones fijas: ticket/feature name, acceptance criteria (verbatim), constraints y non-goals (verbatim), security considerations (verbatim), archivos a crear/modificar, comandos de verificación/quality gates, y un puntero explícito a `proposal.md`/`tasks.md` completos.
- Los criterios de aceptación y las security considerations se copian **verbatim** desde `proposal.md`, nunca resumidos con pérdida.
- Consumidores del packet: `sdd-code-review`, `sdd-security-gate`, `sdd-ux-gate`, `sdd-commit`, `sdd-verify`. `sdd-apply` queda excluido — sigue leyendo las fuentes completas porque necesita el detalle íntegro para escribir código.
- Si `context-packet.md` no existe (change creado antes de esta convención), cada uno de los 5 consumidores cae en fallback silencioso al comportamiento actual (leer `proposal.md`+`tasks.md`+`system.md` completos), sin bloquear ni advertir.
- `loom validate` agrega `validatePacket` (mismo patrón que `validateDesign`): el packet es opcional, pero si existe debe tener las 7 secciones no vacías.
- Optimizar la lectura de `system.md` (anchors, lectura por sección) queda fuera de esta decisión — es responsabilidad de la Fase 4 (spec index) del roadmap.

## Consequences

### Positive

- Reduce directamente el consumo de tokens de 5 de los 8 comandos del ciclo SDD, sin sacrificar rigor: el contenido crítico (criterios, security considerations) se preserva verbatim.
- Toda decisión de qué generar/consumir queda centralizada en un solo lugar (esta ADR), evitando que cada playbook futuro reinvente su propio mecanismo de resumen.
- El fallback silencioso evita romper changes existentes o en curso al momento de mergear esta feature.

### Negative

- Introduce un artefacto más por change (`context-packet.md`) que debe mantenerse sincronizado con `proposal.md`/`tasks.md` — si alguno cambia después de generado el packet (ej. una revisión tardía de `tasks.md`), el packet puede quedar desactualizado y nadie lo regenera automáticamente.
- Agrega una sección de validación estructural más (`validatePacket`) a mantener en `framework/cli/lib.js`.

### Risks

- Si un `proposal.md`/`tasks.md` se edita después de generado el packet, los consumidores pueden operar sobre información desactualizada — mitigado documentando en los playbooks consumidores que si detectan inconsistencia entre el packet y las fuentes, deben preferir las fuentes y señalarlo.
- El fallback silencioso puede ocultar que un change no se está beneficiando del ahorro esperado — mitigado porque la telemetría de `loom run` (Fase 1) permite detectar esto por comparación de tokens entre changes con y sin packet.

## Alternatives considered

### Generar el packet en sdd-new en vez de sdd-ff

Descartada: en el momento de `sdd-new`, `tasks.md` todavía no existe (es un placeholder), por lo que el packet no podría incluir archivos tocados ni comandos de verificación — dos de las 7 secciones quedarían vacías hasta `sdd-ff`.

### Incluir sdd-apply como consumidor del packet

Descartada: `sdd-apply` es quien escribe el código; necesita el detalle completo de `proposal.md` (todas las secciones, no solo criterios) y de `tasks.md` (fases completas, no solo la lista de archivos) para tomar decisiones de implementación. Reducir su contexto arriesga a que ignore matices del spec.

### Regenerar el packet automáticamente en cada consumidor si detecta drift

Descartada por ahora: agrega complejidad (detección de drift, regeneración) sin evidencia de que el problema ocurra en la práctica; se prefiere mitigar documentando la preferencia por las fuentes completas ante inconsistencia detectada manualmente.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: sin impacto directo — ver `proposal.md`, la única superficie es la fidelidad del copiado verbatim de security considerations, mitigada por diseño
- data: ninguno — no cambia ningún schema de datos de producto, solo agrega un artefacto de texto por change en `openspec/changes/`
- deployment: el cambio llega a todo consumidor de specloom vía `npm update` + `loom sync --target all`, sin migración manual requerida
- testing: agrega tests unitarios para `validatePacket` en `framework/cli/test/` y verificación end-to-end de que los 5 consumidores leen el packet cuando existe
