---
status: accepted
date: 2026-07-23
ticket: restore-specloom-provenance
---

# ADR: Fusión de ai-sdd-playbooks y specloom en playbook-ai; herencia de ADRs y retención de `.specloom/`

## Context

`playbook-ai` nace de la fusión de dos frameworks SDD hermanos: `ai-sdd-playbooks` (motor de ciclo de vida determinista, JSON Schemas, runtime-gate por capabilities, install multi-runtime) y `specloom` (multi-repo, ADRs, ingeniería de contexto/tokens, seguridad trazable). La fusión inicial portó el *código* de specloom pero descartó su *no-código*: los 25 ADRs (`ADR-001..025`), los specs permanentes de dominio y las auditorías de tokens; y renombró el directorio de runtime `.specloom/` → `.playbook/`. El resultado dejó referencias colgantes (el código citaba `ADR-NNN` y `framework/cli/lib.js` que no existían en el repo). Fuerza en tensión: unificar bajo un solo nombre de producto sin borrar la procedencia ni la autoría de specloom.

## Decision

- **Heredar `ADR-001..025` de specloom verbatim** en `openspec/specs/adr/`, preservando su frontmatter (fechas, tickets de origen) y su razonamiento — son inmutables (ADR-001). Documentan decisiones de specloom que `playbook-ai` hereda.
- **Mapeo de rutas de los ADRs heredados**: las rutas que citan (`framework/cli/lib.js`, `loom`, `specloom`) refieren al layout de specloom; en `playbook-ai` los módulos equivalentes viven bajo `src/` (multi-repo → `src/repos/`, tokens → `src/tokens/`, ADRs → `src/adr/`).
- **Retener `.specloom/` como directorio de runtime** (runs + índice), revirtiendo el rename a `.playbook/`. El producto se llama `playbook-ai`; el runtime dir conserva el nombre de su origen como atribución. El stamp de instalación `.playbook-version` (linaje de ai-sdd-playbooks, en el dir global de skills) se mantiene — no es concepto de specloom.
- **Migrar los specs de dominio y las auditorías de tokens** de specloom, y registrar la autoría en `CREDITS`.

## Consequences

### Positive

- La autoría y el razonamiento de specloom sobreviven la fusión y quedan citables.
- Las referencias `ADR-NNN` del código resuelven; se elimina la clase de referencia colgante.
- El `spec-index` vuelve a tener specs permanentes que indexar.

### Negative

- Los ADRs heredados citan rutas del layout de specloom, que requieren el mapeo descrito acá para ubicarlas en `playbook-ai`.
- Coexisten dos linajes de nombres: producto `playbook-ai`, runtime `.specloom/`, stamp `.playbook-version`.

### Risks

- Un lector podría interpretar las rutas de los ADRs heredados como rutas de `playbook-ai`; mitigación: este ADR y `CREDITS` explicitan el origen y el mapeo.

## Alternatives considered

### Reescribir ADR-001..025 para "playbook-izar" su contenido

Descartado: los ADRs son inmutables (ADR-001) y registran decisiones tomadas en specloom; reescribirlos falsificaría la historia. Se heredan verbatim y este ADR puente explica el mapeo de rutas.

### Renombrar todo a `.playbook/` y no acreditar specloom

Descartado: borra la autoría de una creación propia del equipo sin ganancia técnica. Unificar el nombre del producto no obliga a borrar la procedencia.

## Impact

- backend: sin impacto (framework de specs; no hay backend).
- frontend: sin impacto.
- security: sin cambios. Se evaluó restaurar el template `.claude/settings.json` de specloom, pero se dejó fuera: es solo de Claude Code (el proyecto es multi-runtime) y la política de permisos es decisión de cada consumidor.
- data: se re-crea el corpus `openspec/specs/adr/ADR-001..025` + los specs de dominio; el runtime escribe en `.specloom/`.
- deployment: sin impacto en CI.
- testing: tests anti-referencia-colgante y de scaffolding de `.claude/settings.json`.
