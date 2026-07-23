---
status: accepted
date: 2026-07-02
ticket: adr-decision-records
---

# ADR: Adoptar Architecture Decision Records en el ciclo SDD

## Context

El ciclo SDD de loom cierra con `sdd-archive`, que migra el *resultado* de una feature a `openspec/specs/` como prosa y luego elimina la carpeta `openspec/changes/[ticket]/` con todo su contenido. El *razonamiento* de las decisiones — contexto, alternativas consideradas, trade-offs, riesgos aceptados — se destruye en ese `rm -rf`. La evidencia de que faltaba un hogar para decisiones transversales: la decisión "loom-first" de ownership de contratos vive como comentario YAML en `config.yaml`, y el manual mencionaba ADRs de forma aspiracional sin que nada los implementara. Las fuerzas en tensión: preservar el porqué sin burocratizar el ciclo (no todo ticket toma decisiones que ameriten registro permanente), y evitar colisiones de numeración entre changes paralelas.

## Decision

Adoptar ADRs como artefacto de primera clase del ciclo SDD, con estas reglas:

- El ADR no es una fase del pipeline: es una obligación disparada por tipo de decisión (relevante o difícil de revertir, según checklist de 7 categorías: auth, estructura de módulos, contratos, librería significativa, persistencia, despliegue, convención transversal).
- Los drafts nacen en `openspec/changes/[ticket]/adr-[decision-slug].md` sin número, con `status: proposed`; solo un humano los mueve a `accepted`/`rejected`.
- `sdd-archive` los promueve a `openspec/specs/adr/ADR-NNN-[decision-slug].md` asignando número secuencial al archivar (punto de serialización) y manteniendo un índice `README.md` derivado del directorio.
- Los ADRs promovidos son inmutables: un cambio de decisión se registra con un nuevo ADR que declara `supersedes: ADR-NNN`; el antiguo solo recibe la actualización de frontmatter (`status: superseded`, `superseded_by`).
- `loom validate` verifica la estructura de los drafts presentes (frontmatter, secciones, 6 superficies de impacto); la *necesidad* de un ADR la juzga el humano vía checkbox del PR.
- Las specs y docs citan al ADR en vez de re-argumentar la decisión: `system.md` enuncia la regla, el ADR guarda el porqué.

## Consequences

### Positive

- El razonamiento de decisiones difíciles de revertir sobrevive al archive y queda citable.
- Cero fricción para tickets sin decisiones de arquitectura: el ciclo no cambia.
- La numeración al archivar elimina colisiones entre changes paralelas por diseño.
- La validación estructural es automática y única (lib.js), sin cambios en CI.

### Negative

- Un artefacto más que aprender y mantener en el framework.
- La promoción agrega un paso (con gate humano) al playbook de archive.
- Las decisiones tomadas antes de esta adopción no tienen registro (requieren backfill explícito).

### Risks

- Si el trigger se aplica con exceso de celo, se generan ADRs-ruido que degradan el valor del índice; mitigación: checklist de 7 categorías + juicio humano en el checkbox del PR.
- Si un archive se interrumpe entre la promoción y el `rm -rf`, pueden quedar drafts duplicados del ADR promovido; mitigación: el paso de promoción re-escanea y el índice se regenera del directorio.
- ADRs podrían tentarse a documentar detalles operativos sensibles; mitigación: regla explícita de no incluir secretos ni endpoints internos, revisada por el security gate.

## Alternatives considered

### Sistema de my_ssd tal cual (ADRs mutables en docs/adr/, numerados al crear)

Descartado en dos puntos: los ADRs mutables ("creado o actualizado") destruyen justo lo que el artefacto existe para preservar — qué se sabía al decidir — y la numeración al crear colisiona con el modelo de changes paralelas de loom. Se conserva su template (probado a escala en ADR-002 de athly) y su trigger por irreversibilidad.

### Solo prosa en system.md (statu quo mejorado)

Descartado: `system.md` enuncia reglas vigentes, no conserva contexto ni alternativas; el archive seguiría destruyendo el razonamiento y las decisiones transversales seguirían sin hogar (caso `config.yaml`).

### design.md obligatorio y persistente como registro de decisiones

Descartado: mezcla dos vidas útiles distintas — el cómo-construir es efímero por diseño y forzarlo como permanente infla las specs; además un design.md obligatorio agrega boilerplate a tickets pequeños. Se mantiene design.md como artefacto opcional que muere al archivar.

### No hacer nada

Descartado: el costo ya es observable (decisión loom-first en comentario YAML, menciones aspiracionales de ADR en el manual) y crece con cada archive.

## Impact

- backend: sin impacto (este repo es un framework de specs; no hay backend).
- frontend: sin impacto.
- security: regla de no-secretos en ADRs; riesgos de seguridad aceptados en un ADR se cruzan a `docs/security-checklist.md` → "Known accepted risks" al archivar.
- data: nuevo directorio permanente `openspec/specs/adr/` con índice derivado; drafts `adr-*.md` en las change folders.
- deployment: sin impacto en CI — `spec-lint` sigue delegando en `loom validate`.
- testing: primera suite `node:test` del framework cubre la validación de ADRs y design.md.
