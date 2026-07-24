---
schema: code-review-report
schema_version: 1
change_id: contract-first-authoring
status: passed
updated: 2026-07-24
---
# Code Review Report — Authoring del contrato canónico en `sdd-design`

Contexto leído: `context-packet.md` (no `proposal.md`+`tasks.md` completos), más
`openspec/specs/system.md`, `docs/doc_architecture.md` y
`docs/doc_verification_guide.md`. Archivos cambiados vía
`playbook changed-files contract-first-authoring --diff`. El packet **no**
contradice las fuentes vivas (los digests de `sources` validan tras la
regeneración; ver Issue 1).

## Checklist

- [passed] **AC-1** — cubierto por `sdd-design authors the canonical contract when the proposal declares public_contract (AC-1, AC-2)` y por la guarda `sdd-plan does not author the canonical contract`.
- [passed] **AC-2** — cubierto por `sdd-design takes the contract path from config and never hardcodes it (AC-2)`: `doesNotMatch` del literal `openspec/specs/contracts/openapi.yaml`, match de la regla de `## Rules` y de `**Output file:**`.
- [passed] **AC-3** — cubierto por `sdd-design keeps the canonical contract and design.md's public contracts in sync (AC-3)`.
- [passed] **AC-4** — cubierto por `sdd-design forbids secrets and PII in the canonical contract (SEC-001, AC-4)`, con la mitad negativa asertada primero.
- [passed] **AC-5** — cubierto por `the README names sdd-design as the contract authoring stage (AC-5)`.
- [passed] **AC-6** — `npm run generate:check` sin drift.
- [passed] **AC-7** — 6 aserciones nuevas; `npm test` = 345 pass / 0 fail.
- [passed] **EC-1 / EC-2** — manejo explícito en el texto del paso 2 (`skip this step and say so`, `minimal skeleton`), asertado en el test de AC-1/AC-2.
- [passed] **EC-3** — verificado empíricamente: en el rojo de TDD las 5 aserciones fallaron por texto ausente antes del wiring.
- [passed] **EC-4** — `generate:check` es el gate del drift.
- [passed] **Sin cambios fuera de los módulos permitidos** — `git diff --stat`: `README.md`, `skills/sdd-design/{canonical,SKILL}.md`, `test/skill-contract.test.js`. Nada bajo `src/`, `schemas/`, `templates/`, ni en `openspec/specs/contracts/openapi.yaml`. Los 5 no-goals del proposal se respetan.
- [passed] **Convenciones y quality gates** — Principio 1 respetado (`canonical.md` editado + `npm run generate`; `SKILL.md` nunca a mano). Todos los comandos corridos vía `playbook run --change contract-first-authoring --step apply`. Nomenclatura de tests `('… (AC-N, EC-N)')` consistente con las aserciones de packet/spec-index existentes. Sin cruce de límites de capa: el change vive entero en skills + docs + tests.

## Issues found

### Issue 1 — `tasks.md` usaba etiquetas de quality-gate fuera del template, y el packet perdió `npm test` (CORREGIDO)
- **File**: `openspec/changes/contract-first-authoring/tasks.md:128-139` (Phase 4)
- **Problem**: la fase de gates usaba `**Drift de skills**` y `**Regresión**`
  (etiquetas propias) en vez de las del template de `sdd-plan`. `playbook packet`
  extrae comandos con un regex que sólo reconoce
  `Format|Lint/type-check|Feature tests|Regression`
  ([packet.js:49](src/tokens/packet.js:49)), así que **`npm test` y
  `npm run generate:check` no entraron al `context-packet.md`** — el archivo que
  leen `sdd-security-gate`, `sdd-runtime-gate`, `sdd-commit` y `sdd-verify`. En
  paralelo, backticks de prosa (`` `.js` ``, `` `docs/doc_verification_guide.md` ``)
  entraron como si fueran comandos, porque la extracción se lleva *todos* los
  tokens entre backticks de la línea ([markdown.js:137](src/util/markdown.js:137)).
  No hubo warning: `playbook packet` sólo avisa cuando la lista queda **vacía**,
  y acá quedó con 4 entradas, 2 de ellas basura.
- **Suggested fix** (aplicado): Phase 4 reescrita con las etiquetas exactas del
  template, `Regression` incluyendo `npm test` + `npm run generate:check`, y sin
  backticks de prosa en esas líneas. Packet regenerado: ahora extrae los 4
  comandos reales. Se agregó una nota en `tasks.md` explicando el contrato de
  extracción, para que la próxima granularización no repita el error.
- **Por qué no marca `failed`**: ningún AC quedó sin evidencia y ningún gate dejó
  de ejecutarse — los comandos **sí** corrieron (345/345 verde). El defecto era en
  un artefacto derivado, y se corrigió antes de cerrar el review.

## Observaciones fuera de scope (para el archive / plan maestro)

Ninguna requiere acción en este change; se registran para no re-investigarlas.

1. **El gap del Issue 1 es preexistente y más amplio.** El `tasks.md` del Ciclo A
   (`token-saving-parity`) directamente **no tenía línea `Regression`**, así que su
   packet tampoco llevó `npm test` — mismo efecto, otra causa. Candidato a un ciclo
   futuro: que `playbook packet` avise cuando falta la entrada `Regression`, o que
   `sdd-plan` la exija. Es la misma clase de falla que este plan viene cerrando
   ("existe y está testeado, pero la conexión real se pierde en silencio"), sólo que
   acá el eslabón perdido es un comando dentro del packet, no una instrucción.
2. **Las skills instaladas en `~/.claude/skills/` están atrasadas respecto de `main`.**
   El `sdd-apply` de esta sesión dice `.playbook/runs/` (el Ciclo A ya lo corrigió a
   `.specloom/runs/`) y el `sdd-code-review` no menciona `spec-index` (cableado en el
   Ciclo A). El código escribe correctamente en `.specloom/runs/`. Falta
   `playbook install` tras los merges de los Ciclos A/B.
3. **`playbook run` no acota el output de una aserción de `node --test` con un
   `actual` grande.** El "last 40 lines" incluyó el README completo serializado. La
   mitigación aplicada fue del lado del test (acotar la aserción a la sección), no
   del comando.
