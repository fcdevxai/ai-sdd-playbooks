---
status: accepted
date: 2026-07-05
ticket: cross-repo-gate-check
# supersedes: ADR-NNN
---

# ADR: `loom gate-check` como comando standalone

## Context

specloom necesita validar repos hermanos antes de archivar una feature multi-repo. Esa validación debe ejecutarse automáticamente desde `sdd-archive`, pero también debe poder correrse de forma directa para diagnosticar fallas, iterar localmente y cubrir el comportamiento con tests del CLI. Encapsularla como comando evita que el playbook de archive sea el único punto de entrada a una regla que pertenece al CLI.

## Decision

Agregar `loom gate-check` como comando propio del CLI. `sdd-archive` debe invocar ese comando como precondición, pero la lógica de leer `config.yaml`, resolver repos impactados, ejecutar verificaciones y reportar resultados vive en la implementación compartida del comando.

## Consequences

### Positive

- La validación cross-repo queda disponible para uso manual, automatización local y `sdd-archive`.
- Los tests pueden cubrir el comportamiento sin ejecutar todo el flujo de archive.
- El reporte de fallas se mantiene consistente entre ejecución directa y ejecución desde el playbook.

### Negative

- El CLI suma un comando nuevo que debe documentarse, testearse y mantenerse.

### Risks

- Si `sdd-archive` no invoca el comando en el punto correcto, podría existir un camino de archive que omita la precondición. La implementación debe cubrir esta integración con tests o verificación de playbook.

## Alternatives considered

### Lógica inline solo en `sdd-archive`

Descartada porque oculta una regla operacional importante dentro de un único playbook y dificulta correr el diagnóstico de forma aislada.

### Script externo fuera del CLI

Descartada porque duplicaría resolución de paths, carga de config y convenciones de telemetry que ya pertenecen a specloom.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: ejecuta comandos consumer-owned declarados en config, misma confianza que otros comandos locales del proyecto
- data: sin impacto
- deployment: sin impacto directo; afecta precondiciones locales antes de archivar specs
- testing: requiere tests del CLI para comando directo y para integración con el flujo de archive
