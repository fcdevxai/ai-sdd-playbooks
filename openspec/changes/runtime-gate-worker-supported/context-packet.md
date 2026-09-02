---
sources:
  proposal: 175ead0f08d313b253830e06e130bbd73e2a19eaa183325cae72c6e7216af8fd
  tasks: eeca5cedf209c28d654859da74d9f5241d50ae529f051ca1be8cc0e595906e77
  contract: 2260109d99574a48c6b6a511d5963f4425e30b430daa082a75e3a115f9aaf70c
---
# Context Packet — Adapter `worker` de sdd-runtime-gate: de experimental a supported

## Ticket

runtime-gate-worker-supported

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

## Files touched

- `test/adapters.test.js`
- `src/adapters/worker.js`
- `test/skill-contract.test.js`
- `skills/sdd-runtime-gate/canonical.md`
- `skills/sdd-runtime-gate/SKILL.md`
- `test/worker-adapter-propagation.test.js`
- `README.md`
- `templates/project/playbook.config.yaml`
- `skills/sdd-bootstrap-project/SKILL.md`

## Verification commands

- `(sin formatter configurado todavía)`
- `node --check src/adapters/worker.js && node --check test/adapters.test.js && node --check test/skill-contract.test.js && node --check test/worker-adapter-propagation.test.js`
- `node --test test/adapters.test.js test/skill-contract.test.js test/worker-adapter-propagation.test.js`
- `npm test`

## Contract

- Path: `openspec/specs/contracts/openapi.yaml`

## Full sources

- openspec/changes/runtime-gate-worker-supported/proposal.md
- openspec/changes/runtime-gate-worker-supported/tasks.md
