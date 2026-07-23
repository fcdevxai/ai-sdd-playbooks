---
schema: design
schema_version: 1
change_id: multi-repo-delivery-aggregation
status: approved
owner: Bernardo Machuca
created: 2026-07-23
updated: 2026-07-23
security:
  risk: standard
  threat_model_required: false
  controls: [SEC-001, SEC-002, SEC-003]
---
# Technical design — Delivery multi-repo agregado

## Approach

El delivery multi-repo se resuelve **fuera** del motor puro y se le entrega como
el `deliveryStatus` que `computeState` ya recibe (Principio 2). Un módulo nuevo,
`src/repos/delivery.js`, expone:

```
resolveMultiRepoDelivery({ cwd, changesDir, runGit, runGh })
  → { state, per_repo: [{ repo, path, state, blocked_reason? }], blocked_reason? }
```

Flujo:

1. **Resolver la lista de repos impactados.** `readImpactedRepos(slug, changesDir)`
   sobre la proposal del change activo (el mismo `slug`/branch que `status.js` ya
   resuelve). `loadConfig({ cwd })` para el mapa `repos:`.
2. **Early-return single-repo (back-compat, AC-5).** Si la lista de impacted
   repos es vacía → `return { state: resolveDelivery({ cwd, runGit, runGh }).state, per_repo: [ <hub> ] }`.
   El estado agregado es exactamente el del hub; el path del hub va en `per_repo`
   para que el render sea uniforme, pero la semántica es idéntica a hoy.
3. **Construir el conjunto de targets (multi-repo).** El **hub** (`cwd`, siempre)
   + cada repo de `## Impacted repos`, deduplicado por path resuelto. Para cada
   nombre de impacted repo:
   - Resolver el path con `resolveConfiguredRepoPath(name, { cwd })`.
   - Si lanza (no declarado / sin `path`) → el target es `{ repo: name, path: null,
     state: 'unknown', blocked_reason: 'REPO_PATH_UNRESOLVED @'+name }` (EC-1,
     fail-closed). **No se llama a `resolveDelivery`** para ese repo.
4. **Resolver delivery por target.** Para cada target con path, llamar al
   `resolveDelivery({ cwd: path, runGit, runGh })` existente — ya está
   parametrizado por `cwd`/`runGit`/`runGh`, se reusa **verbatim**. El resultado
   `{ state, blocked_reason? }` se guarda en el target.
5. **Reducir** los `state` de todos los targets con la regla "eslabón más débil"
   (ver Public contracts). Se devuelve el agregado + `per_repo` (la lista de
   targets ya resueltos, en orden: hub primero, luego impacted en orden de
   declaración).

**Inyección de runners.** `runGit`/`runGh` se propagan a cada `resolveDelivery`
por-path. En producción, `status.js` no los pasa (cada `resolveDelivery` crea sus
`gitRunner(path)`/`ghRunner(path)` contra el path del target). En tests se
inyectan fakes keyed por `cwd` (un estado por repo) — es el mecanismo que hace la
tabla 100% testeable sin git/gh reales.

## Module impact

| Módulo | Cambio | Nota |
|---|---|---|
| `src/repos/delivery.js` | **nuevo** — `resolveMultiRepoDelivery` + `reduceDelivery` (helper puro exportado para test directo). | Capa `src/repos/` (aditiva/opcional; no rompe single-repo). |
| `src/cli/status.js` | `prepare()`: `resolveDelivery({ cwd })` → `resolveMultiRepoDelivery({ cwd })`; `.state` a `computeState` (firma intacta); `per_repo` adjunto a `result` para render. `statusCommand`: línea de desglose por repo (texto) + `delivery.per_repo` en `--json`. | Único punto de cableado. |
| `src/github/index.js` | **sin cambios** — `resolveDelivery` se reusa por-path. | Principio 4. |
| `src/lifecycle/engine.js` | **sin cambios** — firma y pureza intactas. | Principio 2. |
| `templates/project/playbook.config.yaml` | scaffolding comentado `repos:` + `gating: { strategy: per-feature }`. | Datos, no lógica. |
| `skills/sdd-verify/canonical.md`, `skills/sdd-archive/canonical.md` | línea de confirmación `delivery.per_repo` + `npm run generate`. | Metodología. |

## Trade-offs

- **Reducir fuera del motor vs. dentro.** Elegido fuera: preserva la pureza del
  motor (no aprende de red ni multi-repo). El costo es un módulo más en la ruta
  de `status.js`, aislado y testeable con fakes.
- **`per_repo` como parte del retorno del resolver vs. recomputar en el render.**
  Elegido: el resolver ya tiene los estados por-repo, devolverlos evita una
  segunda pasada y da el desglose que piden AC-6 y las líneas de `sdd-verify`.
  `computeState` NO lo ve (solo recibe `.state`) — así el motor no cambia de firma.
- **Path no resoluble = `unknown` vs. error duro vs. skip.** Elegido `unknown`
  (fail-closed, decisión cerrada en enrich + ADR): bloquea en vez de archivar de
  más, y no aborta el comando (a diferencia del error duro), dando un
  `blocked_reason` diagnosticable. El skip queda descartado por inseguro.
- **`ci_pending` absorbe `pr_open`.** Ambos ruteo a `wait_for_github_ci`; unir
  su clase en la reducción evita un estado agregado que el `DELIVERY_NEXT` trataría
  igual, sin perder información (el `per_repo` conserva el estado exacto por repo).

## Public contracts / interfaces

### `resolveMultiRepoDelivery({ cwd, changesDir?, runGit?, runGh? })`

Retorno:

```jsonc
{
  "state": "<agregado>",              // uno de DELIVERY_STATES
  "per_repo": [
    { "repo": "loom", "path": "/abs/hub", "state": "merged" },
    { "repo": "backend", "path": "/abs/backend", "state": "ci_pending" },
    { "repo": "outplacement", "path": null, "state": "unknown",
      "blocked_reason": "REPO_PATH_UNRESOLVED @outplacement" }
  ],
  "blocked_reason": "GITHUB_CONTEXT_UNAVAILABLE @backend"  // presente solo si state=unknown/ci_failed
}
```

### Regla de reducción (`reduceDelivery(states)`) — "eslabón más débil"

Precedencia (la primera condición que aplique gana; `merged` solo si es unánime):

| # | Condición sobre los estados por-repo | Estado agregado | `blocked_reason` |
|---|---|---|---|
| 1 | algún `unknown` | `unknown` | `<causa> @<primer repo unknown>` |
| 2 | algún `ci_failed` | `ci_failed` | `GITHUB_CI_FAILED @<primer repo ci_failed>` |
| 3 | algún `uncommitted` | `uncommitted` | — |
| 4 | algún `committed` (sin PR) | `committed` | — |
| 5 | algún `pr_open` o `ci_pending` | `ci_pending` | — |
| 6 | todos `ci_passed`, o mezcla `ci_passed`+`merged` (no todos merged) | `ci_passed` | — |
| 7 | **todos** `merged` | `merged` | — |

Notas normativas:
- El `blocked_reason` de `unknown` propaga la causa real del repo culpable
  (`GITHUB_CONTEXT_UNAVAILABLE`, `GIT_UNAVAILABLE`, `REPO_PATH_UNRESOLVED`),
  sufijada con `@<repo>`.
- `merged` (regla 7) es la **única** que dispara `DELIVERY_NEXT[merged] → sdd-verify`.
  Por construcción, requiere unanimidad → AC-1/AC-2.
- Lista vacía de estados no ocurre: el hub siempre está presente.

### Contrato de salida de `playbook status` (aditivo)

- `--json`: se agrega `delivery.per_repo` (array). Los campos existentes de
  `delivery` (`provider`, `state`, `blocked_reason?`) no cambian → **no rompe**
  consumidores (AC-6, constraint aditivo).
- texto: una línea nueva de desglose, p. ej.
  `Per-repo: loom=merged · backend=ci_pending · outplacement=unknown`.

## Data model changes

Ninguna. El delivery agregado se computa en vivo en cada `status`/`next` y
**nunca se persiste** en `sdd.lock` (C-10, SEC-003). No hay artefactos nuevos ni
cambios de schema de datos en reposo. `per_repo` es un valor efímero de la
respuesta del CLI.

## Security controls (+ threat model when required)

Risk: **standard** (se mantiene el de la proposal; el diseño no introduce
exposición nueva — reusa runners existentes, no persiste, refuerza fail-closed).
`threat_model_required: false` (sin superficie de auth/PII/secretos nueva).

- **SEC-001 (fail-closed en la ruta de estado, ← proposal SEC-1):** la reducción
  ubica `unknown` como precedencia máxima (regla 1). Cualquier repo `unknown`
  —incluido el path no resoluble— fuerza el agregado a `unknown`. Imposible que
  una mezcla con `merged` produzca `merged`. Control verificable con test negativo.
- **SEC-002 (nombre de repo → path, ← proposal SEC-2):** los nombres provienen de
  `## Impacted repos` (validados por `^[A-Za-z0-9_.-]+$` en `extractImpactedRepos`)
  y solo resuelven vía `resolveConfiguredRepoPath`, que exige que el nombre esté
  declarado en `config.repos`. Un nombre no declarado NO construye un path
  arbitrario: cae a `REPO_PATH_UNRESOLVED`/`unknown`. Sin path traversal.
- **SEC-003 (no persistencia, ← proposal SEC-3):** `resolveMultiRepoDelivery` no
  escribe nada; `status.js` no lo guarda en el lock. C-10 intacto.

## Testing strategy

`test/delivery.test.js` (nuevo), patrón de runners inyectables keyed por `cwd`
(un estado por repo), cubriendo:

- **Reducción (unit, `reduceDelivery`):** cada fila de la tabla de precedencia
  (1–7), incluyendo mezcla `ci_passed`+`merged` → `ci_passed` (no `merged`).
- **AC-1/AC-2:** 3 repos, solo hub `merged` → agregado ≠ `merged`; los 3 `merged`
  → `merged` (y vía `computeState`, `next` = `sdd-verify` solo en el segundo caso).
- **AC-3:** un repo `ci_failed` → agregado `ci_failed` con repo nombrado.
- **AC-4 / SEC-001:** un repo con contexto GitHub no disponible mezclado con
  `merged` → `unknown` (fail-closed), nunca `merged`.
- **AC-5:** sin `## Impacted repos` → early-return, agregado idéntico a
  `resolveDelivery({ cwd })` (back-compat, sin regresión).
- **AC-6:** forma de `per_repo` (una entrada por repo, hub incluido).
- **EC-1 / SEC-002:** impacted repo no declarado en `config.repos` → `unknown`
  con `REPO_PATH_UNRESOLVED @<repo>`, sin leer fuera del árbol configurado.
- **EC-2:** hub no-git → `GIT_UNAVAILABLE` → agregado `unknown`.

Verificación manual (para el runtime/verification report): `playbook status`/
`status --json`/`next` contra un hub fixture con 2 repos hermanos.
