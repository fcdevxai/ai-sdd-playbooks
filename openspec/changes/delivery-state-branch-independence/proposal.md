---
schema: proposal
schema_version: 1
change_id: delivery-state-branch-independence
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
impact:            # any true → sdd-design becomes required
  public_contract: false   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
  data_model: false
  architecture_boundary: true
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: []     # PROPUESTO — ver nota al reviewer en SEC-1
runtime_relevant_capabilities: []   # PROPUESTO — ver el draft de ADR del adapter cli
---

# Delivery independiente de la branch actual

## Objective

`playbook status` reporta un delivery **distinto para el mismo change** según la
branch de git que esté checkouteada:

| Desde | delivery | `playbook next` dice |
|---|---|---|
| la branch del change | `merged` | `sdd-verify` ✅ |
| `main`, post-merge, árbol limpio | `committed` | `sdd-commit (push and open the pull request)` ❌ |

O sea: el CLI aconseja re-abrir un PR de un change ya mergeado. **Reproducido 3 veces**
durante los Ciclos C y D — checkoutear `main` después de mergear es lo natural, y es
exactamente lo que rompe la respuesta.

Esto choca de frente con el **primer principio de producto** de
`openspec/specs/system.md`: "**The CLI is the authority on state**, never the language
model. `sdd-next` and every gate skill defer to `playbook status`/`next`/`validate`".
Esa autoridad sólo sirve si contesta lo mismo a la misma pregunta.

**Causa raíz verificada.** `resolveDelivery` (`src/github/index.js`) recibe
`{cwd, runGit, runGh}` — **sin identificador de change** — y resuelve el PR de la
branch actual:

```js
const branch = currentBranch(git);
const pr = prForBranch(branch, gh);
if (!pr) return { provider: 'github', state: 'committed' };
```

Desde `main`, `gh pr view main` no encuentra PR → `committed`.

**El change-id ya está a mano una capa más arriba:** `src/cli/status.js:41` llama
`resolveMultiRepoDelivery({ cwd, slug: change.changeId })`, y `src/repos/delivery.js`
usa ese `slug` para leer `## Impacted repos` — pero después hace `resolveOne({ cwd })`
sin él. La información no falta: **se descarta**.

**Ventana del bug, acotada:** `computeNext` consulta el delivery **sólo** cuando
`lifecycle.state === 'runtime_cleared'` (`src/lifecycle/engine.js`), que es justo la
ventana post-merge/pre-verify.

## Guiding principle

**El fix propaga datos que ya existen en el call site, no agrega un mecanismo.** No
hay estado nuevo, no se persiste nada, y el camino sin `slug` queda byte-idéntico —
los 20 tests actuales de `test/delivery.test.js` deben pasar sin tocarse.

Es el **primer ciclo cuyo fix está en `src/`** y no en un prompt, así que el
enforcement cambia de naturaleza: un **test unitario que falla contra el código
actual** (AC-4), no una aserción de contenido. Es un gate más fuerte que el de los 4
ciclos anteriores, porque prueba comportamiento en vez de presencia de una frase.

Se respeta la restricción documentada de `system.md` para `src/github/`: "Live
delivery state (git + `gh`), **never persisted**". La alternativa descartada era
guardar la referencia al PR; el fix la refuerza en vez de erosionarla.

## Impacted modules

- `src/github/index.js`: `resolveDelivery` acepta un `slug` opcional y resuelve el PR
  y los checks de esa branch; sin `slug`, cae en `currentBranch` (comportamiento
  actual). Valida el slug antes de que llegue a `gh`.
- `src/repos/delivery.js`: `resolveMultiRepoDelivery` propaga su `slug` a `resolveOne`,
  en el camino single-repo y en el fan-out por repo.
- `test/delivery.test.js`: tests nuevos, incluido el que falla con el código actual.
  El test de árbol sucio **no se toca**.
- `openspec/specs/playbooks/spec.md`: criterio de exclusión del adapter `cli` y qué
  evidencia se exige en su lugar.
- 2 drafts de ADR (los numera y promueve `sdd-archive`).

**Sin delta:** `src/lifecycle/` (el motor puro no cambia: `DELIVERY_NEXT` y el mapeo
lifecycle→next quedan igual), `src/github/repository.js` (`localGitState` intacto),
`schemas/`, `skills/`.

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

No aplica: single-repo (`playbook-ai`).

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un change con su PR mergeado y el árbol limpio, **When** corre `playbook
  status` desde `main` **o** desde la branch del change, **Then** ambos reportan
  `merged` y `next` rutea a `sdd-verify`.
- **Given** un change cuya branch tiene un PR abierto con CI en verde, **When** corre
  `status` desde cualquier branch, **Then** reporta `ci_passed` y `next` dice
  `merge (awaiting human merge)`.

### Edge cases

- **Given** una branch del change que nunca se pusheó, **When** se resuelve el
  delivery, **Then** `committed` — correcto: falta pushear.
- **Given** que la branch se borró localmente tras el merge, **When** se busca el PR,
  **Then** `gh` la resuelve igual por nombre (**verificado**: `gh pr view
  token-saving-parity` → `{"state":"MERGED"}`).
- **Given** un slug sin branch ni PR en ningún lado, **When** se busca, **Then**
  `prForBranch` devuelve `null` → `committed`.
- **Given** el árbol sucio, **When** se resuelve el delivery, **Then** `uncommitted`
  sin consultar GitHub — **sin cambios**, es un contrato testeado
  (`test/delivery.test.js:51`) y mantiene el CLI usable offline.
- **Given** una llamada sin `slug` (legacy), **When** se resuelve, **Then**
  comportamiento idéntico al actual vía `currentBranch`.
- **Given** `gh` no disponible o sin auth, **When** se resuelve, **Then** `unknown`
  con `GITHUB_CONTEXT_UNAVAILABLE` — sin cambios.

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** `resolveDelivery` acepta un `slug` opcional y, cuando está presente,
resuelve el PR y los checks de esa branch en vez de la actual.
**AC-2:** sin `slug`, el comportamiento es idéntico al actual — los 20 tests
existentes de `test/delivery.test.js` pasan sin modificarse.
**AC-3:** `resolveMultiRepoDelivery` propaga el `slug` a `resolveOne`, tanto en el
camino single-repo como en el fan-out por repo impactado.
**AC-4:** existe un test que **falla contra el código actual**: change con PR
mergeado, `currentBranch` = `main`, delivery resuelto = `merged` (no `committed`).
**AC-5:** el corto-circuito de árbol sucio sigue intacto — `test/delivery.test.js:51`
("dirty working tree → uncommitted (GitHub not consulted)") pasa sin tocarse.
**AC-6:** el slug se valida antes de convertirse en argumento de `gh`; un slug
inválido no produce ninguna invocación de `gh`.
**AC-7:** `openspec/specs/playbooks/spec.md` documenta el criterio de exclusión del
adapter `cli` y qué evidencia se exige en su lugar.
**AC-8:** `npm test` verde y `playbook validate --ci` exit 0.

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1. -->

**EC-1:** slug inválido (con `/`, `\`, `..`, `.` o vacío) → se rechaza con error claro
y **sin invocar `gh`**.
**EC-2:** `gh` falla o no está autenticado → `unknown` con
`GITHUB_CONTEXT_UNAVAILABLE`; el fix no cambia este camino.
**EC-3:** árbol sucio con PR mergeado → `uncommitted`. **Hueco aceptado y
documentado**, no silenciado: cerrarlo exigiría consultar GitHub antes del estado
local, lo que rompe un test fijado y fuerza una llamada de red en el camino común,
degradando el uso offline. En ese caso el operador sí tiene trabajo sin commitear.
**EC-4:** llamada sin `slug` → camino legacy; ningún test existente se rompe.

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** El slug se usa como nombre de branch en `gh pr view <branch>` y
`gh pr checks <branch>`. Ya viaja como **elemento de un array**, no por shell, así que
**no hay inyección de comandos** — eso es el estado actual, no un logro de este
change. Lo que falta y este change agrega es la **validación** del slug antes de que
se convierta en argumento, replicando `isSafeSlug` (`src/tokens/packet.js:33`), que ya
guarda sus 4 call sites. Sin ella, un nombre de carpeta malformado se convierte en un
nombre de branch arbitrario. Cierra parcialmente la inconsistencia de validación entre
módulos que el Ciclo G documenta.
*Nota al reviewer sobre `security.triggers`:* se propone `[]`. El change no toca
autenticación, autorización, datos de usuario, secretos ni dependencias; agrega una
validación de entrada. Declarar un trigger distorsionaría la clasificación del gate.
**SEC-2:** **Nada se persiste.** `src/github/` es estado en vivo por diseño
(`system.md`), y este change **refuerza** esa restricción: la alternativa descartada
—registrada en el draft de ADR— era guardar la referencia al PR en el change folder.
El change modifica *qué branch* se consulta, no *qué* se consulta ni *quién* puede: no
agrega llamadas de red de un tipo nuevo, ni permisos, ni exposición de datos. El
`--json` de `status` no cambia de forma.

## Constraints and non-goals

- **No-goal:** tocar `localGitState` ni el corto-circuito de árbol sucio (decisión
  cerrada; ver EC-3).
- **No-goal:** tocar `DELIVERY_NEXT` ni el mapeo lifecycle→next de
  `src/lifecycle/engine.js`. El motor puro no cambia.
- **No-goal:** persistir la referencia al PR o cualquier estado de delivery — violaría
  `system.md`.
- **No-goal:** implementar el harness del adapter `cli`. Se documenta el criterio de
  exclusión (draft de ADR); implementarlo es un change propio, con el disparador que
  ese ADR define.
- **No-goal:** los otros follow-ups de la §11 del plan (distribución, path handling,
  warning del packet).
- **Constraint:** el camino sin `slug` queda byte-idéntico; los 20 tests actuales de
  `delivery.test.js` no se modifican.
- *Nota al reviewer sobre `impact.public_contract: false`:* la superficie **documentada**
  del CLI no cambia — ningún comando nuevo, ninguna flag, ninguna forma de `--json`
  distinta. Cambia el **valor** computado de un campo existente, que es justamente el
  bug. Contraste con `cli-detect-siblings`, que declaró `true` porque **agregaba un
  comando**. Hay una ambigüedad de fondo acá (en este repo "contrato público" puede
  significar la superficie del CLI o una API HTTP, y el paso 2 de `sdd-design` de
  ADR-030 asume lo segundo); está registrada en la §12 del plan de wiring-gaps y **no
  es de este change**. Si lo corregís a `true`, `sdd-design` va a evaluar el paso de
  authoring del contrato canónico, que no aplica: `capabilities.http: false` y no hay
  endpoints.
- *Nota al reviewer sobre `runtime_relevant_capabilities: []`:* **quinto ciclo
  consecutivo**, pero por primera vez con un criterio escrito en vez de una
  justificación ad hoc — ver `adr-cli-adapter-exclusion-criterion.md`. La diferencia
  con los 4 anteriores importa: aquéllos no tocaban `src/` en absoluto, así que "no hay
  superficie de runtime" era literalmente cierto. Este **sí** modifica comportamiento
  observable del CLI, así que el ADR exige que el `runtime-gate-report.md` registre
  **evidencia conductual real** (la invocación, antes y después) aunque el adapter
  quede `not_applicable`. Exclusión no es exención de evidencia.

## Open technical decisions

<!-- Empty if none. -->

Ninguna. Las dos decisiones abiertas del ciclo (qué pasa con el árbol sucio; qué hacer
con el adapter `cli` que bloquea) se cerraron en `sdd-enrich-us` y están registradas
en los dos drafts de ADR con sus alternativas descartadas.
