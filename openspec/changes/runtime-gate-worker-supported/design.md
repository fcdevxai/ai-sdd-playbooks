---
schema: design
schema_version: 1
change_id: runtime-gate-worker-supported
status: approved
security:
  risk: standard
  threat_model_required: false
  controls: [SEC-001, SEC-002]
updated: 2026-09-01
---
# Technical design — Adapter `worker` de sdd-runtime-gate: de experimental a supported

## Approach

**Dónde vive realmente el deadlock.** `planRuntimeAdapters` y `ADAPTERS` se
exportan pero **ningún comando del CLI los llama**: el único consumidor de
`src/adapters/` en `src/` es `gateStatusFromAdapters`, importado por
`src/cli/validate.js:23` para el chequeo de agregación. `playbook validate`
nunca exige `ADAPTER_NOT_IMPLEMENTED` para `worker`, y nunca rechazó un
`worker: { status: passed }`.

Consecuencia de diseño: la regla que bloquea `worker` es **texto del skill**
que el agente obedece, no una comprobación de código. Por lo tanto el fix
sustantivo es el texto canónico; el flag `support` del descriptor es la
declaración legible por máquina que los tests fijan para que texto y código no
se separen.

**Orden de lectura (regla de alcanzabilidad, spec `playbooks` §"A content
assertion proves presence, not reachability").** El generador
(`src/generator/generate-skills.js:31`) ordena
`['Purpose','Context','Behavior','Output','Rules']` y luego el resto en orden
de fuente. En `canonical.md`, `## Rules` está al final, pero en el `SKILL.md`
generado se renderiza **antes** de `## Adapter selection`. Un agente lee
primero "Experimental adapters (`cli`, `worker`) block…". Si solo cambiáramos
la tabla y la sección del adapter, la regla previa **negaría** el texto nuevo y
todas las aserciones de contenido quedarían en verde sobre un cambio inerte —
exactamente el fallo documentado en esa sección de la spec. Los tres puntos de
`canonical.md` (Rules, tabla, sección) cambian juntos o el change es un no-op.

**Forma del cambio**, en tres capas coherentes entre sí:

1. **Texto canónico** (`skills/sdd-runtime-gate/canonical.md`) — la autoridad
   real de comportamiento.
2. **Descriptor** (`src/adapters/worker.js`) — `support: 'supported'` y la
   lista `validates` alineada al checklist nuevo, para que la declaración
   legible por máquina no contradiga la prosa.
3. **Coherencia de artefactos dependientes** — todo texto del repo que hoy
   afirma que `worker` es experimental deja de ser verdad al mergear (barrido
   completo en `## Module impact`).

`src/adapters/index.js` no se toca: su rama `else` ya trata cualquier adapter
no experimental como `pending`, sin nombrar adapters.

## Module impact

### Cambian

| Archivo | Delta |
|---|---|
| `src/adapters/worker.js` | `support: 'experimental'` → `'supported'`; `validates` ampliado al vocabulario del checklist (disparo real, procesamiento real, efecto observable, reintento/dead-letter, idempotencia condicional) |
| `skills/sdd-runtime-gate/canonical.md` | 4 ediciones: (a) `## Rules` — "Experimental adapters (`cli`, `worker`)" → solo `cli`; (b) tabla de selección — fila experimental → solo `cli`; (c) `### cli / worker (experimental)` se parte en `### worker (supported)` (checklist de 7 puntos + criterios de `failed` + SEC-001) y `### cli (experimental)` sin cambios semánticos; (d) `## Runtime tool dependency` — nota de que `worker` no depende de ninguna MCP: la ausencia de una herramienta **no** es por sí sola `DEPENDENCY_UNAVAILABLE` |
| `skills/sdd-runtime-gate/SKILL.md` | Regenerado con `npm run generate` — nunca editado a mano |
| `skills/sdd-bootstrap-project/canonical.md:46` + su `SKILL.md` | (AC-8) "`cli`/`worker` are experimental adapters that block when enabled" → solo `cli` |
| `README.md:133` | (AC-8) Comentario `worker: false # experimental adapter` |
| `templates/project/playbook.config.yaml:12` | (AC-8) Comentario `(adapter experimental)` — se copia a **cada proyecto consumidor nuevo** |
| `test/adapters.test.js` | Título y aserciones del nivel de soporte; test de "experimental → blocked" pasa a cubrir solo `cli`; test nuevo `worker: true` → `pending` (rojo contra el código previo) |
| `test/skill-contract.test.js` | Aserciones nuevas: positiva (sección `worker` supported + checklist + SEC-001) y **negativa** (ningún texto del skill clasifica `worker` como experimental ni le asigna `ADAPTER_NOT_IMPLEMENTED`) — es lo que fija la alcanzabilidad |

### No cambian (verificado, no asumido)

- `src/adapters/index.js`, `src/cli/validate.js`, `schemas/*.schema.json`.
- `test/validate.cli.test.js` y `test/schema.test.js`: sus fixtures con
  `worker: { status: blocked }` siguen siendo **válidas** bajo el contrato
  nuevo — un adapter `supported` también puede quedar `blocked`
  (`INSUFFICIENT_EVIDENCE`/`DEPENDENCY_UNAVAILABLE`). AC-5 lo declara
  explícitamente para que `sdd-verify` no los busque como evidencia faltante.
  Si al implementar se toca alguno, será solo un comentario, nunca una
  aserción.
- `AGENTS.md:41`: habla solo de `capabilities.cli` de este repo — sigue exacto.
- `openspec/specs/playbooks/spec.md:417` ("`worker` needs no criterion:
  `capabilities.worker: false`"): sigue verdadero, es sobre la capability de
  **este** repo, no sobre el nivel de soporte del adapter.
- ADR-032 y todo lo relativo a `cli`: intactos (AC-6).

## Trade-offs

**Reusar `DEPENDENCY_UNAVAILABLE` vs. crear un reason code nuevo.** Se reusa.
Costo aceptado: el mismo código pasa a significar dos cosas ("falta la MCP" en
`browser`; "no hay forma de disparar/observar el worker" en `worker`).
Mitigación: el texto exige que el finding **nombre qué faltaba**. A cambio, el
enum del schema, `validate` y todo consumidor existente quedan sin tocar — un
código nuevo obligaría a migrar reportes ya escritos en proyectos consumidores.

**Checklist en prosa vs. verificación mecánica.** En prosa, igual que
`browser`/`http`. No existe mecanismo para verificar que el agente realmente
disparó la cola real; el riesgo queda aceptado y escrito en el ADR draft. La
alternativa (construir tooling de conducción de workers) se rechazó por
proporcionalidad, con el mismo criterio que ADR-032 usó para `cli`.

**Ampliar `validates` en el descriptor vs. dejarlo como está.** Se amplía: si
la prosa lista siete puntos y el descriptor tres, la próxima persona que lea
el descriptor obtiene una versión desactualizada del contrato. Es exactamente
la clase de drift que las content assertions de este repo existen para evitar.

**Este change no puede dogfoodear el adapter.** `playbook-ai` declara
`capabilities.worker: false` (honesto: no tiene colas). Se acepta y se declara;
no se activa la capability para poder ejercitarla — ADR-032 ya rechazó por
deshonesto el movimiento simétrico de tocar una capability para conveniencia
del gate.

## Public contracts / interfaces

**Authoring del contrato canónico: SALTEADO, con motivo declarado.** De las
tres condiciones requeridas, fallan dos: el proposal declara
`impact.public_contract: false`, y `playbook.config.yaml` declara
`capabilities.http: false` (este repo no tiene superficie HTTP).
`contract.path_in_loom` sí está declarado, pero por sí solo no habilita nada.
No se crea ni se modifica `openspec/specs/contracts/openapi.yaml`.

Las interfaces que **sí** cambian no son HTTP:

- **Descriptor de adapter** (`src/adapters/worker.js`): `support` pasa de
  `'experimental'` a `'supported'`; `validates` se amplía. Consumido hoy solo
  por `planRuntimeAdapters` y los tests.
- **Contrato de instrucción del skill** (`sdd-runtime-gate`): `worker` pasa de
  "bloquea siempre" a "emite `passed`/`failed`/`blocked` según evidencia real".
  Es el contrato que consumen los agentes en los proyectos que instalan la
  metodología.
- **Sin cambios** en la salida de ningún comando del CLI para este repo
  (`capabilities.worker: false` ⇒ mismo camino de código que hoy).

## Data model changes

Ninguno. `schemas/runtime-gate-report.schema.json` queda igual: `status` ya
admite `passed|failed|blocked|not_applicable` para cualquier adapter, y
`reason_code` es string libre. Ningún artefacto por change cambia de forma.

## Security controls (+ threat model when required)

`risk: standard`, `threat_model_required: false`. El change no toca
autenticación, autorización, datos personales, secretos ni integraciones
externas de este repo: agrega texto normativo que **restringe** lo que un
agente puede hacer al juntar evidencia. No hay motivo para elevar el riesgo, y
no se baja ninguno.

- **SEC-001** (implementa `proposal` SEC-1) — `canonical.md` debe llevar la
  regla normativa: la evidencia de `worker` nunca se consigue disparando un
  efecto externo irreversible real (pago, email/SMS a destinatario real,
  llamada real a terceros). Se usa el doble de test/sandbox del proyecto; si no
  existe uno para ese efecto, el hallazgo queda `blocked` — nunca se dispara el
  efecto real ni se fabrica `passed`. **Verificación:** content assertion en
  `test/skill-contract.test.js` sobre el texto de la regla, y ubicación de la
  regla dentro de la sección `worker` **y** referenciada desde `## Rules`, para
  que no dependa de que el agente llegue hasta el final de la sección.
- **SEC-002** (implementa `proposal` SEC-2) — el change no agrega superficie
  sensible en este repo: sin campos nuevos en `playbook.config.yaml`, sin
  entrada nueva de usuario, sin cambio en cómo `validate` lee reportes, sin
  secretos ni endpoints en ningún artefacto nuevo. **Verificación:** el diff no
  toca `src/config/`, `src/cli/validate.js` ni `schemas/`.

## Testing strategy

1. **Unitario, rojo primero (AC-5).** En `test/adapters.test.js`: nuevo test
   `planRuntimeAdapters({ worker: true, cli: false })` → `{ status: 'pending' }`.
   Falla contra el código previo (hoy devuelve `blocked` /
   `ADAPTER_NOT_IMPLEMENTED`) — es la prueba sustantiva de AC-2.
2. **Unitario, nivel de soporte (AC-1).** `ADAPTERS.worker.support ===
   'supported'`, `ADAPTERS.cli.support === 'experimental'` (AC-6), con el
   título del test actualizado para no mentir.
3. **Unitario, no-regresión de la exclusión.** `worker: true` excluido vía
   `relevantCapabilities` sigue dando `not_applicable` /
   `NOT_RELEVANT_TO_CHANGE`: el camino que hoy usan los proyectos no se rompe.
4. **Contenido positivo (AC-4).** En `test/skill-contract.test.js`: el body de
   `sdd-runtime-gate` contiene la sección `worker` supported, los puntos del
   checklist (disparo real, efecto observable, reintento/dead-letter) y la
   regla SEC-001.
5. **Contenido negativo — alcanzabilidad.** El body **no** contiene ninguna
   afirmación que clasifique `worker` como experimental ni que le asigne
   `ADAPTER_NOT_IMPLEMENTED`. Esta es la aserción que impide que el change
   quede inerte por la contradicción `## Rules` → tabla descrita en
   `## Approach`.
6. **Coherencia de artefactos dependientes (AC-8).** Aserción de contenido que
   recorre `README.md`, `templates/project/playbook.config.yaml` y
   `skills/sdd-bootstrap-project/canonical.md` + su `SKILL.md`, y falla si
   alguno vuelve a clasificar `worker` como adapter experimental o como
   bloqueante por serlo. Sin esto, esos cuatro archivos no los mira ningún
   gate: `sdd-code-review` revisa contra `proposal.md` y `sdd-verify` mapea
   `AC-N` — ninguno lee `design.md` por nombre.
7. **Drift de generación (AC-4).** `npm run generate` y luego
   `npm run generate:check` sin drift: `SKILL.md` nunca editado a mano.
8. **Suite completa.** `npm test` en verde, incluidos los tests de `validate`
   y `schema` que no se modifican — su verde es la evidencia de que el
   contrato de agregación quedó intacto.
9. **Sin cobertura E2E propia**, declarado: este repo no tiene worker real
   contra el cual correr el adapter nuevo. El primer ejercicio real ocurre en
   un proyecto consumidor con `worker: true`. Riesgo escrito en el ADR draft.
