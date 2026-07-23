---
status: accepted
date: 2026-07-06
ticket: loom-packet-command
---

# ADR: Context packet generado por CLI con frescura verificable por hash

## Context

ADR-010 estableció el `context-packet.md` como artefacto compacto que 5 playbooks (`sdd-code-review`, `sdd-security-gate`, `sdd-ux-gate`, `sdd-commit`, `sdd-verify`) leen en lugar de releer `proposal.md`+`tasks.md` completos. La convención funciona, pero su *generación* quedó como mecánica agente-manual: el paso 5 de `sdd-ff` instruye copiar secciones verbatim a mano (~1.2KB de template+instrucciones en el playbook, y output tokens que cuestan ~5× los de input por cada packet redactado).

La auditoría de tokens 2026-07-05 encontró las consecuencias en el consumer real athly-loom: el change activo `ath-004` no tiene packet (se creó con una versión de `sdd-ff` previa a ADR-010, y no existe forma CLI de generarlo retroactivamente), así que sus 5 fases consumidoras pagan el fallback completo (~6K tokens × 5 ≈ 30K tokens). Además, la "frescura" del packet (¿sigue reflejando proposal/tasks?) hoy depende del juicio del agente ("visibly contradicts"), repetido como prosa en 5 playbooks.

Fuerzas en tensión: la regla verbatim (los criterios nunca se resumen — cualquier pérdida de nuance rompe los gates) vs. la generación manual que la implementa; y la detección de staleness por juicio vs. por mecanismo.

## Decision

- La generación del `context-packet.md` es responsabilidad del CLI: `loom packet <ticket>` lee `proposal.md` + `tasks.md` y escribe el packet completo. El agente decide *cuándo* generarlo; el CLI garantiza *cómo*.
- La regla verbatim pasa de regla de prosa a garantía de código: las secciones Acceptance criteria, Security considerations y Constraints and non-goals se copian byte-exactas desde `proposal.md`.
- El packet gana frontmatter `sources: {proposal: <sha256>, tasks: <sha256>}` calculado sobre las fuentes al momento de generar. La frescura se verifica mecánicamente: `validatePacket` compara los hashes contra los archivos en disco y reporta staleness como issue de `loom validate`.
- El comando es determinista (misma entrada → packet byte-idéntico) e idempotente (sobrescribe sin flag: el packet es artefacto derivado, nunca fuente de verdad).
- Política de parsing: estricto con `proposal.md` (sección verbatim faltante → error sin escribir nada), tolerante con `tasks.md` (extrae lo que matchee los patrones del template; sección vacía → warning pero escribe, con "Full sources" como respaldo). Esto habilita backfill de changes creados por versiones viejas de `sdd-ff`.
- Packets legados sin frontmatter `sources` no se reportan como stale — el check de hash solo aplica cuando el frontmatter existe.
- Esta decisión extiende ADR-010 sin reemplazarlo: las 7 secciones, la regla verbatim, los 5 consumidores y la exclusión de `sdd-apply` siguen vigentes tal como ADR-010 los define.

## Consequences

### Positive

- Elimina la generación manual del packet (output tokens ~5× input) y el párrafo de template en `sdd-ff` (~1.2KB por invocación).
- Habilita backfill: changes en vuelo sin packet (ath-004) dejan de pagar fallback completo con un solo comando.
- La decisión "¿packet stale?" pasa de juicio del agente a comparación de hashes — precondición para que `loom context --for <fase>` (ticket 3) pueda confiar en el packet sin releer fuentes.
- Determinismo testeable: la garantía verbatim ahora tiene tests (`node --test`), no solo prosa.

### Negative

- El formato del packet incorpora frontmatter que las versiones manuales no tienen — coexisten dos generaciones de packets hasta que se regeneren (aceptado: la validación es tolerante con legados).
- El parsing de `tasks.md` acopla el CLI al formato del template de `sdd-ff` — cambios futuros al template de tasks deben actualizar el extractor.

### Risks

- Un bug en el extractor de tasks podría producir packets con "Files touched"/"Verification commands" incompletos sin que nadie lo note; mitigación: warning explícito en stderr cuando una sección extraída queda vacía + "Full sources" siempre presente como respaldo para los gates.
- Si `proposal.md` cambia después de aprobada, el hash detecta el drift pero no lo impide; la regla de congelación (ADR-018) sigue siendo la barrera normativa.

## Alternatives considered

### Mantener la generación agente-manual (statu quo)

Descartada: es el hallazgo P0 de la auditoría — output tokens ×5 por redacción, sin backfill posible, y frescura por juicio repetida en 5 playbooks.

### Generación automática como hook de `loom validate` (regenerar si stale)

Descartada: regenerar implícitamente esconde el momento de la decisión y puede pisar un packet mientras un gate lo lee; un comando explícito mantiene al agente como quien decide cuándo, con el CLI como ejecutor.

### Verificar frescura por mtime en vez de sha256

Descartada: mtime cambia con checkouts/touch sin cambio de contenido (falsos positivos) y no detecta ediciones que preservan mtime; sha256 sobre contenido es exacto y barato a estos tamaños.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: el comando escribe solo dentro de `openspec/changes/<slug>/` con slug sanitizado contra path traversal; los hashes se calculan sobre archivos ya versionados — sin superficie nueva de datos sensibles.
- data: el frontmatter `sources` se añade al formato del packet; packets legados sin frontmatter siguen siendo válidos.
- deployment: el comando llega a consumers vía npm update + `loom sync` (playbook `sdd-ff` regenerado); sin release en este ticket — el tag se corta aparte.
- testing: tests `node --test` nuevos para generación, verbatim byte-exacto, determinismo, staleness, tolerancia con tasks legado y rechazo de proposal incompleta.
