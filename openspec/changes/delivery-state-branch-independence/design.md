---
schema: design
schema_version: 1
change_id: delivery-state-branch-independence
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
security:
  risk: standard              # heredado del proposal; no se baja
  threat_model_required: false
  controls: [SEC-001, SEC-002]
---
# Technical design — Delivery independiente de la branch actual

> Mapeo de IDs: `SEC-001` = proposal `SEC-1` (validación del slug antes de que sea
> argumento de `gh`); `SEC-002` = proposal `SEC-2` (nada se persiste).

## Approach

A diferencia de los 4 ciclos anteriores, el entregable es **código**, no prosa. El
diseño es el delta exacto por archivo.

### 1. `src/github/index.js` — `resolveDelivery` acepta y prefiere el `slug`

Estado actual (líneas 30-44), con el bug en 42-43:

```js
export function resolveDelivery({ cwd, runGit, runGh } = {}) {
  const git = runGit || gitRunner(cwd);
  const gh = runGh || ghRunner(cwd);
  const local = localGitState(git);
  if (local === null) return { ... 'GIT_UNAVAILABLE' };
  if (local === 'uncommitted') return { ... state: 'uncommitted' };
  const ctx = githubContext(gh);
  if (!ctx.available) return { ... 'GITHUB_CONTEXT_UNAVAILABLE' };
  const branch = currentBranch(git);        // ← el bug
  const pr = prForBranch(branch, gh);
```

Delta propuesto:

```js
export function resolveDelivery({ cwd, runGit, runGh, slug } = {}) {
  // Input check first: no runner is touched, so an invalid slug never reaches
  // git or gh (SEC-001 / EC-1).
  if (slug !== undefined && !isSafeBranchSlug(slug)) {
    return { provider: 'github', state: 'unknown', blocked_reason: 'INVALID_CHANGE_SLUG' };
  }
  const git = runGit || gitRunner(cwd);
  const gh = runGh || ghRunner(cwd);
  const local = localGitState(git);
  if (local === null) return { ... 'GIT_UNAVAILABLE' };
  if (local === 'uncommitted') return { ... state: 'uncommitted' };   // sin cambios
  const ctx = githubContext(gh);
  if (!ctx.available) return { ... 'GITHUB_CONTEXT_UNAVAILABLE' };
  // A change's delivery is resolved from ITS branch (the change-id), not from
  // whatever is checked out. See ADR (delivery-resolves-by-change-branch).
  const branch = slug || currentBranch(git);
  const pr = prForBranch(branch, gh);
  ...                                        // resto idéntico, incl. checksState(branch, gh)
```

Tres puntos que el orden hace importantes:

- **La validación va primero, antes de cualquier runner.** Si fuera después del
  `githubContext(gh)`, el chequeo de auth ya habría invocado `gh` y EC-1 ("sin invocar
  `gh`") sería falso. Es la razón del orden, no una preferencia estética.
- **`branch` se usa también para `checksState(branch, gh)`** (línea 47), así que los
  checks de CI se leen del PR correcto sin ningún cambio adicional.
- **El comentario de cabecera del módulo** (líneas 5-14) documenta el mapeo
  estado→reason; hay que sumarle `INVALID_CHANGE_SLUG`.

`isSafeBranchSlug` se agrega **local a `src/github/`**: mismo criterio que `isSafeSlug`
(`src/tokens/packet.js:33`) — string no vacío, distinto de `.` y `..`, sin `/` ni `\`.
Ver Trade-offs sobre por qué se duplica en vez de extraerse.

### 2. `src/github/index.js` — falla cerrada, no excepción

`isSafeSlug` en `packet.js` **lanza** (`throw new Error('Invalid change slug')`). Acá
**no**: `resolveDelivery` nunca lanza, devuelve un estado. Se devuelve
`unknown` + `INVALID_CHANGE_SLUG`, consistente con `GIT_UNAVAILABLE` y
`GITHUB_CONTEXT_UNAVAILABLE`, y con el principio documentado del módulo de agregación:
*"Any uncertainty … pulls the aggregate down to `unknown`, never up to `merged`"*
(`src/repos/delivery.js:8-10`). Como `unknown` es el primer bucket de `PRECEDENCE`, un
slug inválido arrastra el agregado multi-repo hacia abajo — que es el comportamiento
correcto.

### 3. `src/repos/delivery.js` — propagar el `slug` a los dos call sites

`resolveMultiRepoDelivery` ya recibe `slug` (línea 64) y lo usa sólo para
`readImpactedRepos`. Hay **dos** llamadas a `resolveOne` que hay que corregir:

```js
// línea 70, camino single-repo
const hub = resolveOne({ cwd, slug });

// línea 81, fan-out por repo impactado
const resolved = resolveOne({ cwd: target.path, slug });
```

El mismo `slug` sirve para los repos hermanos: la convención change-id = nombre de
branch aplica en todos (`prepare-repos` crea la branch del change en cada repo
impactado). Nada más de este archivo cambia.

### 4. `test/delivery.test.js` — helper aditivo + 4 tests

El `fakeGh` actual ignora **qué** branch se pide: `pr view` devuelve `pr` sin mirar el
argumento. Se agrega una opción **aditiva** `prByBranch`, así los 20 tests existentes
—que usan `pr`— no se tocan (AC-2, AC-5):

```js
function fakeGh({ authed = true, pr = null, checks = 'none', prByBranch = null } = {}) {
  ...
  if (cmd.startsWith('pr view')) {
    const branch = args[2];                       // ['pr','view',<branch>,'--json',…]
    if (prByBranch) {
      const found = prByBranch[branch];
      if (!found) throw new Error('no pull request');
      return JSON.stringify(found);
    }
    if (!pr) throw new Error('no pull request');   // camino legacy, intacto
    return JSON.stringify(pr);
  }
```

| Test | Cubre |
|---|---|
| `a merged change resolves as merged from any branch (AC-1, AC-4)` | `branch: 'main'` + `prByBranch: {'my-change': MERGED}`. **Sin** slug → `committed` (fija el comportamiento actual); **con** slug → `merged`. **La segunda aserción falla contra el código actual** |
| `no slug falls back to the current branch (AC-2, EC-4)` | mismo fake, sin slug, branch con PR propio → estado del PR de esa branch |
| `resolveMultiRepoDelivery forwards the slug to resolveOne (AC-3)` | `resolveOne` espía que registra sus `opts`; se asserta `slug` presente en el camino single-repo **y** en el fan-out por repo |
| `an invalid slug fails closed to unknown without invoking gh (AC-6, EC-1)` | slug `'../evil'` → `unknown` + `INVALID_CHANGE_SLUG`, y el contador de invocaciones de `gh` queda en **0** |

### 5. `openspec/specs/playbooks/spec.md` — criterio de exclusión del adapter `cli`

Sección nueva con la regla del ADR correspondiente: en este repo `cli` se excluye
porque su harness no está implementado; **exclusión no es exención de evidencia** — un
change que toque comportamiento observable del CLI debe (a) tener al menos un test que
falle contra el código previo y (b) registrar la invocación real, antes y después, en
su `runtime-gate-report.md`. Más el disparador que revertiría la decisión.

Va en la feature y **no** en el archive porque es lo que hace legítima la declaración
`runtime_relevant_capabilities: []` de **este mismo** change: el `sdd-runtime-gate` de
este ciclo tiene que poder citar el criterio ya escrito. Es la excepción al patrón de
los ciclos anteriores, donde la spec se actualizaba en el archive.

## Module impact

| Archivo | Delta | Capa |
|---|---|---|
| `src/github/index.js` | `slug` opcional, validación temprana, `slug \|\| currentBranch`, `isSafeBranchSlug` local, comentario de cabecera | `src/github/` (estado de delivery en vivo) |
| `src/repos/delivery.js` | 2 líneas: propagar `slug` a `resolveOne` | `src/repos/` (multi-repo) |
| `test/delivery.test.js` | `prByBranch` aditivo + 4 tests | tests |
| `openspec/specs/playbooks/spec.md` | criterio de exclusión del adapter `cli` | spec permanente |
| `openspec/changes/.../adr-*.md` | 2 drafts (ya creados) | decisiones |

**Sin delta:** `src/lifecycle/` — el motor sigue PURO y no se toca: `DELIVERY_NEXT`,
`computeNext` y `LIFECYCLE_NEXT` quedan idénticos. `src/github/repository.js`
(`localGitState`, `currentBranch`, `prForBranch`, `checksState` sin cambios de firma).
`schemas/` (los `blocked_reason` no están enumerados en ningún schema — verificado).
`skills/`, `src/cli/status.js` (ya pasa el slug).

Respeta la tabla de capas de [doc_architecture.md](docs/doc_architecture.md):
`src/github/` hace "delivery en vivo" y `src/lifecycle/` sigue siendo motor puro sin
fs/red. No se cruza ningún límite.

## Trade-offs

- **`isSafeBranchSlug` local vs. extraer a `src/util/slug.js`.** Extraerlo y que
  `packet.js` lo use es el mejor código —una sola definición— pero obliga a tocar
  `src/tokens/packet.js`, fuera de los `## Impacted modules` declarados en un proposal
  ya aprobado. Elegido: **duplicar ~6 líneas**, y registrar la unificación como
  follow-up del **Ciclo G** de la §11 del plan, que ya es exactamente sobre la
  validación inconsistente entre módulos. Costo aceptado y nombrado, no ignorado.
- **Falla cerrada a `unknown` vs. lanzar como `packet.js`.** Elegido `unknown`: el
  contrato del módulo es "nunca lanza, devuelve un estado", y `status` no debe
  explotar por un nombre de carpeta raro. Costo: dos módulos validan lo mismo con
  reacciones distintas, lo que hay que explicar (está en §2 del Approach).
- **La spec se actualiza en la feature, no en el archive.** Rompe el patrón de los 4
  ciclos anteriores. Motivo concreto: el `sdd-runtime-gate` de este ciclo necesita
  citar el criterio, y no puede citar algo que se va a escribir después.
- **Validación antes de todo vs. después del chequeo de git.** Antes: un slug inválido
  en un directorio que no es git reporta `INVALID_CHANGE_SLUG` en vez de
  `GIT_UNAVAILABLE`. Aceptado: es un error de input y reportarlo primero es más útil,
  y es la única forma de que EC-1 ("sin invocar `gh`") sea literalmente cierto.
- **`slug || currentBranch` vs. `slug ?? currentBranch`.** `||` trata `''` como
  ausente; pero `''` ya lo rechaza la validación (`slug !== undefined` + string no
  vacío), así que son equivalentes acá. Se usa `||` por consistencia con el estilo del
  archivo.

## Public contracts / interfaces

- **La superficie del CLI no cambia.** Ningún comando, flag ni forma de `--json`
  nueva. Lo que cambia es el **valor** computado de `delivery.state` para un change
  dado — que es el bug. Por eso `impact.public_contract: false` (ver la nota al
  reviewer en el proposal, y la §12 del plan sobre la ambigüedad del término).
- **`resolveDelivery` es interna** (`src/github/`), no una API publicada. Su firma
  crece con un parámetro **opcional**: todo caller existente sigue compilando y
  comportándose igual (AC-2). El único caller productivo es `src/repos/delivery.js`.
- **Un `blocked_reason` nuevo**: `INVALID_CHANGE_SLUG`. Aparece en el texto de
  `playbook status` y en su `--json`; no hay enum ni schema que lo restrinja
  (verificado), así que es aditivo.
- **Paso 2 de `sdd-design` (contrato canónico): no aplica.** `impact.public_contract:
  false`, así que la instrucción indica no tocar el contrato, y no se toca:
  `openspec/specs/contracts/openapi.yaml` sigue en `paths: {}`. `contract.path_in_loom`
  **sí** está configurado en este repo, así que la guarda que decidió fue el flag del
  proposal, no la ausencia de config.

## Data model changes

Ninguno. No se agrega, quita ni modifica artefacto ni schema. El `slug` es un
**parámetro de entrada**, no estado almacenado: se sigue derivando el delivery en cada
llamada. Eso preserva la restricción de `system.md` para `src/github/` ("Live delivery
state (git + `gh`), **never persisted**") y es explícitamente lo que descarta la
alternativa de guardar el número de PR en el change folder.

## Security controls (+ threat model when required)

`risk: standard` heredado, **no se baja**. Tampoco sube: no hay superficie de ataque
nueva. `threat_model_required: false`.

- **SEC-001 — el slug se valida antes de ser argumento de `gh`.** Estado de partida
  honesto: **hoy ya no hay inyección de comandos** porque los argumentos viajan como
  elementos de un array a `execFileSync`-style runners, sin shell — eso no es un logro
  de este change. Lo que falta y se agrega es la validación: sin ella, un nombre de
  carpeta arbitrario se convierte en nombre de branch y en argumento de `gh`.
  **Test negativo (primero, por ser tarea ligada a un `SEC-N`):** con `slug: '../evil'`,
  el contador de invocaciones del runner de `gh` debe quedar en **0** y el resultado
  ser `unknown` + `INVALID_CHANGE_SLUG`. El test negativo no es decorativo acá: si la
  validación quedara después del `githubContext(gh)`, el contador daría 1 y el test
  fallaría.
- **SEC-002 — nada se persiste.** El change **refuerza** la restricción:
  la alternativa descartada (registrada en el ADR) era guardar la referencia al PR.
  Sin input externo nuevo, sin permisos, sin datos sensibles, sin llamadas de red de
  un tipo nuevo — cambia *qué branch* se consulta, no *qué* ni *quién*.
- **Riesgo residual aceptado (EC-3, en el ADR):** árbol sucio + `runtime_cleared` + PR
  mergeado sigue reportando `uncommitted`. No es un riesgo de seguridad; es un hueco
  de correctitud aceptado con su razón (rompe un test fijado y degrada el uso offline).
  Va al checklist de seguridad en el archive como riesgo aceptado, junto con el del
  segundo ADR.
- **Riesgo residual:** un slug que nombre la branch de **otro** change reportaría el
  delivery de ese otro. Requiere renombrar un change folder a mano; el slug sale del
  nombre de carpeta que el motor ya lee, así que no pueden divergir solos.

## Testing strategy

- **Unitarios (4 tests nuevos, `test/delivery.test.js`)** — cubren AC-1..AC-4, AC-6,
  EC-1, EC-4. **El de AC-4 falla contra el código actual**: es el gate real de este
  ciclo y la diferencia sustantiva con los 4 anteriores, donde el gate era una
  aserción de contenido sobre un prompt. Acá se prueba **comportamiento**.
- **No-regresión (AC-2, AC-5)** — los 20 tests existentes de `delivery.test.js` deben
  pasar **sin modificarse**; el helper `prByBranch` es aditivo justamente para eso. El
  test de árbol sucio (`:51`) es el que fija la decisión 3 del proposal.
- **Regresión completa** — `npm test` (referencia: 352 verdes en `main`; con 4 nuevos,
  356) y `playbook validate --ci` exit 0.
- **Evidencia conductual del CLI (exigida por el ADR del adapter `cli`)** — correr
  `playbook status` desde `main` y desde la branch del change, **antes y después** del
  fix, y registrar las 4 salidas en el `runtime-gate-report.md`. El adapter queda
  `not_applicable`, pero la evidencia no se omite. Es reproducir a mano el bug que
  motivó el ciclo y demostrar que se cerró.
- **Límite honesto:** esa evidencia conductual es una captura puntual, **no** una
  suite de regresión — no se re-corre en cada change futuro. Lo que sí se re-corre es
  el test de AC-4, vía `npm test` y CI. El ADR lo dice explícitamente para que nadie
  lea la evidencia como cobertura continua.

---

**Para el tech lead:** revisar sobre todo (a) el **orden** de la validación del slug
—antes de todo runner— porque es lo que hace verdadero a EC-1; (b) la decisión de
**duplicar** `isSafeBranchSlug` en vez de extraerla, con la unificación diferida al
Ciclo G; y (c) que la spec se actualice en la feature y no en el archive. Un humano
pone `status: approved`.
