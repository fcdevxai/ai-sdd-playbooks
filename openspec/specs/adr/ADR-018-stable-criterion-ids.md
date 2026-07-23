---
status: accepted
date: 2026-07-05
ticket: token-audit-quick-wins
---

# ADR: IDs estables para criterios (AC-N / EC-N / SEC-N)

## Context

Los reports SDD (testing, code-review, security-gate, ux-gate, verification) repiten el texto completo de cada criterio de aceptación en sus tablas. La auditoría de tokens 2026-07-05 midió que en un consumer real (athly-loom, ciclo ath-005) los reports suman 11.7KB por feature y ~30–40% de ese peso es texto de criterios ya presente verbatim en `proposal.md` y `context-packet.md`. Además, la trazabilidad depende de que el texto parafraseado coincida — un criterio reescrito con otras palabras es difícil de greppear y de mapear a evidencia. Cada report se relee después en `sdd-verify` y `sdd-commit`, multiplicando el costo.

La fuerza en tensión: comprimir referencias sin perder la garantía verbatim de los criterios (regla de ADR-010: acceptance criteria y security considerations nunca se resumen), y sin romper la trazabilidad criterio → test → evidencia que los gates necesitan.

## Decision

- `proposal.md` numera sus criterios con IDs estables al redactarse: `AC-N` (acceptance criteria), `EC-N` (error cases), `SEC-N` (security considerations).
- Los IDs se **congelan** cuando la proposal pasa a `status: pending`. Después de la aprobación no se renumeran ni se reordenan; cambiar un criterio aprobado exige un change nuevo.
- Los artefactos downstream (`tasks.md`, reports de gates, testing-report, verification-report) **referencian el ID** más la evidencia (test, comando, run-id de `.specloom/runs/`) y no repiten el texto del criterio.
- El texto completo vive únicamente en `proposal.md` y su copia verbatim en `context-packet.md` — la regla verbatim de ADR-010 no cambia.
- La convención aplica a proposals nuevas; los changes archivados no se renumeran retroactivamente.

## Consequences

### Positive

- Reports ~30–40% más livianos, y ese ahorro se re-cobra cada vez que verify/commit los releen.
- Un ID es más greppeable que texto parafraseado: la trazabilidad criterio → evidencia mejora en vez de degradarse.
- Base para automatización futura (`loom packet`, `loom context`) que puede validar cobertura de IDs mecánicamente.

### Negative

- Leer un report aislado ya no basta para conocer el texto del criterio; hay que tener la proposal o el packet a mano (mitigado: el packet siempre acompaña al change activo).

### Risks

- Si la proposal se edita después de aprobada, los IDs "bailan" y las referencias quedan mal apuntadas. Mitigación: la regla de congelación en `status: pending` queda escrita en el template, y el hash del context-packet (roadmap `loom packet`) detectará el drift mecánicamente.

## Alternatives considered

### Mantener texto verbatim en reports

Descartada: es el statu quo que la auditoría midió como 30–40% de peso repetido por report, releído en cada fase posterior.

### Referencias por hash de contenido

Descartada: un hash detecta drift pero no es legible ni greppeable por humanos; un ID secuencial congelado da trazabilidad legible y el drift lo cubrirá el hash del packet.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: los gates referencian `SEC-N` en sus tablas, pero el texto completo de security considerations sigue verbatim en proposal y packet — sin pérdida de nuance para el review.
- data: sin impacto
- deployment: la convención se propaga a consumers vía npm update + `loom sync` (templates regenerados).
- testing: los reports de testing referencian `AC-N` + test/comando/run-id como evidencia en vez de repetir el criterio.
