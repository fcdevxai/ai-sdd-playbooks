---
schema: runtime-gate-report
schema_version: 1
change_id: convention-drift-verify-commit
status: not_applicable
updated: 2026-07-24
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Restaurar `pwd` en `sdd-verify` y el retry cap en `sdd-commit`

Contexto: `context-packet.md` (coherente con las fuentes vivas) +
`playbook changed-files convention-drift-verify-commit --diff`. Los 5 archivos del
diff son `skills/sdd-{verify,commit}/{canonical,SKILL}.md` y
`test/skill-contract.test.js` — ninguno es código ejecutable de runtime, así que no
hubo que full-readear nada para decidir qué manejar.

## Selección de adapters — computada por el motor, no declarada a mano

Plan de `planRuntimeAdapters(config.capabilities, [])` (`src/adapters/index.js`),
con `capabilities` de `playbook.config.yaml` y `runtime_relevant_capabilities: []`
del proposal:

```
browser: not_applicable
http:    not_applicable
cli:     not_applicable  (reason_code: NOT_RELEVANT_TO_CHANGE)
worker:  not_applicable
gateStatusFromAdapters(plan) → not_applicable
```

El `status` del gate es exactamente el agregado que devuelve el motor. No se
fabricó ningún `passed`.

## browser — not_applicable

- **Evidence**: `capabilities.browser: false`. `playbook-ai` no tiene UI web. No se
  invocó Playwright MCP y no correspondía: ausencia de capability es
  `not_applicable`, no `DEPENDENCY_UNAVAILABLE`.
- **Findings**: ninguno.

## http — not_applicable

- **Evidence**: `capabilities.http: false`. Sin superficie HTTP/REST; no hay ruta
  que ejercitar.
- **Findings**: ninguno.

## cli — not_applicable (`NOT_RELEVANT_TO_CHANGE`)

- **Evidence**: `capabilities.cli: true`, pero el proposal declara
  `runtime_relevant_capabilities: []`, así que el motor lo excluye **antes** de la
  rama experimental — de ahí `not_applicable` y no
  `blocked: ADAPTER_NOT_IMPLEMENTED`. La exclusión es verificable: el diff **no
  toca `src/` en absoluto**, así que `bin/playbook.js`, `src/cli/dispatch.js` y
  todos los comandos quedaron byte-idénticos. No hay comportamiento nuevo del CLI
  que un harness E2E pudiera manejar.
- **Findings**: ninguno. Ver la observación de abajo: **es el cuarto ciclo
  consecutivo** con esta misma exclusión.

## worker — not_applicable

- **Evidence**: `capabilities.worker: false`. Sin workers ni colas.
- **Findings**: ninguno.

## Dónde vive la evidencia real de este change

`not_applicable` **no** significa "sin verificar": significa que la verificación de
este change no es de runtime por naturaleza — el entregable es texto normativo
dentro de un prompt.

| Qué | Dónde | Resultado |
|---|---|---|
| Los 9 wirings (AC-1..AC-5 + SEC-001 + los 2 hallazgos de gates) presentes en los `SKILL.md` instalables | `test/skill-contract.test.js` | 8 aserciones nuevas, verdes |
| El wiring no se puede borrar en silencio | mismo archivo | verificado empíricamente en el rojo de TDD: 39 pass / **6 fail** por texto ausente |
| `canonical.md` ↔ `SKILL.md` sincronizados | `npm run generate:check` | sin drift (AC-6) |
| Sin regresión | `npm test` | **352 pass / 0 fail** (345 en `main` + 7 planeadas; las 2 de los gates reutilizan tests existentes) |

**Límite honesto, ya declarado en `design.md` → `## Testing strategy` y repetido
acá porque es justo lo que este gate no puede cubrir:** los tests prueban que las
instrucciones **están**, no que un agente las **obedezca**. El comportamiento nuevo
de `sdd-commit` —regenerar un packet stale y reintentar, detenerse ante un
artefacto firmado— **no es ejercitable por ningún adapter de este gate ni por
`node --test`**. Se va a ejercitar recién cuando un ciclo futuro tropiece con un
`validate` fallido **y** con la skill reinstalada. El `sdd-commit` que corra en este
mismo ciclo es todavía la copia previa al change.

## Observación fuera de scope

**Cuarto ciclo consecutivo declarando `runtime_relevant_capabilities: []`** por el
mismo motivo (`cli-detect-siblings`, `token-saving-parity`,
`contract-first-authoring`, este). El adapter `cli` sigue siendo
`ADAPTER_NOT_IMPLEMENTED` para cualquier change que lo declare relevante, así que
en un repo cuyo producto **es** un CLI, la exclusión dejó de ser una excepción y
pasó a ser la regla de facto — sin estar documentada como tal. Es el hallazgo 7 de
la §8 del plan de wiring-gaps: o se implementa el harness, o se documenta la
exclusión como la vía normal y esperada. No es de este change.
