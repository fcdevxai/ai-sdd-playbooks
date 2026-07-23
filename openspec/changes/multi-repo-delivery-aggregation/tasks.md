---
schema: tasks
schema_version: 1
change_id: multi-repo-delivery-aggregation
status: passed
updated: 2026-07-23
---
# Tasks — Delivery multi-repo agregado

## Rules

- Cada task tiene un criterio de éxito verificable (test/check que pasa). No se
  mezclan capas si eso vuelve la verificación no-atómica.
- No se planifican cambios fuera de `## Constraints and non-goals` de la proposal.
- Dependencias entre tasks explícitas.
- Toda task que implementa un `SEC-N` nombra su **test negativo** como parte del
  criterio de éxito (no solo el happy path).

> **Refinamiento del seam de test (bajo el contrato público aprobado).** El diseño
> aprobado fija el retorno (`{ state, per_repo, blocked_reason? }`) y la tabla de
> reducción. Para poder inyectar un estado por-repo en tests (un `runGit(args)`
> plano no distingue repos porque los args no llevan el `cwd`), el resolver acepta
> un seam `resolveOne` — `({ cwd, runGit, runGh }) => { state, blocked_reason? }`,
> default `resolveDelivery` (reusado **verbatim**). Esto NO cambia el contrato
> público ni el motor; refina la nota "Inyección de runners" del design.

## Preconditions (self-check)

`proposal.status == approved` ✓ y `design.status == approved` ✓
(verificado con `playbook validate multi-repo-delivery-aggregation --precondition sdd-plan`).

## Phase 1 — Resolver de agregación (`src/repos/delivery.js`, TDD)

### Task 1.1 — [x] `reduceDelivery(perRepo)` — reducción pura "eslabón más débil"
- **Files**: `src/repos/delivery.js` (nuevo), `test/delivery.test.js` (extender)
- **Descripción**: helper puro exportado que toma la lista `per_repo`
  (`[{ repo, state, blocked_reason? }]`) y devuelve `{ state, blocked_reason? }`
  según la tabla de precedencia (filas 1–7 del design). `merged` solo si todos
  `merged`. `unknown`/`ci_failed` propagan `blocked_reason` con `@<primer repo culpable>`.
- **Success criterion**: tests (TDD, escritos primero) que cubren **cada fila**
  de la tabla: (1) algún `unknown` → `unknown` con `@repo`; (2) algún `ci_failed`
  → `ci_failed` con `@repo`; (3) algún `uncommitted`; (4) algún `committed`;
  (5) algún `pr_open`/`ci_pending` → `ci_pending`; (6) todos `ci_passed` y mezcla
  `ci_passed`+`merged` → `ci_passed` (**no** `merged`); (7) todos `merged` →
  `merged`. `node --test test/delivery.test.js` verde.
- **Linked acceptance criterion**: AC-2 (merged unánime), SEC-1 (negativo:
  `unknown` mezclado con `merged` → `unknown`, nunca `merged`).

### Task 1.2 — [x] `resolveMultiRepoDelivery({ cwd, changesDir?, resolveOne? })`
- **Files**: `src/repos/delivery.js`, `test/delivery.test.js`
- **Depende de**: Task 1.1.
- **Descripción**: (a) resuelve `readImpactedRepos(slug, changesDir)` para el
  change activo + `loadConfig`; (b) **early-return single-repo**: sin impacted
  repos → `{ state: resolveOne({ cwd }).state, per_repo: [hub] }`; (c) multi-repo:
  arma targets = hub (`cwd`, siempre) + cada impacted repo, resolviendo su path
  con `resolveConfiguredRepoPath` — si lanza, el target es `unknown` con
  `blocked_reason: 'REPO_PATH_UNRESOLVED @'+name` (**sin** llamar `resolveOne`);
  (d) para cada target con path llama `resolveOne({ cwd: path })`; (e)
  `reduceDelivery` sobre los estados. `resolveOne` default = `resolveDelivery`.
- **Success criterion**: tests con `resolveOne` fake keyed por `cwd` (un estado
  por repo): AC-1 (3 repos, solo hub `merged` → agregado ≠ `merged`); AC-3
  (`ci_failed` con repo nombrado); AC-4 (repo GitHub no disponible → `unknown`);
  AC-5 (sin impacted repos → agregado == `resolveDelivery({cwd}).state`, `per_repo`
  = solo hub); AC-6 (`per_repo` una entrada por repo, hub primero); EC-2 (hub
  no-git → `unknown`). `node --test test/delivery.test.js` verde.
- **Linked acceptance criterion**: AC-1, AC-3, AC-4, AC-5, AC-6, EC-2.

### Task 1.3 — [x] Fail-closed en path no resoluble (SEC-2 / EC-1)
- **Files**: `src/repos/delivery.js`, `test/delivery.test.js`
- **Depende de**: Task 1.2.
- **Descripción**: asegurar que un impacted repo ausente de `config.repos` (o sin
  `path`) produce `unknown`/`REPO_PATH_UNRESOLVED @repo` y contamina el agregado
  a `unknown`, sin construir paths a partir del nombre ni leer fuera del árbol
  configurado.
- **Success criterion**: **test negativo** — un nombre de impacted repo NO
  declarado en `config.repos` → target `unknown` con `REPO_PATH_UNRESOLVED @<repo>`,
  agregado `unknown`, y `resolveOne` **no** se invoca para ese repo (verificado
  con un `resolveOne` que registra sus llamadas). No hay acceso a filesystem fuera
  de lo declarado.
- **Linked acceptance criterion**: EC-1, SEC-2.

## Phase 2 — Cableado CLI (`src/cli/status.js`)

### Task 2.1 — [x] `prepare()` usa el agregado; `per_repo` en texto y `--json`
- **Files**: `src/cli/status.js`, `test/lifecycle-cli.test.js` (extender)
- **Depende de**: Fase 1.
- **Descripción**: `prepare()` reemplaza `resolveDelivery({ cwd })` por
  `resolveMultiRepoDelivery({ cwd })`; pasa `.state` a `computeState` (firma
  intacta) y adjunta `per_repo` a `result` para el render. `statusCommand`: en
  `--json` incluye `delivery.per_repo`; en texto imprime una línea de desglose
  (`Per-repo: <repo>=<state> · …`). `nextCommand` sin cambios de código.
- **Success criterion**: (a) test back-compat: un change single-repo (sin
  `## Impacted repos`) con repo git vacío → `delivery.state` y `next` idénticos al
  comportamiento actual (los tests existentes de `test/lifecycle-cli.test.js`
  siguen verdes = sin regresión, AC-5); (b) test nuevo: `status --json` sobre un
  change incluye `delivery.per_repo` array (AC-6). `node --test test/lifecycle-cli.test.js` verde.
- **Linked acceptance criterion**: AC-5 (no regresión), AC-6 (JSON).

## Phase 3 — Scaffolding de config + playbooks

### Task 3.1 — [x] `repos:`/`gating:` comentados en el template de config
- **Files**: `templates/project/playbook.config.yaml`
- **Descripción**: agregar secciones **comentadas** con placeholders: `repos:`
  (nombre → `path`, `role: sdd|impacted`, `verification:`) y
  `gating: { strategy: per-feature }`, para que un consumidor multi-repo sepa
  declararlas. (El `contract:` ya lo puso la Fase 1.)
- **Success criterion**: el template sigue siendo YAML válido y las secciones son
  comentarios (no activan config real); `node --check` no aplica (YAML) — se
  verifica que `playbook validate` del repo sigue verde (no rompe el template).
- **Linked acceptance criterion**: soporte de AC-1..AC-4 (documenta cómo declarar
  los repos que la agregación consume).

### Task 3.2 — [x] Confirmación por-repo en `sdd-verify`/`sdd-archive` + regenerar
- **Files**: `skills/sdd-verify/canonical.md`, `skills/sdd-archive/canonical.md`,
  y los `SKILL.md` regenerados (artefactos).
- **Depende de**: Fase 1 (el comando que citan ya existe).
- **Descripción**: agregar una línea explícita en cada `canonical.md`: "confirmá
  el desglose por repo con `playbook status --json` (`delivery.per_repo`); ningún
  repo impactado puede quedar sin mergear". `sdd-archive` mantiene `gate-check`.
  Luego `npm run generate`.
- **Success criterion**: `grep -c "delivery.per_repo" skills/sdd-verify/canonical.md skills/sdd-archive/canonical.md`
  > 0 en ambos; `npm run generate:check` sin drift.
- **Linked acceptance criterion**: metodología de AC-1/AC-2 (gate correcto por construcción).

## Phase 4 — Quality gates

- [x] **Format**: (sin formatter configurado — N/A per `docs/doc_verification_guide.md`)
- [x] **Lint/type-check**: `node --check src/repos/delivery.js && node --check src/cli/status.js`
- [x] **Feature tests**: `node --test test/delivery.test.js && node --test test/lifecycle-cli.test.js`
- [x] **Regeneración de skills**: `npm run generate && npm run generate:check`
- [x] **Regresión completa** (risk: standard): `npm test`

## Execution Report

**Fecha**: 2026-07-23 · **Resultado**: todas las tasks completas, gates verdes.

### Acceptance criteria → evidencia

| AC | Evidencia |
|---|---|
| AC-1 | `test/delivery.test.js`: "3 repos, only hub merged → not merged" — agregado `ci_pending`, no `merged` |
| AC-2 | `test/delivery.test.js`: "all 3 merged → merged" + `reduceDelivery`: "all merged → merged (unanimous)" |
| AC-3 | `test/delivery.test.js`: "ci_failed repo names the repo in per_repo" → `blocked_reason: GITHUB_CI_FAILED @backend` |
| AC-4 | `test/delivery.test.js`: "GitHub unavailable repo mixed with merged → unknown, never merged" (SEC-1 negativo) |
| AC-5 | `test/delivery.test.js`: "single-repo early-return"; `test/lifecycle-cli.test.js`: "single-repo change ... no regression" (tests preexistentes de `lifecycle-cli.test.js` siguen verdes) |
| AC-6 | `test/delivery.test.js`: `per_repo.length` == repos impactados+hub; `test/lifecycle-cli.test.js`: "`--json` ... includes delivery.per_repo" |
| EC-1 / SEC-2 | `test/delivery.test.js`: "impacted repo not declared in config.repos → unknown, resolveOne never called for it" (verifica no-invocación + no path traversal) |
| EC-2 | `test/delivery.test.js`: "hub not a git repo → unknown" |
| SEC-1 | Cubierto en AC-4 (test negativo: `unknown` mezclado con `merged` → `unknown`, nunca `merged`) |
| SEC-2 | Cubierto en EC-1 |
| SEC-3 | Por diseño: `resolveMultiRepoDelivery` no escribe nada; `status.js` no persiste `per_repo`/`delivery` en `sdd.lock` (revisión de código, sin escritura nueva a disco) |

### Comandos corridos (vía `playbook run --step apply`)

- `node --check src/repos/delivery.js` → passed
- `node --check src/cli/status.js` → passed
- `node --test test/delivery.test.js` → passed (28 tests, incluye 6 tests de `reduceDelivery` + 8 de `resolveMultiRepoDelivery` + 6 preexistentes de `resolveDelivery`)
- `node --test test/lifecycle-cli.test.js` → passed (18 tests, incluye 2 nuevos de Task 2.1 + todos los preexistentes sin regresión)
- `npm run generate` / `npm run generate:check` → sin drift
- `npm test` → passed (337 líneas, regresión completa)

### Verificación manual (hub fixture + repo hermano)

Fixture ad-hoc: hub sin `.git` + `backend` git-repo limpio committeado sin PR,
`## Impacted repos: backend`, `config.repos.backend.path` apuntando al fixture.

- `playbook status --json`: `delivery.state = "unknown"`, `blocked_reason: "GIT_UNAVAILABLE @loom"`,
  `delivery.per_repo = [{repo: loom, state: unknown, blocked_reason: GIT_UNAVAILABLE}, {repo: backend, state: committed}]`.
- `playbook status` (texto): línea `Per-repo: loom=unknown · backend=committed` presente.
- `playbook next`: `sdd-apply` (lifecycle `planned`, delivery no gatea en esta etapa) — confirma que la agregación no rompe el ruteo fuera de `runtime_cleared`.

Confirma fail-closed end-to-end: un repo `unknown` (hub sin git) contamina el
agregado a `unknown`, nunca a `merged`, y el `blocked_reason` nombra el repo
culpable.
