---
schema: proposal
schema_version: 1
change_id: runtime-gate-worker-supported
status: approved
owner: Felipe Campos
created: 2026-09-01
updated: 2026-09-01
impact:
  public_contract: false
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
  triggers: []
runtime_relevant_capabilities: []
---

# Adapter `worker` de sdd-runtime-gate: de experimental a supported

## Objective

Promover el adapter `worker` de `experimental` (bloquea siempre con
`ADAPTER_NOT_IMPLEMENTED` cuando es relevante) a `supported` — análogo a
`http`/`browser` — con un checklist de evidencia real y criterios explícitos
de `passed`/`failed`/`blocked`. Esto cierra un deadlock estructural reportado
desde un proyecto consumidor real (`liacopilot/playbook-sdd`,
`lia-early-warning-detection`): con `worker: true` relevante, el
`runtime-gate-report.md` nunca podía llegar a `passed` sin importar la
calidad real de la evidencia.

## Guiding principle

No fabricar `passed`. El adapter pasa a poder emitir evidencia real (como ya
hacen `browser`/`http`), sin bajar el estándar del gate: sigue sin poder
mentir un `passed`, y ahora además puede emitir un `failed` explícito en vez
de solo bloquear.

## Impacted modules

- `src/adapters/worker.js` — `support: 'experimental'` → `'supported'`, y
  `validates` ampliado al vocabulario del checklist nuevo.
- `skills/sdd-runtime-gate/canonical.md` (fuente; `SKILL.md` se regenera, no
  se edita a mano) — nueva sección `worker (supported)` con checklist,
  criterios de `failed`, regla de seguridad SEC-1; ajuste de la tabla **y** de
  `## Rules` para que "experimental adapters block" mencione solo `cli`. Las
  dos ediciones van juntas: en el `SKILL.md` generado, `## Rules` se renderiza
  **antes** de la tabla, así que cambiar solo una deja la otra negándola.
- `test/adapters.test.js` — actualizado al nuevo contrato (hoy fija "worker
  siempre bloqueado si es relevante") + test nuevo que falla contra el código
  previo.
- `test/skill-contract.test.js` — aserciones de contenido nuevas: positiva
  (sección `worker` supported + checklist + SEC-1) y negativa (ningún texto
  del skill sigue clasificando `worker` como experimental).

**Artefactos dependientes que quedan desactualizados al mergear** (barrido de
propagación; ver AC-8):

- `README.md` — comentario `worker: false # experimental adapter`.
- `templates/project/playbook.config.yaml` — comentario `(adapter
  experimental)`, que se copia a **cada proyecto consumidor nuevo**.
- `skills/sdd-bootstrap-project/canonical.md` + su `SKILL.md` regenerado —
  "`cli`/`worker` are experimental adapters that block when enabled".

**No cambian, verificado (no asumido):** `src/adapters/index.js` (su rama
genérica para adapters `supported` ya cubre `worker` sin modificación),
`src/cli/validate.js`, `schemas/*.schema.json`, `test/validate.cli.test.js` y
`test/schema.test.js` — las fixtures de estos dos con `worker: { status:
blocked }` siguen siendo válidas bajo el contrato nuevo, porque un adapter
`supported` también puede quedar `blocked`
(`INSUFFICIENT_EVIDENCE`/`DEPENDENCY_UNAVAILABLE`). `AGENTS.md` y
`openspec/specs/playbooks/spec.md` hablan solo de `capabilities.cli`/de la
capability de este repo: siguen exactos.

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). One bullet per file, grouped by logical repo name: `- <repo-name>: <repo-relative-path>`. <repo-name> must exist in playbook.config.yaml's `repos:` — this is the source of truth `playbook repo-plan`/`commit-plan` use to map file → repo. Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un proyecto consumidor con `capabilities.worker: true` y `worker`
  incluido (o no excluido) en `runtime_relevant_capabilities` del change,
  **When** `sdd-runtime-gate` corre el checklist real (disparo real, proceso
  real, efecto secundario observado, camino de reintento verificado) y toda la
  evidencia es completa y correcta, **Then** el adapter `worker` emite
  `status: passed` — y el gate agregado puede llegar a `passed` si los demás
  adapters aplicables también lo están.
- **Given** el mismo escenario pero `planRuntimeAdapters` planificando el
  change (antes de correr el skill), **When** se llama con
  `{ worker: true, ... }` sin exclusión, **Then** devuelve
  `{ status: 'pending' }` para `worker`, no `{ status: 'blocked', reason_code:
  'ADAPTER_NOT_IMPLEMENTED' }`.

### Edge cases

- Un job se pierde en silencio, el efecto secundario esperado no ocurre o no
  coincide, o la política de reintento/dead-letter no se respeta (error
  tragado o reintento infinito sin límite) → `status: failed`.
- El proyecto no ofrece ninguna forma real de disparar/observar el worker →
  `status: blocked`, `reason_code: DEPENDENCY_UNAVAILABLE`.
- La evidencia reunida es parcial/ambigua → `status: blocked`,
  `reason_code: INSUFFICIENT_EVIDENCE`.
- Un capability `worker: true` pero excluido explícitamente vía
  `runtime_relevant_capabilities` del change → `status: not_applicable`,
  `reason_code: NOT_RELEVANT_TO_CHANGE` (sin cambios respecto de hoy).
- Conseguir la evidencia requeriría disparar un efecto externo irreversible
  real (pago, email/SMS real, llamada real a terceros) y el proyecto no tiene
  doble de test/sandbox para ese efecto puntual → ese hallazgo es `blocked`,
  nunca se fuerza el efecto real ni se fabrica `passed` (ver SEC-1).

## Acceptance criteria

**AC-1:** `src/adapters/worker.js` reporta `support: 'supported'`.
**AC-2:** `planRuntimeAdapters({ worker: true, ... })` sin exclusión devuelve
`{ status: 'pending' }` para `worker` — nunca `blocked`/`ADAPTER_NOT_IMPLEMENTED`
solo por ser experimental.
**AC-3:** Un proyecto con `worker: true` relevante y evidencia real completa
puede alcanzar `runtime-gate-report.md` con `status: passed`.
**AC-4:** `canonical.md` de `sdd-runtime-gate` documenta el checklist de
evidencia real, los criterios de `failed`/`blocked`, y la regla SEC-1; `npm
run generate` (o el comando equivalente) regenera `SKILL.md` sin drift.
**AC-5:** `test/adapters.test.js` — el único test que hoy fija "worker siempre
bloqueado por ser experimental" — queda actualizado al contrato nuevo, con al
menos un test nuevo que falle contra el código previo a este change.
`test/validate.cli.test.js` y `test/schema.test.js` no requieren cambio de
aserciones: sus fixtures con `worker: blocked` siguen válidas porque un adapter
`supported` también puede bloquear.
**AC-6:** `cli` no cambia de comportamiento en ningún escenario — su cobertura
existente (ADR-032) queda bit-a-bit intacta.
**AC-7:** El draft de ADR de este change documenta la decisión del mecanismo
sin dependencia declarada, con sus alternativas rechazadas.
**AC-8:** Ningún artefacto del repo sigue afirmando que `worker` es un adapter
experimental o que bloquea por serlo: `README.md`,
`templates/project/playbook.config.yaml` y
`skills/sdd-bootstrap-project/canonical.md` (+ su `SKILL.md` regenerado)
quedan actualizados, con una aserción de contenido que falle si alguno vuelve
a decirlo.

## Error cases

**EC-1:** El proyecto no tiene forma real de disparar/observar su worker →
`status: blocked`, `reason_code: DEPENDENCY_UNAVAILABLE` (no se fabrica
evidencia).
**EC-2:** La evidencia reunida está incompleta o es ambigua → `status:
blocked`, `reason_code: INSUFFICIENT_EVIDENCE`.
**EC-3:** Un job falla y la política de reintento/dead-letter del proyecto no
se respeta, o el efecto secundario esperado no ocurre → `status: failed`.
**EC-4:** Conseguir la evidencia requeriría un efecto externo irreversible
real y no hay doble seguro disponible → ese hallazgo puntual es `blocked`; el
efecto real nunca se dispara para forzar un `passed`.

## Security considerations

**SEC-1:** La evidencia de `worker` nunca debe conseguirse disparando un
efecto externo irreversible real (pago real, email/SMS real, llamada real a
terceros) — se debe usar el doble de test/sandbox que el proyecto ya tenga
para ese efecto. Si no existe una forma segura, el hallazgo puntual queda
`blocked`, nunca se fuerza el efecto real ni se fabrica `passed`. Mismo
espíritu que `browser`/`http`, que corren contra entornos de test, no
producción.
**SEC-2:** No se agrega superficie sensible nueva en `playbook-ai` — el
propio repo declara `capabilities.worker: false`; la regla vive en el texto
del skill que se distribuye a los proyectos consumidores, no en datos propios
de este repo.

## Constraints and non-goals

- Fuera de alcance: pruebas de carga/throughput del worker.
- Fuera de alcance: condiciones de carrera entre múltiples workers
  concurrentes.
- Fuera de alcance: precisión exacta de backoff/timing de reintentos.
- Fuera de alcance: un mecanismo/dependencia declarado por proyecto para
  disparar el worker (decisión cerrada: no hace falta — ver
  `adr-worker-adapter-no-declared-dependency.md`).
- El adapter `cli` no se toca — sigue exactamente como lo dejó ADR-032.
- `playbook-ai` declara `capabilities.worker: false`: este change no puede
  dogfoodear el adapter contra un worker real propio. La verificación es vía
  tests unitarios de las funciones puras y validación de contenido de
  `canonical.md` — no una corrida en vivo del adapter nuevo.

## Open technical decisions

<!-- Empty if none. -->
