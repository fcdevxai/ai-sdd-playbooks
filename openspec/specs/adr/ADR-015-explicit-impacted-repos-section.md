---
status: accepted
date: 2026-07-05
ticket: cross-repo-gate-check
# supersedes: ADR-NNN
---

# ADR: Repos impactados declarados en `proposal.md`

## Context

En una topología multi-repo, el código impactado por una feature puede vivir fuera del repo donde se archivan las specs. specloom no puede inferir de forma confiable qué repos hermanos son relevantes a partir de un diff local del repo de specs. La propuesta ya usa `## Impacted modules` como contrato explícito de alcance; los repos impactados necesitan el mismo nivel de declaración para que el gate sea auditable y predecible.

## Decision

Agregar una sección `## Impacted repos` en `proposal.md`. `loom gate-check` lee esa sección y ejecuta verificaciones solo para los repos declarados allí. Un ticket sin repos impactados declarados no activa verificaciones cross-repo en proyectos single-repo o cambios que solo tocan specloom.

## Consequences

### Positive

- El alcance cross-repo queda visible en la proposal y revisable antes de aprobar el ticket.
- Evita heurísticas frágiles basadas en git diff, nombres de ramas o convenciones de carpetas.
- Permite que cambios single-repo conserven el comportamiento actual.

### Negative

- La exactitud depende de que el autor de la proposal declare todos los repos afectados.

### Risks

- Si un repo afectado no se declara, `gate-check` no lo verificará. La revisión humana de la proposal debe tratar `## Impacted repos` como parte del contrato de alcance.

## Alternatives considered

### Auto-detección por git diff o historial

Descartada porque el repo de specs puede no contener el código de los repos técnicos y la relación entre archivos cambiados y repos impactados no es universal.

### Derivar repos desde `## Impacted modules`

Descartada porque los módulos de specloom no mapean de forma estable a nombres de repos consumidores.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: reduce ambigüedad de alcance para comandos que se ejecutan localmente
- data: cambia el schema documental de proposals activas al sumar una sección de alcance
- deployment: sin impacto
- testing: requiere tests de parsing de `## Impacted repos`, ticket sin repos y repos no declarados
