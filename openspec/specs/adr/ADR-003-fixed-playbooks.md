---
status: accepted
date: 2026-07-03
ticket: npm-package-distribution
---

# ADR: Los playbooks de specloom son fijos, sin mecanismo de customización por proyecto consumidor

## Context

Al definir el modelo de distribución (ver ADR de dependencia git), surgió una pregunta separada: ¿pueden los playbooks (`framework/playbooks/*/canonical.md`) customizarse por proyecto consumidor — por ejemplo, con un fork local o un mecanismo de override/extends — o se mantienen fijos, idénticos para todos los consumidores, actualizados únicamente por el paquete? Esta decisión determina si `npm update` es una operación segura (sin ediciones locales que perder) o una operación riesgosa (con posibilidad de perder una customización local en cada actualización, o de tener que mergear cambios del paquete contra un fork).

## Decision

Los playbooks de specloom son fijos. No existe mecanismo de override ni de customización por proyecto consumidor. Todo ajuste de proceso se hace upstream, en el propio repo `specloom`, y llega a los consumidores vía `npm update` — igual que el fix aplicado hoy mismo a `sdd-archive/canonical.md` (paso de git workflow y checkpoint de verificación) habría llegado a cualquier consumidor con un simple update, en vez de tener que rehacerse a mano en cada clon.

Lo específico de cada proyecto consumidor — stack tecnológico, comandos de test, superficies de seguridad conocidas, topología de repos — vive en archivos que el paquete nunca sobreescribe ni gestiona: `config.yaml`, `docs/doc_verification_guide.md`, `docs/security-checklist.md`, `CLAUDE.md`. Los playbooks ya delegan ahí lo específico de stack (ej. "corré el comando de testing del verification guide") en vez de hardcodearlo — ese seam ya existe hoy y es lo que hace viable esta decisión.

## Consequences

### Positive

- `npm update` es seguro por diseño: no hay edición local de playbook que perder o mergear al actualizar.
- Un fix de proceso beneficia a todos los consumidores con un solo `npm update`, en vez de tener que rehacerse en cada clon — el caso concreto de esta misma sesión (hardening de `sdd-archive`) es evidencia directa de esto.
- Simplifica el comando `sync`: siempre es seguro regenerar `.claude/commands/*` sin detectar drift, porque nunca existe una edición local que proteger — a diferencia del `loom sync --check` actual, pensado para un repo que sí permite editar playbooks localmente.

### Negative

- Un proyecto consumidor con una necesidad de proceso genuinamente distinta (ej. un gate adicional que otros consumidores no necesitan) no tiene forma de expresarla sin proponer el cambio upstream, lo cual puede no encajar por igual con todos los consumidores.
- Cualquier cambio de playbook, por chico que sea, requiere pasar por el ciclo de release de specloom (tag + `npm update`) en vez de un ajuste local inmediato.

### Risks

- Si en la práctica algún consumidor necesita de verdad una variación de proceso, la única vía disponible hoy es forkear el paquete entero — mitigación: se evaluará un mecanismo de extensión más adelante si esto se vuelve un patrón recurrente, no de forma preventiva.

## Alternatives considered

### Playbooks extensibles (override/extends por proyecto)

Descartada por ahora: reintroduce, a nivel de playbook individual, el mismo problema de "copia local que puede desincronizarse del original" que este ticket busca eliminar a nivel de repo completo — mismo síntoma, otra escala.

## Impact

- backend: sin impacto.
- frontend: sin impacto.
- security: sin impacto directo — el mantenimiento centralizado no introduce ninguna superficie nueva.
- data: sin impacto.
- deployment: define cómo se propagan los cambios de proceso a todo proyecto que use loom de ahora en adelante — vía `npm update`, nunca por edición local.
- testing: sin impacto directo más allá de la simplificación ya cubierta por la suite existente de `sync`.
