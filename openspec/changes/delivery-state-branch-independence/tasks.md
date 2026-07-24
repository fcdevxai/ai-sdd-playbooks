---
schema: tasks
schema_version: 1
change_id: delivery-state-branch-independence
status: passed
updated: 2026-07-24
---
# Tasks — Delivery independiente de la branch actual

> **Orden TDD.** La Fase 1 captura la evidencia pre-fix y escribe los 4 tests **antes**
> de tocar producción: 3 arrancan en rojo, 1 en verde (fallback sin slug). La Fase 2
> los pone en verde.
>
> **Textos y deltas literales:** `design.md` → `## Approach`, secciones 1-5. El fix de
> producción son ~4 líneas; el resto del trabajo es la validación, los tests y la
> evidencia.
>
> **Por qué la evidencia pre-fix va primero:** el ADR del adapter `cli` (draft de este
> change) exige que un change que toque comportamiento observable del CLI registre la
> invocación real **antes y después**. El "antes" sólo se puede capturar con el código
> viejo, así que es la Task 1.1 y no un paso del gate.
>
> **Árbol limpio requerido para la repro.** `localGitState` corta a `uncommitted`
> **antes** de consultar GitHub, así que con el árbol sucio del apply la repro no llega
> al bug. Se usa un **worktree temporal en `main`** (árbol limpio, branch `main`), que
> es exactamente el escenario del bug. Se limpia al final (Task 4.1).
>
> Todos los comandos corren **desde la raíz del repo**. `sdd-apply` los ejecuta vía
> `playbook run --change delivery-state-branch-independence --step apply -- <cmd>`.

## Phase 1 — Evidencia pre-fix y tests (TDD, rojo primero)

### Task 1.1 — Capturar la evidencia conductual PRE-fix [x]
- **Files**: ninguno (sólo captura; la salida se transcribe al Execution Report)
- **Qué**: crear un worktree temporal en `main` y reproducir el bug con el código
  actual, usando un change **realmente mergeado** como slug (`token-saving-parity`,
  verificado `MERGED`):
  ```
  git worktree add <tmp>/pre-fix main
  node -e "…resolveDelivery({ cwd: '<tmp>/pre-fix' })…"                       # sin slug
  node -e "…resolveDelivery({ cwd: '<tmp>/pre-fix', slug: 'token-saving-parity' })…"
  ```
  Transcribir las dos salidas **verbatim**. Con el código actual ambas deben dar
  `committed`, porque el `slug` se ignora — ésa es la demostración del bug.
- **Success criterion**: las dos salidas quedan registradas en el Execution Report, y
  la segunda muestra `committed` (no `merged`) con el código pre-fix.
- **Linked acceptance criterion**: AC-4 (evidencia conductual exigida por el ADR del adapter `cli`)

### Task 1.2 — Helper `prByBranch` aditivo en el fake de `gh` [x]
- **Files**: `test/delivery.test.js`
- **Qué**: agregar la opción `prByBranch` a `fakeGh` según `design.md` § 4, leyendo la
  branch de `args[2]`. El camino `pr` legacy queda intacto.
- **Success criterion**: `node --test test/delivery.test.js` sigue en **20 pass / 0
  fail** — el helper es aditivo y ningún test existente se modifica (AC-2, AC-5).
- **Linked acceptance criterion**: AC-2, AC-5

### Task 1.3 — Test: un change mergeado resuelve `merged` desde cualquier branch [x]
- **Files**: `test/delivery.test.js`
- **Qué**: test `a merged change resolves as merged from any branch (AC-1, AC-4)`.
  `fakeGit({ branch: 'main' })` + `prByBranch: { 'my-change': { state: 'MERGED' } }`.
  Dos aserciones: **sin** slug → `committed` (fija el comportamiento actual, que sigue
  siendo correcto para `main`); **con** `slug: 'my-change'` → `merged`.
- **Success criterion**: falla en rojo **por la segunda aserción** (hoy devuelve
  `committed`). Es el gate sustantivo del ciclo.
- **Linked acceptance criterion**: AC-1, AC-4

### Task 1.4 — Test: sin slug se usa la branch actual [x]
- **Files**: `test/delivery.test.js`
- **Qué**: test `no slug falls back to the current branch (AC-2, EC-4)`. Branch con su
  propio PR en `prByBranch`, llamada sin slug → estado de ese PR.
- **Success criterion**: pasa en **verde desde el arranque** y queda como guarda de
  no-regresión del camino legacy.
- **Linked acceptance criterion**: AC-2, EC-4

### Task 1.5 — Test: `resolveMultiRepoDelivery` propaga el slug [x]
- **Files**: `test/delivery.test.js`
- **Qué**: test `resolveMultiRepoDelivery forwards the slug to resolveOne (AC-3)`. Un
  `resolveOne` espía que acumula sus `opts`; se assertea `slug` presente en el camino
  single-repo (sin repos impactados) **y** en el fan-out por repo.
- **Success criterion**: falla en rojo — hoy `resolveOne({ cwd })` no lleva `slug` en
  ninguno de los dos call sites.
- **Linked acceptance criterion**: AC-3

### Task 1.6 — Test: slug inválido falla cerrado sin invocar `gh` (SEC-001) [x]
- **Files**: `test/delivery.test.js`
- **Qué**: test `an invalid slug fails closed to unknown without invoking gh (AC-6, EC-1)`.
  **Mitad negativa, primero:** un runner de `gh` que **cuenta invocaciones**; con
  `slug: '../evil'` el contador debe quedar en **0**. Mitad positiva: el resultado es
  `unknown` con `blocked_reason` `INVALID_CHANGE_SLUG`. Cubrir también `''`, `'.'`,
  `'..'` y un slug con `/`.
- **Success criterion**: falla en rojo — hoy el slug no se valida, así que
  `githubContext(gh)` invoca `gh auth status` (contador ≥ 1) y el estado resultante es
  `committed`, no `unknown`. **La mitad negativa es la que pincha el orden de la
  validación**: si en la Fase 2 quedara después del chequeo de contexto, el contador
  daría 1 y este test seguiría rojo.
- **Linked acceptance criterion**: AC-6, EC-1 (SEC-1 / control SEC-001)

## Phase 2 — Producción

### Task 2.1 — `isSafeBranchSlug` + validación temprana (SEC-001) [x]
- **Files**: `src/github/index.js`
- **Qué**: agregar `isSafeBranchSlug` local (string no vacío, distinto de `.` y `..`,
  sin `/` ni `\` — mismo criterio que `isSafeSlug` de `src/tokens/packet.js:33`) y el
  guard **como primera sentencia** de `resolveDelivery`, antes de instanciar cualquier
  runner. Devuelve `{ state: 'unknown', blocked_reason: 'INVALID_CHANGE_SLUG' }` — no
  lanza. Sumar `INVALID_CHANGE_SLUG` al comentario de cabecera del módulo.
- **Depende de**: Task 1.6 (su test debe existir en rojo antes).
- **Success criterion**: el test de la Task 1.6 pasa **completo**, incluida su mitad
  **negativa** (contador de invocaciones de `gh` en **0**). Si la negativa quedara
  roja, la tarea **no** se marca completa: se corrige el orden de la validación, no el
  test.
- **Linked acceptance criterion**: AC-6, EC-1 (SEC-1 / control SEC-001)

### Task 2.2 — `slug || currentBranch` en `resolveDelivery` [x]
- **Files**: `src/github/index.js`
- **Qué**: reemplazar `const branch = currentBranch(git)` por
  `const branch = slug || currentBranch(git)`, con el comentario que explica por qué
  (referencia al ADR). `checksState(branch, gh)` hereda el cambio sin tocarse.
- **Depende de**: Tasks 1.3, 1.4.
- **Success criterion**: los tests de las Tasks 1.3 y 1.4 pasan; los 20 existentes
  siguen verdes.
- **Linked acceptance criterion**: AC-1, AC-2, AC-4

### Task 2.3 — Propagar el slug en `resolveMultiRepoDelivery` [x]
- **Files**: `src/repos/delivery.js`
- **Qué**: `resolveOne({ cwd, slug })` en el camino single-repo (línea ~70) y
  `resolveOne({ cwd: target.path, slug })` en el fan-out (línea ~81). Nada más.
- **Depende de**: Task 1.5.
- **Success criterion**: el test de la Task 1.5 pasa.
- **Linked acceptance criterion**: AC-3

## Phase 3 — Spec permanente

### Task 3.1 — Criterio de exclusión del adapter `cli` [x]
- **Files**: `openspec/specs/playbooks/spec.md`
- **Qué**: sección nueva con la regla del ADR `cli-adapter-exclusion-criterion`:
  exclusión por defecto en este repo, **exclusión no es exención de evidencia** (test
  que falle contra el código previo + invocación real registrada en el
  `runtime-gate-report.md`), y el disparador que revertiría la decisión. Va en la
  feature, no en el archive, porque el `sdd-runtime-gate` de **este** ciclo necesita
  citarla.
- **Success criterion**: la sección existe y `playbook validate --ci` sigue en exit 0.
- **Linked acceptance criterion**: AC-7

## Phase 4 — Quality gates

- **Format**: (sin formatter configurado)
- **Lint/type-check**: `node --check src/github/index.js`
- **Feature tests**: `node --test test/delivery.test.js`
- **Regression**: `npm test` + `npm run generate:check`

Referencia de regresión: **352 verdes** en `main` (`7466a8f` + archive); con los 4
nuevos deberían quedar **356**. `node --check` también sobre `src/repos/delivery.js`.

### Task 4.1 — Capturar la evidencia conductual POST-fix y limpiar el worktree [x]
- **Files**: ninguno (captura; se transcribe al Execution Report y al `runtime-gate-report.md`)
- **Qué**: repetir **los mismos dos comandos** de la Task 1.1 contra el código con el
  fix aplicado, y transcribir las salidas. Después `git worktree remove <tmp>/pre-fix`.
- **Depende de**: Tasks 2.1, 2.2, 2.3.
- **Success criterion**: el comando con `slug: 'token-saving-parity'` devuelve
  **`merged`** (antes: `committed`), y el comando sin slug sigue devolviendo
  `committed` — o sea el bug cerrado sin cambiar el camino legacy. El worktree queda
  eliminado (`git worktree list` no lo muestra).
- **Linked acceptance criterion**: AC-4

**Chequeo manual de no-scope** (no es comando de gate, no va al packet):
`git diff --stat` no debe listar nada bajo `src/lifecycle/`, `schemas/`, `skills/`,
`src/tokens/`, ni `src/github/repository.js` (no-goals del proposal).

---

# Execution Report

**Fecha:** 2026-07-24 · **Resultado:** 11/11 tareas `[x]`, gates verdes. Una desviación
menor, registrada abajo.

## Evidencia conductual (exigida por el ADR del adapter `cli`)

Worktree limpio en `main` (`3e31937`), slug de un change realmente mergeado
(`token-saving-parity`, `gh pr view` → `MERGED`). Mismos dos comandos antes y después:

```
PRE-FIX   branch=main, árbol limpio
  sin slug                            -> {"provider":"github","state":"committed"}
  slug: token-saving-parity (MERGED)  -> {"provider":"github","state":"committed"}   ← el bug

POST-FIX  branch=main, árbol limpio
  sin slug                            -> {"provider":"github","state":"committed"}   ← legacy intacto
  slug: token-saving-parity (MERGED)  -> {"provider":"github","state":"merged"}      ← corregido
```

El bug queda demostrado y cerrado con el mismo comando, los mismos inputs y un
resultado distinto. El camino sin slug no cambió. Worktree eliminado (`git worktree
list` → 1, el principal).

## Criterios de aceptación → evidencia

| AC | Evidencia | Estado |
|---|---|---|
| AC-1 | `a merged change resolves as merged from any branch (AC-1, AC-4)` + `the slug also selects which branch CI checks are read from (AC-1)` | ✅ |
| AC-2 | `no slug falls back to the current branch (AC-2, EC-4)`; los **20** tests preexistentes de `delivery.test.js` pasan **sin modificarse** (el helper `prByBranch` es aditivo) | ✅ |
| AC-3 | `resolveMultiRepoDelivery forwards the slug to resolveOne (AC-3)` — espía que verifica `slug` en el camino single-repo **y** en los 2 targets del fan-out | ✅ |
| AC-4 | mismo test de AC-1: su 2ª aserción **falló contra el código actual** en el rojo de TDD. Más la evidencia conductual de arriba | ✅ |
| AC-5 | el test de árbol sucio (`delivery.test.js`, "dirty working tree → uncommitted (GitHub not consulted)") pasa sin tocarse | ✅ |
| AC-6 | `an invalid slug fails closed to unknown without invoking gh (AC-6, EC-1)` | ✅ |
| AC-7 | `openspec/specs/playbooks/spec.md` → sección "The `cli` runtime adapter is excluded — with a stated criterion" | ✅ |
| AC-8 | `npm test` = **357 pass / 0 fail**; `playbook validate --ci` exit 0 | ✅ |

## Casos de borde y controles

- **EC-1** — cubierto por el test de AC-6 sobre **6** slugs inválidos (`../evil`, `a/b`,
  `a\b`, `..`, `.`, `''`), cada uno verificando contador de `gh` en 0.
- **EC-2** — camino `GITHUB_CONTEXT_UNAVAILABLE` sin tocar; su test preexistente pasa.
- **EC-3** — hueco aceptado: el test de árbol sucio sigue fijando `uncommitted` sin
  consultar GitHub. Documentado en el ADR y va al checklist de seguridad en el archive.
- **EC-4** — cubierto por el test de fallback sin slug, verde desde el arranque.
- **SEC-001 — el test negativo se escribió y corrió PRIMERO.** La mitad negativa
  (contador de invocaciones de `gh` en **0**) es la que pincha el **orden** de la
  validación, no sólo su existencia: con el guard después de `githubContext(gh)` el
  contador daría 1. Verificada aislada post-fix
  (`--test-name-pattern="invalid slug fails closed"` → 1 pass / 0 fail).
- **SEC-002 — nada se persiste.** `git diff` no toca `playbook.lock` ni ningún schema;
  el `slug` es parámetro de entrada. `git diff --stat` sobre `src/lifecycle/ schemas/
  skills/ src/tokens/ src/github/repository.js` → **0 líneas**.

## Comandos (todos vía `playbook run --change delivery-state-branch-independence --step apply`)

| Comando | Resultado |
|---|---|
| `node --test test/delivery.test.js` (rojo TDD) | 21 pass / **4 fail** — los 4 nuevos que dependen del fix; el de fallback verde |
| `node --test test/delivery.test.js` (post-fix) | ✅ **25/25** |
| `node --test --test-name-pattern="invalid slug fails closed"` | ✅ 1/1 (SEC-001 aislado) |
| `node --check src/github/index.js` | ✅ |
| `node --check src/repos/delivery.js` | ✅ |
| `npm test` | ✅ **357 pass / 0 fail** |
| `npm run generate:check` | ✅ sin drift |
| `playbook validate --ci` | ✅ exit 0 |

**Cero reintentos consumidos**: cada tarea pasó al primer intento (cap: 2 por tarea).

## Desviaciones respecto del plan

1. **5 tests nuevos en vez de 4** → 357 en total, no los 356 que predijo el diseño. El
   extra es `the slug also selects which branch CI checks are read from (AC-1)`: el
   diseño señalaba que `checksState(branch, gh)` hereda el `branch` corregido "sin
   cambio adicional", y eso merecía su propia aserción en vez de quedar implícito.
   Requirió una segunda opción aditiva en el fake (`checksByBranch`), del mismo molde
   que `prByBranch`. Amplía cobertura de un AC existente; no toca ningún AC ni archivo
   fuera de scope.
2. **Ninguna otra.** El delta de producción salió literal del `design.md`: guard como
   primera sentencia, `slug || currentBranch(git)`, y las 2 líneas de propagación.

## Observación de proceso

A mitad del apply, `playbook validate --ci` falló con `context-packet.md stale` —
porque marcar `tasks.md` como `in_progress` cambia el archivo del que deriva el packet.
Se regeneró con `playbook packet`. **Es exactamente el caso que el Ciclo D acaba de
cablear en el paso 1 de `sdd-commit`** (regeneración determinista permitida dentro del
loop acotado): la primera aparición espontánea del escenario que motivó esa decisión,
y confirma que no era hipotético.
