---
schema: runtime-gate-report
schema_version: 1
change_id: delivery-state-branch-independence
status: not_applicable
updated: 2026-07-24
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Delivery independiente de la branch actual

Contexto: `context-packet.md` (coherente con las fuentes vivas) +
`playbook changed-files delivery-state-branch-independence --diff`.

**Este es el primer runtime gate que corre bajo el criterio nuevo de exclusión del
adapter `cli`** (`openspec/specs/playbooks/spec.md`, sección agregada por este mismo
change; ADR draft `cli-adapter-exclusion-criterion`). El adapter queda
`not_applicable`, pero **la evidencia conductual no es opcional** — está abajo.

## Selección de adapters — computada por el motor

`planRuntimeAdapters(config.capabilities, [])` con
`runtime_relevant_capabilities: []` del proposal:

```
browser: not_applicable          (capabilities.browser: false)
http:    not_applicable          (capabilities.http: false)
cli:     not_applicable          (NOT_RELEVANT_TO_CHANGE)
worker:  not_applicable          (capabilities.worker: false)
gateStatusFromAdapters(plan) → not_applicable
```

El `status` del gate es el agregado que devuelve el motor. No se fabricó ningún
`passed`.

## Evidencia conductual del CLI — exigida por el criterio, no omitida

El change modifica comportamiento observable de `playbook status`/`next`, así que el
criterio obliga a registrar la invocación real **antes y después**. Reproducción
end-to-end:

**Escenario.** Worktree en `a8335ae~1` (= `5232889`), el commit **anterior** al archive
de `token-saving-parity`, así que su change folder todavía existe y su PR
([#9](https://github.com/lablab-outplacement/lablab-playbook-ai-v2/pull/9)) ya está
**mergeado**. Branch checkouteada: `evidence-tmp` — **no** la branch del change, que es
exactamente la condición del bug. Árbol **limpio** (necesario: `localGitState`
corta a `uncommitted` antes de consultar GitHub). Mismo `--cwd` en las dos corridas;
lo único que cambia es qué `bin/playbook.js` se ejecuta.

```
############ ANTES — código pre-fix (bin del worktree) ############
Change: token-saving-parity
Lifecycle: runtime_cleared (design_required: false)
GitHub delivery: committed
Per-repo: loom=committed
  next: Next skill: sdd-commit (push and open the pull request)

############ DESPUÉS — código post-fix (bin actual, mismo --cwd) ############
Change: token-saving-parity
Lifecycle: runtime_cleared (design_required: false)
GitHub delivery: merged
Per-repo: loom=merged
  next: Next skill: sdd-verify
```

| | delivery | `playbook next` |
|---|---|---|
| **Antes** | `committed` | `sdd-commit (push and open the pull request)` ❌ para un change ya mergeado |
| **Después** | `merged` | `sdd-verify` ✅ |

Es el bug del proposal reproducido textualmente —el CLI aconsejando re-abrir un PR
mergeado— y cerrado. `lifecycle` es idéntico en ambas corridas (`runtime_cleared`), lo
que confirma que el motor puro no se tocó y que la diferencia está **sólo** en la
dimensión de delivery.

**Evidencia complementaria a nivel de módulo** (capturada en `sdd-apply`, Tasks 1.1 y
4.1, sobre un worktree limpio en `main` con el slug de un change mergeado):

```
PRE-FIX    sin slug -> committed     slug: token-saving-parity -> committed   ← el bug
POST-FIX   sin slug -> committed     slug: token-saving-parity -> merged      ← corregido
```

El camino sin slug no cambió en ninguna de las dos capturas: el fix no altera el
comportamiento legacy (AC-2).

**Limpieza:** los dos worktrees temporales y la branch `evidence-tmp` fueron
eliminados; `git worktree list` → 1 (el principal).

**Límite explícito de esta evidencia**, como manda el criterio: es una **captura
puntual, no una suite de regresión**. No se re-corre en changes futuros. Lo que sí se
re-corre por `npm test` y CI es el test unitario que **falla contra el código previo**
(`a merged change resolves as merged from any branch (AC-1, AC-4)`) — ése es el gate
sustantivo; esta captura lo corrobora.

## browser — not_applicable

- **Evidence**: `capabilities.browser: false`. Sin UI web. No se invocó Playwright MCP
  y no correspondía: ausencia de capability es `not_applicable`, no
  `DEPENDENCY_UNAVAILABLE`.
- **Findings**: ninguno.

## http — not_applicable

- **Evidence**: `capabilities.http: false`. Sin superficie HTTP/REST. El change consulta
  GitHub vía `gh`, que es un proceso hijo, no una superficie HTTP propia del proyecto.
- **Findings**: ninguno.

## cli — not_applicable (`NOT_RELEVANT_TO_CHANGE`)

- **Evidence**: `capabilities.cli: true`, excluido vía
  `runtime_relevant_capabilities: []`, así que el motor lo marca `not_applicable`
  **antes** de la rama experimental — de ahí que no sea
  `blocked: ADAPTER_NOT_IMPLEMENTED`.
  **A diferencia de los 4 ciclos anteriores, la exclusión acá no se apoya en "no hay
  superficie de CLI que ejercitar" — eso sería falso: este change modifica
  comportamiento observable del CLI.** Se apoya en el criterio recién escrito: el
  harness no existe, y en su lugar se exigen (a) un test que falle contra el código
  previo —presente, `AC-4`— y (b) la invocación real registrada arriba. Las dos
  condiciones están cumplidas y verificables.
- **Findings**: ninguno.

## worker — not_applicable

- **Evidence**: `capabilities.worker: false`. Sin workers ni colas.
- **Findings**: ninguno.

## Resto de la evidencia del change

| Qué | Dónde | Resultado |
|---|---|---|
| AC-1..AC-6, EC-1, EC-4 | `test/delivery.test.js` (5 tests nuevos) | verdes |
| El test que falla contra el código previo (AC-4) | mismo archivo | verificado en el rojo de TDD: 21 pass / **4 fail** |
| Los 20 tests preexistentes sin modificar (AC-2, AC-5) | mismo archivo | verdes |
| Sin regresión | `npm test` | **357 pass / 0 fail** |
| Sin drift | `npm run generate:check` | limpio |
| Artefactos | `playbook validate --ci` | exit 0 |

## Observación fuera de scope

**El criterio de exclusión funcionó como control en su primera aplicación.** Sin él,
este change habría declarado `runtime_relevant_capabilities: []` como los 4 anteriores
y no habría producido ninguna evidencia conductual — y la reproducción end-to-end del
bug (la tabla antes/después de arriba) es justamente lo que ningún test unitario podía
mostrar. Vale registrarlo en el archive: el valor del criterio no fue documentar la
exclusión, fue **obligar a producir la evidencia que la exclusión antes dispensaba**.
