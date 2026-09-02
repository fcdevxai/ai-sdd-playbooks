---
schema: tasks
schema_version: 1
change_id: runtime-gate-worker-supported
status: passed
updated: 2026-09-01
---
# Tasks — Adapter `worker` de sdd-runtime-gate: de experimental a supported

## Rules

- Every task must have a verifiable success criterion; never mix unrelated layers
  in one task if it makes verification non-atomic.
- Do not plan changes to files outside `## Constraints and non-goals`.
- State inter-task dependencies explicitly.
- Any task implementing a `## Security considerations` entry (`SEC-N`) must name
  its negative test (e.g. "unauthorized access is rejected") as part of its
  success criterion, not only the happy path.
- The `Regression` entry in the quality-gates phase is mandatory, not
  conditional on risk: it is the exact line `playbook packet` extracts to
  carry the regression command to every gate that reads the packet. Omitting
  it does not skip regression — it silently drops the command before the
  gates ever see it.

## Preconditions (self-check)

`proposal.status == approved` (sí) y `design.status ∈ {approved,
not_applicable}` — `design.status == approved` (sí). Confirmado por
`playbook validate --precondition sdd-plan`.

## Phase 1 — Descriptor y contrato de las funciones puras

### [x] Task 1.1 — `worker` deja de ser experimental en el descriptor, con test rojo primero
- **Files**: `test/adapters.test.js`, `src/adapters/worker.js`
- **Pasos**: (1) en `test/adapters.test.js`, cambiar el título/aserciones de la
  línea 5 para que solo afirmen `cli` experimental (quitar
  `ADAPTERS.worker.support === 'experimental'`); agregar un test nuevo
  `planRuntimeAdapters({ worker: true, cli: false })` → `{ status: 'pending'
  }`, que debe fallar contra el código actual de `src/adapters/worker.js`.
  Ajustar el test de la línea 21 (`experimental adapter... → blocked`) para
  que solo ejercite `cli`. (2) Solo después de confirmar el rojo, editar
  `src/adapters/worker.js`: `support: 'experimental'` → `'supported'`, y
  ampliar `validates` a: `'real job trigger'`, `'real consumer processing'`,
  `'observable side effect'`, `'retry/dead-letter path'`,
  `'idempotency (when relevant)'`.
- **Success criterion**: `node --test test/adapters.test.js` en rojo antes del
  paso 2, en verde después. `ADAPTERS.cli.support === 'experimental'` no
  cambia (AC-6).
- **Linked acceptance criterion**: AC-1, AC-2, AC-5, AC-6.

## Phase 2 — Texto canónico del adapter (la autoridad real de comportamiento)

**Depende de Task 1.1** (el descriptor y el texto deben decir lo mismo).

### [x] Task 2.1 — Test de contenido (positivo + negativo) antes de tocar `canonical.md`
- **Files**: `test/skill-contract.test.js`
- **Pasos**: agregar un test que, sobre `body('sdd-runtime-gate')`
  (`SKILL.md` generado): (a) **positivo** — contiene una sección `worker` con
  las palabras clave del checklist (disparo/trigger real, procesamiento real
  del consumer, efecto secundario observable, camino de reintento/dead-letter,
  y la regla de seguridad: nunca disparar un efecto externo irreversible
  real); (b) **negativo** — el texto ya **no** contiene ninguna frase que
  clasifique `worker` como adapter experimental ni le asigne
  `ADAPTER_NOT_IMPLEMENTED` (buscar que esa cadena, cuando aparece, esté
  asociada solo a `cli`).
- **Success criterion**: el test falla (rojo) contra el `SKILL.md` actual —
  confirma que hoy el texto sí clasifica `worker` como experimental.
- **Linked acceptance criterion**: AC-4 (preparación).

### [x] Task 2.2 — Reescribir `skills/sdd-runtime-gate/canonical.md`
- **Files**: `skills/sdd-runtime-gate/canonical.md`
- **Pasos**, las 4 ediciones deben ir juntas en el mismo commit lógico (ver
  `design.md` §Approach — orden de render pone `## Rules` antes de la tabla,
  así que una edición parcial deja el texto contradictorio y el test de la
  Task 2.1 en falso-verde):
  1. `## Rules` — "Experimental adapters (`cli`, `worker`) block…" → solo `cli`.
  2. Tabla de `## Adapter selection` — la fila "experimental (`cli`, `worker`)"
     → solo `cli`.
  3. `### cli / worker (experimental)` se separa en dos secciones:
     `### worker (supported)` — nueva, con el checklist de 7 puntos (disparo
     real, procesamiento real, efecto secundario observable, camino de
     reintento/dead-letter, idempotencia condicional, **regla de
     seguridad SEC-001**, evidencia citando `AC-N`) y sus criterios de
     `failed` (job perdido en silencio, efecto ausente/incorrecto, política de
     reintento no respetada, o un efecto externo irreversible disparado de
     verdad); y `### cli (experimental)` — el texto actual, sin cambio
     semántico.
  4. `## Runtime tool dependency` — agregar que `worker` no depende de ninguna
     MCP/herramienta declarada: la ausencia de una herramienta específica no
     es, por sí sola, `DEPENDENCY_UNAVAILABLE` para este adapter (solo lo es
     la ausencia real de forma de disparar/observar el worker del proyecto).
- **Success criterion**: revisión manual de que las 4 ediciones están
  presentes; verificado mecánicamente en la Task 2.3.
- **Linked acceptance criterion**: AC-3 (parcial), AC-4.

### [x] Task 2.3 — Regenerar y confirmar verde
- **Files**: `skills/sdd-runtime-gate/SKILL.md` (generado, no editar a mano)
- **Pasos**: `npm run generate`; `npm run generate:check` (sin drift);
  `node --test test/skill-contract.test.js` (verde, incluida la Task 2.1).
- **Success criterion**: los tres comandos anteriores en verde.
- **Linked acceptance criterion**: AC-4.

## Phase 3 — Coherencia de artefactos dependientes (AC-8)

**Independiente de las Phases 1-2** — puede hacerse en paralelo, pero se lista
después para mantener la Regla de "no mezclar capas": esta fase es
documentación/plantillas, no comportamiento del adapter.

### [x] Task 3.1 — Test de propagación, antes de tocar los archivos
- **Files**: `test/worker-adapter-propagation.test.js` (nuevo)
- **Pasos**: escribir un test que lea `README.md`,
  `templates/project/playbook.config.yaml`, y `body('sdd-bootstrap-project')`
  (`SKILL.md` generado), y falle si alguno todavía asocia `worker` con
  "experimental" en el mismo comentario/oración.
- **Success criterion**: el test falla (rojo) contra el contenido actual de
  los 3 archivos.
- **Linked acceptance criterion**: AC-8 (preparación).

### [x] Task 3.2 — Actualizar los 3 artefactos de propagación
- **Files**: `README.md`, `templates/project/playbook.config.yaml`,
  `skills/sdd-bootstrap-project/canonical.md`
- **Pasos**: `README.md:133` — comentario `worker: false # experimental
  adapter` → reflejar que `worker` es `supported`.
  `templates/project/playbook.config.yaml:12` — comentario `(adapter
  experimental)` en la línea de `worker` → actualizar (queda igual para
  `cli`, sin tocar esa línea).
  `skills/sdd-bootstrap-project/canonical.md:46` — "`cli`/`worker` are
  experimental adapters that block when enabled" → "`cli` is an experimental
  adapter that blocks when enabled; `worker` is supported".
- **Success criterion**: cambios hechos; verificados en la Task 3.3.
- **Linked acceptance criterion**: AC-8.

### [x] Task 3.3 — Regenerar `sdd-bootstrap-project` y confirmar verde
- **Files**: `skills/sdd-bootstrap-project/SKILL.md` (generado)
- **Pasos**: `npm run generate`; `npm run generate:check` (sin drift);
  `node --test test/worker-adapter-propagation.test.js` (verde).
- **Success criterion**: los tres comandos en verde.
- **Linked acceptance criterion**: AC-8.

## Notas de trazabilidad

- **AC-7** (draft de ADR con la decisión y sus alternativas) ya está
  satisfecho por `adr-worker-adapter-no-declared-dependency.md`, escrito en
  `sdd-new` — ninguna tarea de esta fase lo toca.
- **AC-6** (cero cambios de comportamiento en `cli`) se verifica por omisión:
  ninguna task de esta lista toca `src/adapters/cli.js`,
  `openspec/specs/adr/ADR-032-*.md`, ni la sección `cli` de
  `canonical.md`/`SKILL.md` salvo para separarla textualmente (Task 2.2,
  "sin cambio semántico") — la regresión completa de la Phase de gates lo
  confirma.

## Phase 4 — Quality gates

- **Format**: (sin formatter configurado todavía)
- **Lint/type-check**: `node --check src/adapters/worker.js && node --check test/adapters.test.js && node --check test/skill-contract.test.js && node --check test/worker-adapter-propagation.test.js`
- **Feature tests**: `node --test test/adapters.test.js test/skill-contract.test.js test/worker-adapter-propagation.test.js`
- **Regression**: `npm test`

## Execution Report

### Verified acceptance criteria

| AC | Evidence |
|---|---|
| AC-1 | `src/adapters/worker.js` now reports `support: 'supported'`; covered by `test/adapters.test.js`. |
| AC-2 | `planRuntimeAdapters({ worker: true, cli: false })` returns `worker: { status: 'pending' }`; red first in `.specloom/runs/1788305427342-3faaf9ba/full.log`, green in `.specloom/runs/1788305445401-56b13afa/full.log`. |
| AC-3 | `skills/sdd-runtime-gate/canonical.md` now documents `worker (supported)` with real evidence outcomes for `passed`/`failed`/`blocked`; generated skill verified by `test/skill-contract.test.js`. |
| AC-4 | Runtime-gate canonical text includes the worker checklist, `SEC-001`, failed/blocked criteria, and generated `SKILL.md` has no drift; verified by `npm run generate`, `npm run generate:check`, and `test/skill-contract.test.js`. |
| AC-5 | `test/adapters.test.js` updated from the old worker-experimental expectation and includes the new worker pending test that failed before the descriptor change. |
| AC-6 | `ADAPTERS.cli.support === 'experimental'` remains covered; `src/adapters/cli.js` was not touched. |
| AC-7 | Existing ADR draft `openspec/changes/runtime-gate-worker-supported/adr-worker-adapter-no-declared-dependency.md` remains in place and was not modified. |
| AC-8 | README, project config template, bootstrap canonical text, and generated bootstrap skill no longer classify worker as experimental; red first in `.specloom/runs/1788305612208-efe43588/full.log`, green in `.specloom/runs/1788305675950-c2732477/full.log`. |

### Commands run

| Command | Result |
|---|---|
| `playbook validate --precondition sdd-apply` | passed |
| `playbook run --change runtime-gate-worker-supported --step apply -- node --test test/adapters.test.js` | failed before code change, then passed (`.specloom/runs/1788305445401-56b13afa/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- node --test test/skill-contract.test.js` | failed before canonical change, then passed (`.specloom/runs/1788305580041-7d6825e4/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- npm run generate` | passed (`.specloom/runs/1788305541252-299305d1/full.log`, `.specloom/runs/1788305636323-def3f818/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- npm run generate:check` | passed (`.specloom/runs/1788305550424-e94456b4/full.log`, `.specloom/runs/1788305646586-2e7b0dbe/full.log`, `.specloom/runs/1788305731851-5f79eece/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- node --test test/worker-adapter-propagation.test.js` | failed before propagation edits, then passed (`.specloom/runs/1788305675950-c2732477/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- bash -lc 'node --check src/adapters/worker.js && node --check test/adapters.test.js && node --check test/skill-contract.test.js && node --check test/worker-adapter-propagation.test.js'` | passed (`.specloom/runs/1788305712986-ddc70b22/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- node --test test/adapters.test.js test/skill-contract.test.js test/worker-adapter-propagation.test.js` | passed (`.specloom/runs/1788305722601-fcd7c3fa/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- npm test` | passed (`.specloom/runs/1788305744841-dd7860f3/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- playbook packet runtime-gate-worker-supported` | passed; refreshed derived `context-packet.md` after the execution report (`.specloom/runs/1788305817620-5eec1a2e/full.log`) |
| `playbook run --change runtime-gate-worker-supported --step apply -- playbook validate` | passed after packet refresh (`.specloom/runs/1788305826020-23b0e1e8/full.log`) |

### Result

All planned tasks are complete, all executable quality gates passed, and
`tasks.md` is marked `status: passed`.
