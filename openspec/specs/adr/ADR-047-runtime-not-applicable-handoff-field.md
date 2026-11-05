---
schema: adr
status: accepted
date: '2026-11-04'
ticket: runtime-coverage-per-criterion-capabilities
---

# ADR: Campo `runtime_not_applicable` en el handoff de `tasks.md` y en el manifest

## Context

La decisión de permitir omisiones explícitas de capacidades por criterio (ADR-046) necesita un lugar en los artefactos. El handoff de
`tasks.md` ya tiene `runtime_coverage` (criterio → repositorios × capacidades) y `non_runtime`
(criterio sin superficie de runtime, con motivo), y `src/tokens/handoff.js` transporta
`non_runtime` al handoff manifest como `non_runtime_criteria`. El formato de `tasks.md` y del
manifest es un contrato que usan todos los proyectos que adoptan la metodología, y los manifests
existentes están ligados por hash a reportes sellados.

## Decision

1. `tasks.md` acepta la lista opcional `handoff.runtime_not_applicable`, con entradas
   `{criterion, repository, capability, rationale}`: los cuatro campos obligatorios y sin
   propiedades adicionales.
2. El handoff manifest transporta la lista como `runtime_not_applicable`, con la misma forma.
3. Si la lista está ausente o vacía, el manifest no incluye el campo, así que los manifests de
   changes que no la usan quedan idénticos a los de la versión 0.11.0.
4. Una lista mal formada falla de forma cerrada: `playbook packet` la rechaza con un mensaje y el
   validador la reporta como problema, nunca como aceptación.

## Consequences

### Positive
- Una omisión por par, sin ambigüedad en entradas multi-repo.
- Cambio aditivo: los `tasks.md` y manifests existentes siguen siendo válidos y no cambian sus hashes.
- Sigue el patrón ya conocido de `non_runtime` → `non_runtime_criteria`.

### Negative
- Una lista más en el handoff que quien planifica debe conocer; se documenta en `sdd-plan`.

### Risks
- Los esquemas de `handoff` y del manifest no prohíben propiedades adicionales, así que un CLI
  anterior a 0.12.0 ignora el campo en silencio: la omisión no surte efecto y el gate sigue
  fallando con la regla anterior (falla cerrado, no abre nada). Se mitiga con la subida de
  versión menor y la nota en `CHANGELOG.md`.

## Alternatives considered

### Campo `omitted` dentro de cada entrada de `runtime_coverage`
Descartada: aplica a todos los repositorios de la entrada y se vuelve ambiguo en entradas multi-repo.

### Reutilizar `non_runtime` con una capacidad opcional
Descartada: mezcla dos significados distintos; `non_runtime` declara que el criterio no tiene
superficie de runtime en absoluto.

### Declararlo en el reporte del gate
Descartada: la decisión pertenece al plan (`tasks.md`), no a la evidencia.

## Impact

- backend: `src/tokens/handoff.js` (validación de forma y transporte al manifest)
- frontend: no impact
- security: no impact (texto de motivo revisado por una persona; sin secretos ni datos personales)
- data: `schemas/tasks.schema.json` y `schemas/handoff-manifest.schema.json`, cambio aditivo
- deployment: release `0.12.0`
- testing: pruebas de esquema y de `playbook packet` para la lista nueva
