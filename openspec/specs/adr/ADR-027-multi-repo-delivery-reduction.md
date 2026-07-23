---
status: accepted
date: 2026-07-23
ticket: multi-repo-delivery-aggregation
# supersedes: ADR-NNN
---

# ADR: Reducción "eslabón más débil" para delivery multi-repo

## Context

Una feature puede tocar varios repos (el hub de specs + backend + frontends),
declarados en `## Impacted repos` de la proposal (ADR-015). El motor de estado
es PURO y recibe el delivery como un INPUT (`deliveryStatus`); hoy ese input lo
produce `resolveDelivery` mirando **un solo repo** (el hub). Con esto,
`playbook status`/`next` gatean `sdd-verify`/`sdd-archive` sobre el PR del hub e
**ignoran** los PRs hermanos — una feature puede archivarse con un repo sin
mergear.

La corrección exige combinar N estados por-repo (cada uno del conjunto
`unknown | uncommitted | committed | pr_open | ci_pending | ci_passed | ci_failed | merged`)
en **un único** estado agregado que el motor puro consuma sin cambiar su firma.
La forma de combinarlos es una decisión semántica difícil de revertir: fija
cuándo `DELIVERY_NEXT[merged]` dispara `sdd-verify`, y por lo tanto qué se
considera "entregado". Cambiarla después reabre el gate de todas las features.

Invariante en tensión: **fail-closed** (Principio 3 / C-01 / C-10) — ante
cualquier incertidumbre, nunca se asume `merged`.

## Decision

La agregación reduce los estados por-repo con precedencia de **"eslabón más
débil"**: el estado agregado es el del repo en la peor situación, y `merged`
solo se alcanza si es **unánime**. Orden de precedencia (el primero que aplique
gana):

| Condición sobre los estados por-repo | Estado agregado |
|---|---|
| algún repo `unknown` | `unknown` (+ `blocked_reason` que nombra el repo) |
| algún `ci_failed` | `ci_failed` (+ repo culpable) |
| algún `uncommitted` | `uncommitted` |
| algún `committed` (sin PR) | `committed` |
| algún `pr_open` o `ci_pending` | `ci_pending` |
| todos `ci_passed` (o mezcla `ci_passed`+`merged`, no todos merged) | `ci_passed` |
| **todos** `merged` | `merged` |

Reglas normativas:

- `merged` agregado ⟺ **todos** los repos impactados están `merged`. Nunca por
  mayoría ni por el hub solo.
- Cualquier repo `unknown` fuerza el agregado a `unknown` (fail-closed), con
  `blocked_reason` que nombra el repo — nunca se degrada a `merged`.
- Un repo impactado sin `path` resoluble en `config.repos` cuenta como
  `unknown` (fail-closed), no se saltea (ver [[adr-015]] para la fuente de la
  lista de repos).
- Sin `## Impacted repos` (proyecto single-repo) NO hay reducción: se devuelve
  `resolveDelivery({ cwd })` tal cual (back-compat exacto).

## Consequences

### Positive

- Ninguna feature multi-repo puede archivarse con un repo hermano sin mergear:
  el gate queda correcto **por construcción**, sin cambiar el motor puro.
- Preserva fail-closed de punta a punta: la incertidumbre de un solo repo
  contamina el agregado hacia `unknown`, nunca hacia `merged`.
- `ci_failed` nombra al repo culpable, dando un mensaje accionable.

### Negative

- El estado agregado es tan lento como el repo más atrasado: una feature no
  avanza a `verify` hasta que el último PR mergea. Es el comportamiento
  deseado, pero puede sorprender a quien mira solo el hub.
- Requiere una llamada de resolución por-repo (git/gh) — más I/O que el camino
  single-repo. Mitigado por el early-return single-repo.

### Risks

- Un mapeo incompleto `nombre → path` en `config.repos` haría que un repo real
  cuente como `unknown` y bloquee de más. Es el lado seguro del trade-off
  (bloquea, no archiva), y el `blocked_reason` nombra el repo para diagnosticar.
- Si en el futuro se agregan estados nuevos de delivery, deben ubicarse
  explícitamente en la tabla de precedencia o el reduce podría clasificarlos mal.

## Alternatives considered

### Mayoría / cualquier-repo-mergeado

Descartada: viola fail-closed y el objetivo mismo de la fase — permitiría
archivar con hermanos sin mergear.

### Meter la agregación dentro del motor puro (`engine.js`)

Descartada: rompe el Principio 2 (motor puro sin conocimiento de red/multi-repo).
La agregación se calcula **fuera** y se pasa como el `deliveryStatus` que el
motor ya recibe.

### Optimista ante `unknown` (asumir merged si el hub está merged)

Descartada de plano: contradice C-01/C-10 (nunca asumir `merged`).

## Impact

- backend: sin impacto (el motor puro no cambia; la agregación vive en `src/repos/delivery.js`).
- frontend: sin impacto.
- security: refuerza fail-closed en la ruta de estado — la incertidumbre nunca degrada a `merged`.
- data: sin impacto (el delivery nunca se persiste; C-10 intacto).
- deployment: sin impacto directo; cambia cuándo una feature multi-repo se considera entregable.
- testing: nuevo `test/delivery.test.js` con `runGit`/`runGh` fake keyed por `cwd`, cubriendo toda la tabla + back-compat single-repo + fail-closed.
