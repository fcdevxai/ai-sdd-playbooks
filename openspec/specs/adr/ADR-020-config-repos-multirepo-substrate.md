---
status: accepted
date: 2026-07-06
ticket: loom-cli-helpers
---

# ADR: config.yaml `repos` como sustrato de ejecución multi-repo

## Context

ADR-015 (explicit-impacted-repos-section) y ADR-016 (gate-check-standalone-command) introdujeron el bloque `repos` de `config.yaml` — cada repo sibling del hub declara su `path` (relativo al root del loom) y sus comandos de `verification` (`format`/`lint`/`test`/`build`, texto libre). Hasta hoy ese bloque lo lee **un solo consumidor**: `loom gate-check`, a través de `resolveGatePlan` + `normalizeVerificationCommands` + `runGateCheck`, que spawnea cada verificación con `cwd = repos[name].path`.

La auditoría de tokens 2026-07-05 midió la consecuencia de no usar ese bloque en el resto del flujo: en el consumer real athly-loom (hub multi-repo con backend Java/Spring + frontend Angular como siblings), ~19 de 30 runs registrados usan el anti-patrón `bash -lc cd ../athly-api && ./mvnw ...` — a pesar de que ADR-011 (cwd-safety) prohíbe exactamente eso. Ocurre porque `loom run` no tiene forma de ejecutar en un repo sibling: el agente no tiene más opción que `cd`. El propio `config.yaml` lo admite en un comentario: *"Playbooks that should eventually read this file (not yet implemented)"*.

La fuerza en tensión: `config.yaml repos` ya es la fuente de verdad de dónde vive cada repo y cómo se verifica, pero solo un comando la consume — el resto del CLI trata al hub multi-repo como excepción en vez de caso primario.

## Decision

`config.yaml repos` es el sustrato canónico de ejecución multi-repo para todo el CLI, no solo para `gate-check`. En concreto:

- `loom run --repo <name>` resuelve `cwd` desde `repos[<name>].path` y ejecuta con la misma telemetría compactada de `loom run`. Soporta dos modos: passthrough (`-- <cmd>`) y `--verification <key>`, que resuelve el comando declarado en `repos[<name>].verification[<key>]` (cualquier clave presente, no solo las cuatro convencionales del template).
- `loom changed-files <ticket> --repo <name>` corre git en el `cwd` de ese repo.
- El nombre de repo es un **allowlist**: solo se ejecuta en repos declarados en `config.yaml repos`. Un nombre no declarado, una clave de verification inexistente, o un `path` ausente en disco → error claro sin ejecutar nada (mismo contrato que `runGateCheck` hoy).
- La resolución de repo/verificación se comparte con `gate-check` (reutiliza `resolveGatePlan`/`normalizeVerificationCommands`), no se duplica: hay una sola interpretación de `repos` en el CLI.

Esta decisión extiende ADR-015/016 sin reemplazarlos: el formato de `repos`, las claves de verification y el gating no cambian; solo se amplían sus consumidores.

## Consequences

### Positive

- Elimina la razón estructural del anti-patrón `cd` (~63% de los runs de athly): el agente referencia el repo por nombre, no por ruta relativa frágil.
- Los comandos de verificación quedan centralizados en `config.yaml`: cambiar de stack (Java→Node, u otro proyecto/lenguaje) se resuelve editando config una vez, sin tocar prosa de playbooks — `--verification test` sigue funcionando sea `./mvnw test` o `npm test`.
- Una sola interpretación de `repos` en el CLI reduce el riesgo de que `run`/`changed-files`/`gate-check` diverjan en cómo resuelven rutas.

### Negative

- Amplía la superficie que depende del formato de `config.yaml repos`: un cambio futuro a ese formato ahora afecta a tres comandos, no a uno.
- El modo passthrough ejecuta comandos provistos por el agente/usuario en el `cwd` de un repo sibling — hereda el modelo de confianza de `loom run` sin ampliarlo, pero la ejecución fuera del root del loom se vuelve rutinaria.

### Risks

- Un `path` mal declarado en `config.yaml` podría apuntar a un directorio inesperado; mitigación: se ejecuta solo sobre nombres del allowlist y se verifica existencia del path antes de spawnear (error claro si falta), igual que `runGateCheck`.
- El passthrough no restringe qué comando se corre (por diseño); la barrera es el allowlist de *repos*, no de *comandos* — documentado en la security-checklist como riesgo aceptado heredado de `loom run`.

## Alternatives considered

### Mantener `repos` exclusivo de gate-check (statu quo)

Descartada: es la causa medida del anti-patrón `cd` en el consumer real, que viola ADR-011 y genera fricción/retries.

### Un flag de path ad-hoc por comando (`--cwd <path>`)

Descartada: reintroduce rutas relativas frágiles en cada invocación (justo lo que ADR-011 evita) y no aprovecha los comandos de verificación ya declarados; el nombre de repo + allowlist es más seguro y más greppeable.

## Impact

- backend: sin impacto (specloom no tiene backend; el sustrato aplica a los repos del consumer)
- frontend: sin impacto
- security: la ejecución se restringe al allowlist de `config.yaml repos`; el passthrough hereda el modelo de confianza de `loom run` sin ampliarlo — se documenta en docs/security-checklist.md "Known accepted risks".
- data: sin impacto (no persiste datos nuevos; la telemetría de `run --repo` usa el layout existente de `.specloom/runs/`)
- deployment: llega a consumers vía npm update + `loom sync`; sin release en este ticket.
- testing: tests `node --test` cubren resolución de repo, clave de verification inexistente, path ausente, y allowlist.
