---
schema: proposal
schema_version: 1
change_id: multi-repo-delivery-aggregation
status: approved
owner: Bernardo Machuca
created: 2026-07-23
updated: 2026-07-23
impact:            # any true → sdd-design becomes required
  public_contract: false
  data_model: false
  architecture_boundary: false
  external_integration: false
  cross_repository: true
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: []
runtime_relevant_capabilities: []   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
---

# Delivery multi-repo agregado

## Objective

Cerrar el hueco de corrección central de la fusión: hoy `resolveDelivery` mira
un solo repo, así que `playbook status`/`next` gatean `sdd-verify`/`sdd-archive`
sobre el PR del hub e **ignoran** los PRs de los repos hermanos (backend,
frontends). Consecuencia: una feature multi-repo puede archivarse con un repo
sin mergear. Este change agrega la capa de **agregación de delivery** que
combina el estado de merge de todos los repos impactados en un único estado que
el motor puro consume — sin cambiar el motor.

## Guiding principle

El motor de ciclo de vida sigue siendo **PURO** (Principio 2): la agregación se
calcula **fuera** y se le pasa como el `deliveryStatus` que ya recibe como
input. **Fail-closed** en toda incertidumbre (Principio 3 / C-01 / C-10): nunca
se asume `merged`. **Back-compat exacto** para proyectos de un solo repo: sin
`## Impacted repos`, el comportamiento es idéntico al actual.

## Impacted modules

- `src/repos/delivery.js` (**nuevo**): `resolveMultiRepoDelivery({ cwd, changesDir, runGit, runGh })` — lee `## Impacted repos` + `loadConfig`, resuelve `resolveDelivery` una vez por path (hub + cada repo), reduce a un agregado con la regla "eslabón más débil".
- `src/cli/status.js`: `prepare()` reemplaza `resolveDelivery({ cwd })` por `resolveMultiRepoDelivery({ cwd })`; pasa `.state` a `computeState` (firma intacta) y adjunta `per_repo` al resultado para el render (texto + `--json`).
- `templates/project/playbook.config.yaml`: scaffolding comentado de `repos:` y `gating: { strategy: per-feature }`.
- `skills/sdd-verify/canonical.md`, `skills/sdd-archive/canonical.md`: línea de confirmación del desglose por repo (`playbook status --json` → `delivery.per_repo`) + `npm run generate`.
- Reusa (sin tocar): `resolveDelivery` (`src/github/index.js`), `readImpactedRepos` (`src/repos/impacted.js`), `resolveConfiguredRepoPath`/`resolveSddRepo` (`src/repos/config.js`).

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

No aplica: el change se desarrolla íntegramente en el repo `playbook-ai` (el
framework mismo es single-repo). La feature *habilita* multi-repo para los
consumidores, pero no toca ningún repo hermano.

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** una proposal con `## Impacted repos` = [backend, outplacement, backoffice] y `config.repos` con path para cada uno, **When** solo el PR del hub está mergeado y los hermanos siguen abiertos, **Then** `playbook next` NO rutea a `sdd-verify` — el agregado es `ci_pending`/`ci_passed` según checks, esperando los merges restantes.
- **Given** los tres PRs impactados mergeados, **When** corro `playbook status`, **Then** el delivery agregado es `merged` y `next` rutea a `sdd-verify`.
- **Given** un proyecto **sin** `## Impacted repos`, **When** corro `playbook status`/`next`, **Then** el comportamiento es idéntico al actual (single-repo, sin regresión).
- **Given** cualquier estado, **When** corro `playbook status --json`, **Then** la salida incluye `delivery.per_repo` (una entrada por repo: `{ repo, path, state, blocked_reason? }`) y `playbook status` en texto imprime una línea de desglose por repo.

### Edge cases

- Un repo impactado con contexto GitHub no disponible → ese repo es `unknown` → agregado `unknown` (fail-closed), nunca `merged`.
- Un repo impactado con checks fallando → agregado `ci_failed`, nombrando el repo culpable.
- Un repo listado en `## Impacted repos` pero **sin path resoluble** en `config.repos` → cuenta como `unknown` (fail-closed); no se saltea.
- Mezcla `ci_passed` + `merged` (algunos mergeados, otros con CI verde sin mergear) → agregado `ci_passed` (aún faltan merges), NO `merged`.

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** Con 3 repos impactados y solo el hub mergeado, `playbook next` NO es `sdd-verify` (es `wait_for_github_ci`/`merge` según el agregado).
**AC-2:** El delivery agregado es `merged` si y solo si los 3 PRs impactados están mergeados.
**AC-3:** Un repo con `ci_failed` produce agregado `ci_failed` con el repo nombrado en `blocked_reason`/`per_repo`.
**AC-4:** Un repo con contexto GitHub no disponible produce agregado `unknown` (fail-closed), nunca `merged`.
**AC-5:** Un proyecto de un solo repo (sin `## Impacted repos`) produce comportamiento idéntico al actual (sin regresión): early-return a `resolveDelivery({ cwd })`.
**AC-6:** `playbook status --json` incluye `delivery.per_repo` con una entrada por repo impactado (hub incluido).

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1. -->

**EC-1:** Un repo impactado sin `path` resoluble en `config.repos` → ese repo se reduce a `unknown` con `blocked_reason` que lo nombra (p. ej. `REPO_PATH_UNRESOLVED @backend`); el agregado cae a `unknown` (fail-closed), nunca se archiva.
**EC-2:** El hub mismo no es un repo git (`GIT_UNAVAILABLE`) → ese repo es `unknown` → agregado `unknown`, coherente con el comportamiento single-repo actual.

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** **Fail-closed en la ruta de estado.** La agregación NUNCA degrada a `merged` ante incertidumbre (repo `unknown`, contexto GitHub no disponible, path no resoluble). Test negativo: un repo `unknown` mezclado con repos `merged` produce agregado `unknown`, no `merged`.
**SEC-2:** **Nombres de repo → paths de filesystem.** Los nombres de repo se leen de `## Impacted repos` (in-repo, ya validados por el regex `^[A-Za-z0-9_.-]+$` en `extractImpactedRepos`) y se mapean a paths vía `resolveConfiguredRepoPath` (que solo resuelve paths declarados en `config.repos`). No se construyen paths a partir de input no confiable ni se hace path traversal: un nombre no declarado no resuelve a un path arbitrario, cae a `unknown`. Test: un nombre no presente en `config.repos` no lee fuera del árbol configurado.
**SEC-3:** **El delivery agregado no se persiste** (C-10 intacto): se calcula en vivo en cada `status`/`next` y nunca se escribe en `sdd.lock`. No hay nueva superficie de datos en reposo.

## Constraints and non-goals

- **No-goal:** modificar el motor puro (`src/lifecycle/engine.js`) — su firma y pureza quedan intactas; la agregación es un input.
- **No-goal:** cambiar el path single-repo — queda garantizado por el early-return cuando no hay `## Impacted repos`.
- **No-goal:** tocar packet-verbatim, planner-only, riesgo monótono ni inmutabilidad de ADRs (Principio 4).
- **Constraint:** el `--json` de `status` gana el campo `delivery.per_repo` de forma **aditiva** (no rompe consumidores existentes del JSON).
- **Nota al reviewer (runtime_relevant_capabilities):** se propone `[]`. Este change modifica salida de CLI (`status`/`next`), pero el adapter `cli` es experimental (nunca emite `passed`); declararlo relevante bloquearía `sdd-runtime-gate` con `ADAPTER_NOT_IMPLEMENTED` sin harness real que satisfacer. La conducta se cubre 100% con `test/delivery.test.js` (fakes de git/gh keyed por cwd) + verificación manual contra un hub fixture con repos hermanos, documentada en el verification-report. Es la misma resolución que tomó `restore-contract-first` (Fase 1) ante el mismo hallazgo, ahora anticipada desde `sdd-new` como recomienda el plan. **Confirmá o corregí este valor al aprobar.**

## Open technical decisions

<!-- Empty if none. -->

Ninguna. Las decisiones difíciles de revertir quedaron cerradas en enrich y
registradas en `adr-multi-repo-delivery-reduction.md` (regla de reducción
"eslabón más débil" + fail-closed ante path no resoluble).
