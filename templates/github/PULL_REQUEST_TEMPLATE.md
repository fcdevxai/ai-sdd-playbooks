## Referencia a spec

- **Ticket**: <!-- [feat-XXX-descripcion](link-al-issue) -->
- **Spec activa**: `openspec/changes/[ticket-slug]/proposal.md`
- **Rama**: `[ticket-slug]-descripcion-corta`

## Criterios de aceptación verificados

<!-- Copia los criterios de aceptación de tu proposal.md y marca los completados -->

- [ ] [Criterio 1 de la spec]
- [ ] [Criterio 2 de la spec]

## Casos de error cubiertos

<!-- Copia los casos de error de tu proposal.md y marca los cubiertos -->

- [ ] [Caso de error 1]

## Artefactos del ciclo SDD

- [ ] `/sdd-enrich-us` ejecutado — user story enriquecida
- [ ] `proposal.md` con `status: pending` (aprobada antes de implementar)
- [ ] `tasks.md` con `status: ready` (granularizado con `/sdd-ff`)
- [ ] `/sdd-apply` completado — `testing-report.md` generado
- [ ] `/sdd-code-review` ejecutado — `code-review-report.md` con veredicto **LISTO PARA PR HUMANO**

## Verificación de calidad

<!-- TODO: reemplaza estos comandos con los de tu stack tecnológico -->
<!-- Ejemplos:
  - [ ] `npm test` pasa sin failures
  - [ ] `npm run lint` sin errores
  - [ ] `pytest` pasa sin failures
  - [ ] `cargo test` pasa sin failures
-->

- [ ] [Comando de tests de tu stack] pasa sin failures
- [ ] [Comando de lint/format de tu stack] ejecutado

## Cambios fuera de scope

<!-- Si hay cambios no contemplados en la spec, explica por qué y actualiza proposal.md -->

Ninguno / [Descripción del cambio y spec actualizada]

## Checklist del revisor humano

- [ ] Los criterios de aceptación en este PR coinciden con los de `proposal.md`
- [ ] El código no toca módulos marcados como non-goals en `proposal.md`
- [ ] Los casos de error de la spec tienen manejo explícito en el código
- [ ] Los tests validan comportamiento, no solo que el código corre
