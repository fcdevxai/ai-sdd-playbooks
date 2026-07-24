---
schema: code-review-report
schema_version: 1
change_id: convention-drift-verify-commit
status: passed
updated: 2026-07-24
---
# Code Review Report — Restaurar `pwd` en `sdd-verify` y el retry cap en `sdd-commit`

Contexto leído: `context-packet.md` (no `proposal.md`+`tasks.md` completos), más
`openspec/specs/system.md`, `docs/doc_architecture.md` y
`docs/doc_verification_guide.md`. Archivos cambiados vía
`playbook changed-files convention-drift-verify-commit --diff`. El packet **no**
contradice las fuentes vivas: se regeneró al cerrar `sdd-apply`, y `playbook
validate` confirma los digests de `sources`.

## Checklist

- [passed] **AC-1** — `sdd-verify verifies pwd before running feature and regression commands (AC-1)`: los tres puntos (paso 1, paso 5, `## Rules`).
- [passed] **AC-2** — `sdd-verify's pwd rule covers context-packet.md commands, not just tasks.md (AC-2)`.
- [passed] **AC-3** — `sdd-commit caps the fix→validate→re-run loop at 3 iterations (AC-3)`, ampliado en este gate con la aserción de coherencia con `## Preconditions` (Issue 1).
- [passed] **AC-4** — `sdd-commit forbids blind edits inside the retry loop (AC-4)`.
- [passed] **AC-5** — `sdd-commit's retry loop regenerates derived artifacts and never edits signed ones (AC-5)` + `sdd-commit never makes validate pass by weakening a gate status (SEC-001)`.
- [passed] **AC-6** — `npm run generate:check` sin drift.
- [passed] **AC-7** — 8 aserciones nuevas (7 planeadas + 1 de este gate); `npm test` = 352 pass / 0 fail.
- [passed] **EC-1 / EC-2** — manejo explícito y asertado: `without consuming an iteration`, `4th failed attempt` + `exactly as playbook validate returns them`, `not named regenerable counts as signed`.
- [passed] **EC-3** — verificado empíricamente: 39 pass / **6 fail** en el rojo de TDD, por texto ausente.
- [passed] **EC-4** — `generate:check` es el gate del drift y corre en CI.
- [passed] **Sin cambios fuera de los módulos permitidos** — `git diff --stat` sobre `src/ schemas/ templates/ skills/sdd-apply/ skills/sdd-new/ README.md` → **0 líneas**. Los 5 archivos tocados son `skills/sdd-{verify,commit}/{canonical,SKILL}.md` y `test/skill-contract.test.js`. Los 7 no-goals del proposal se respetan, incluido "no superseder ADR-011" (el draft de ADR lo complementa; no declara `supersedes:`).
- [passed] **Convenciones y quality gates** — Principio 1 respetado (`canonical.md` + `npm run generate`; `SKILL.md` nunca a mano). Todos los comandos vía `playbook run --change … --step apply`. Nomenclatura de tests `('… (AC-N)')` consistente. Sin cruce de límites de capa: el change vive entero en skills + tests. Los textos salieron literales del `design.md` aprobado.

## Issues found

### Issue 1 — El `## Preconditions` de `sdd-commit` contradecía el paso 1 nuevo, y podía dejarlo inerte (CORREGIDO)
- **File**: `skills/sdd-commit/canonical.md:47` (bloque `## Preconditions (self-check)`)
- **Problem**: el bloque decía "2. `playbook validate` passes." seguido de "If any
  fail, stop and report." El paso 1 nuevo dice lo contrario para el caso que más
  importa: si `validate` falla **sólo** por un `context-packet.md` stale, regenerá con
  `playbook packet` y reintentá. Las precondiciones se leen **antes** que el
  `## Behavior`, así que la lectura más directa —"validate no pasa → stop"— hace que
  el loop del paso 1 **nunca se alcance**. El resultado sería el peor de los dos
  mundos: la instrucción presente, los tests en verde, y el comportamiento sin
  cambiar. Es exactamente la clase de defecto que este plan viene cerrando
  ("documentado pero desconectado"), sólo que acá el desconector sería una
  instrucción contradictoria dentro del mismo archivo, no un merge.
- **Suggested fix** (aplicado): la precondición 2 ahora dice "…passes — or its only
  remaining failure is a derived artifact this stage may regenerate, which step 1
  handles under its capped loop". Se **mantuvo** intacto "Do not commit around a
  blocking finding". Y se agregó una aserción al test de AC-3 que exige esa deferencia
  explícita, para que un merge futuro no pueda restaurar la contradicción en silencio.
  Regenerado (`npm run generate`), `npm test` = 352 pass / 0 fail, `generate:check`
  sin drift, y la mitad negativa de SEC-001 re-verificada contra el body nuevo (0
  matches en ambos regex).
- **Por qué no marca `failed`**: ningún AC quedó sin evidencia, ningún archivo salió
  de scope, ningún gate dejó de ejecutarse. El defecto era de coherencia interna y se
  corrigió dentro del gate, antes de cerrar el review.

## Observaciones fuera de scope (para el archive / plan maestro)

Ninguna requiere acción en este change.

1. **El Issue 1 es un modo de falla que vale nombrar como clase — YA REGISTRADO
   DURABLEMENTE.** Los 5 ciclos de este plan asumieron que "wiring + test de contenido"
   alcanza para que una instrucción ocurra. El Issue 1 muestra el hueco: un test de
   contenido verifica que el texto **está**, no que sea **alcanzable** — que ninguna
   sección previa del mismo prompt lo contradiga. Regla práctica: al cablear una
   instrucción nueva, releer `## Preconditions`, `## Context` y `## Rules` y confirmar
   que ninguna la niega.
   **Anotado en la §10 del plan maestro** (`PLAN-wiring-gaps-y-paridad-tokens.md`, fuera
   del repo, así que sobrevive al borrado de este change folder), junto con la
   verificación de que los 3 wirings mergeados de los Ciclos A/B/C **sí** son
   alcanzables (comprobado, no asumido).
   **Pendiente para `sdd-archive`:** llevarlo también a
   `openspec/specs/playbooks/spec.md` — es donde viven las demás convenciones de
   enforcement, y es el único hogar *dentro* del repo que persiste.
2. **`sdd-verify` no tuvo el problema análogo** porque no tiene bloque
   `## Preconditions`; sus dos puntos de ejecución de comandos son los pasos 1 y 5, y
   ambos quedaron cubiertos. Verificado, no asumido.
3. **El cambio de comportamiento de `sdd-commit` no es ejercitable por tests** (ya
   anticipado en `design.md` → `## Testing strategy`). El `sdd-commit` que corra en
   este mismo ciclo es todavía la copia previa al change; el loop nuevo recién actúa
   tras un `playbook install`. No es un defecto, es el límite de lo verificable acá —
   y refuerza el hallazgo 1 de la §8 del plan (falta señal de staleness de skills
   instaladas, ADR-006 sin implementar).
