---
schema: runtime-gate-report
schema_version: 1
change_id: contract-first-authoring
status: not_applicable
updated: 2026-07-24
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Authoring del contrato canónico en `sdd-design`

Contexto: `context-packet.md` (coherente con las fuentes vivas) +
`playbook changed-files contract-first-authoring --diff`. Los 4 archivos del diff
son `README.md`, `skills/sdd-design/{canonical,SKILL}.md` y
`test/skill-contract.test.js` — ninguno es código ejecutable de runtime, así que
no hubo que full-readear nada para decidir qué manejar: **no hay nada que
manejar**.

## Selección de adapters — computada por el motor, no declarada a mano

El plan sale de `planRuntimeAdapters(config.capabilities, [])`
(`src/adapters/index.js`), con `capabilities` leídas de `playbook.config.yaml` y
`runtime_relevant_capabilities: []` del proposal:

```
capabilities: {"browser":false,"http":false,"cli":true,"worker":false}
plan:
  browser: not_applicable
  http:    not_applicable
  cli:     not_applicable  (reason_code: NOT_RELEVANT_TO_CHANGE)
  worker:  not_applicable
gateStatusFromAdapters(plan) → not_applicable
```

El `status` del gate es exactamente el agregado que devuelve el motor. No se
fabricó ningún `passed`.

## browser — not_applicable

- **Evidence**: `capabilities.browser: false`. `playbook-ai` no tiene UI web (es
  un CLI + un set de skills). No se invocó Playwright MCP y no correspondía:
  ausencia de capability es `not_applicable`, no `DEPENDENCY_UNAVAILABLE`.
- **Findings**: ninguno.

## http — not_applicable

- **Evidence**: `capabilities.http: false`. No hay superficie HTTP/REST. Nota
  específica de este change, porque puede confundir: el change habla de un
  contrato **OpenAPI**, pero el contrato es un artefacto que este hub *autora
  para otros repos*; `playbook-ai` no implementa esos endpoints. Su
  `openspec/specs/contracts/openapi.yaml` sigue en `paths: {}` (no-goal explícito
  del proposal). No hay ruta que ejercitar.
- **Findings**: ninguno.

## cli — not_applicable (`NOT_RELEVANT_TO_CHANGE`)

- **Evidence**: `capabilities.cli: true`, pero el proposal declara
  `runtime_relevant_capabilities: []`, así que el motor lo excluye **antes** de la
  rama experimental — por eso es `not_applicable` y no
  `blocked: ADAPTER_NOT_IMPLEMENTED`. La exclusión es correcta y verificable, no
  una conveniencia: el diff **no toca `src/` en absoluto**, así que no hay
  comportamiento nuevo del CLI que un harness E2E pudiera manejar. `bin/playbook.js`,
  `src/cli/dispatch.js` y todos los comandos quedaron byte-idénticos.
- **Findings**: ninguno.

## worker — not_applicable

- **Evidence**: `capabilities.worker: false`. Sin workers ni colas.
- **Findings**: ninguno.

## Dónde vive la evidencia real de este change

`not_applicable` acá **no** significa "sin verificar" — significa que la
verificación de este change no es de runtime por naturaleza: el entregable es
texto normativo dentro de un prompt. La evidencia sustantiva es:

| Qué | Dónde | Resultado |
|---|---|---|
| Los 7 wirings (AC-1..AC-5 + SEC-F1) presentes en el `SKILL.md` instalable | `test/skill-contract.test.js` | 7 aserciones nuevas, verdes |
| El wiring no se puede borrar en silencio | mismo archivo | verificado empíricamente en el rojo de TDD: 5 fallos por texto ausente antes del wiring |
| `canonical.md` ↔ `SKILL.md` sincronizados | `npm run generate:check` | sin drift (AC-6) |
| Sin regresión | `npm test` | **345 pass / 0 fail** |

## Observación fuera de scope

El adapter `cli` sigue siendo `ADAPTER_NOT_IMPLEMENTED` para cualquier change que
sí lo declare relevante, así que **ningún** change que toque `src/cli/` puede
pasar este gate sin declarar `runtime_relevant_capabilities` excluyéndolo. Es el
tercer ciclo consecutivo que lo declara `[]` por ese motivo
(`cli-detect-siblings`, `token-saving-parity`, este). El patrón está anotado, no
es de este change: o se implementa el harness `cli`, o se documenta la exclusión
como la vía normal en un repo cuyo producto *es* un CLI.
