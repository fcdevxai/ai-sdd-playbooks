---
schema: code-review-report
schema_version: 1
change_id: delivery-state-branch-independence
status: passed
updated: 2026-07-24
---
# Code Review Report — Delivery independiente de la branch actual

Contexto leído: `context-packet.md` (no `proposal.md`+`tasks.md` completos), más
`openspec/specs/system.md`, `docs/doc_architecture.md` y
`docs/doc_verification_guide.md`. Archivos cambiados vía `playbook changed-files
delivery-state-branch-independence --diff`. Se full-readearon
`src/github/index.js`, `src/repos/delivery.js`, `src/cli/status.js` y
`src/config/artifacts.js` — el diff toca la resolución de un valor que se convierte
en argumento de un comando, así que el diff solo no alcanzaba para juzgarlo. El packet
no contradice las fuentes vivas.

## Checklist

- [passed] **AC-1** — `a merged change resolves as merged from any branch (AC-1, AC-4)` + `the slug also selects which branch CI checks are read from (AC-1)`.
- [passed] **AC-2** — `no slug falls back to the current branch (AC-2, EC-4)`; los 20 tests preexistentes de `delivery.test.js` pasan **sin modificarse** (verificado: el helper `prByBranch`/`checksByBranch` sólo actúa cuando se lo pasa).
- [passed] **AC-3** — `resolveMultiRepoDelivery forwards the slug to resolveOne (AC-3)`, con espía sobre los **dos** call sites (single-repo y fan-out).
- [passed] **AC-4** — la 2ª aserción de AC-1 falló contra el código previo (21 pass / 4 fail en el rojo de TDD) **y** hay evidencia conductual con un change realmente mergeado: `committed` → `merged`.
- [passed] **AC-5** — el test de árbol sucio pasa sin tocarse; `git diff` confirma que esa línea de `resolveDelivery` no cambió.
- [passed] **AC-6** — `an invalid slug fails closed to unknown without invoking gh (AC-6, EC-1)` sobre 6 slugs inválidos, contando invocaciones de `gh`.
- [passed] **AC-7** — `openspec/specs/playbooks/spec.md`: sección "The `cli` runtime adapter is excluded — with a stated criterion".
- [passed] **AC-8** — `npm test` = 357 pass / 0 fail; `playbook validate --ci` exit 0.
- [passed] **EC-1..EC-4** — manejo explícito y asertado; EC-3 es el hueco aceptado y documentado (no silenciado).
- [passed] **Sin cambios fuera de los módulos permitidos** — 4 archivos: `src/github/index.js`, `src/repos/delivery.js`, `test/delivery.test.js`, `openspec/specs/playbooks/spec.md`. Los 4 están en `## Impacted modules`. `git diff --stat` sobre `src/lifecycle/ schemas/ skills/ src/tokens/ src/github/repository.js` → **0 líneas**: el motor sigue puro y `localGitState` intacto, como declaran los no-goals.
- [passed] **Convenciones y límites de capa** — `src/github/` sigue haciendo delivery en vivo y `src/lifecycle/` sigue siendo motor puro sin fs/red (tabla de `docs/doc_architecture.md` respetada). Todos los comandos vía `playbook run --change … --step apply`. Convención de comentarios de `system.md` respetada tras el Issue 2.

## Issues found

### Issue 1 — El contrato documentado era ambiguo sobre `null` (CORREGIDO)
- **File**: `src/github/index.js` (comentario de cabecera)
- **Problem**: el guard es `slug !== undefined && !isSafeBranchSlug(slug)`, así que un
  `null` explícito **falla cerrado** con `INVALID_CHANGE_SLUG`. El comportamiento es el
  correcto —fail-closed es el principio declarado del módulo y de la agregación
  multi-repo— pero el comentario decía "Without a slug the current branch is used", que
  un lector interpreta como "`null` también cae en fallback". Un contrato ambiguo sobre
  el caso de borde de un valor que se convierte en argumento de comando no es un
  detalle de redacción.
- **Suggested fix** (aplicado): la cabecera ahora distingue explícitamente — sólo un
  slug **ausente** (`undefined`) cae en la branch actual; cualquier otro valor
  malformado falla cerrado "rather than silently resolving a different change".
- **Por qué no marca `failed`**: no hay AC sin evidencia ni cambio de comportamiento;
  era precisión del contrato, y se corrigió dentro del gate.

### Issue 2 — Un comentario explicaba *qué* hace el código, contra una convención documentada (CORREGIDO)
- **File**: `src/github/index.js` (línea de `const branch = slug || currentBranch(git)`)
- **Problem**: el comentario `// The change's own branch when we know it; the
  checked-out branch otherwise.` reformula la línea que sigue. `openspec/specs/system.md`
  → `## Code conventions` dice: *"No comments explaining **what** code does; only
  **why**, when non-obvious."* El *por qué* ya está en la cabecera del módulo, así que
  el comentario era redundante además de fuera de convención.
- **Suggested fix** (aplicado): eliminado. Los otros tres comentarios agregados se
  revisaron contra la misma regla y **sí** explican por qué (el orden del guard, la
  duplicación deliberada de `isSafeBranchSlug`, y que los repos hermanos comparten la
  branch del change) — se conservan.
- **Por qué no marca `failed`**: violación de convención de estilo, sin efecto
  funcional, corregida antes de cerrar el review.

Re-verificado tras ambas correcciones: `npm test` **357 pass / 0 fail**,
`node --check src/github/index.js` limpio.

## Observaciones fuera de scope

Ninguna requiere acción en este change.

1. **El alcance real de la validación del slug es más chico de lo que sugiere el
   proposal, y conviene decirlo.** El único caller productivo es `src/cli/status.js:41`
   con `slug: change.changeId`, y `changeId` es `path.basename(changeDir)`
   (`src/config/artifacts.js:58`) — o sea **siempre** un string no vacío que por
   construcción no puede contener `/` ni `\`. Así que el guard **no puede dispararse
   hoy por el camino productivo**: es defensa en profundidad para callers futuros y
   para uso programático, no protección contra un vector alcanzable. El proposal
   (SEC-1) dice correctamente que no había inyección; vale que el security gate
   caracterice la validación con esta precisión y no como cierre de una exposición
   real.
2. **La convención change-id ↔ nombre de branch ya era load-bearing antes de este
   change.** `resolveChangeDir` (`src/cli/status.js:28`) desambigua qué change folder es
   el activo comparando `path.basename(dir) === branch`. El ADR de este change dice que
   "promueve una convención existente a contrato"; en rigor la convención **ya** era
   contrato en la resolución del change folder, lo que hace el cambio **más seguro** de
   lo que el propio ADR declara en sus `Negative`. Corroboración, no defecto — pero
   vale registrarla para que un lector futuro no crea que este change introdujo la
   dependencia.
3. **`isSafeBranchSlug` duplica `isSafeSlug` de `src/tokens/packet.js`.** Decisión
   consciente del diseño (unificar excede los módulos declarados en un proposal
   aprobado) y ya anotada como follow-up del **Ciclo G** de la §11 del plan, que es
   exactamente sobre validación inconsistente entre módulos. Con este change hay ahora
   **dos** definiciones con reacciones distintas —una lanza, la otra falla cerrada— lo
   que refuerza ese ciclo en vez de sólo diferirlo.
