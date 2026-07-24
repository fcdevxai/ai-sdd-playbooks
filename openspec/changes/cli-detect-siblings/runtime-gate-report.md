---
schema: runtime-gate-report
schema_version: 1
change_id: cli-detect-siblings
status: not_applicable
updated: 2026-07-24
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Comando CLI `playbook detect-siblings`

**Adapter selection**: `proposal.md` declara `runtime_relevant_capabilities: []`
(presente y vacío) — toda capability del proyecto queda explícitamente marcada
irrelevante para este change. Capabilities del proyecto (`playbook.config.yaml`):
`browser: false`, `http: false`, `cli: true`, `worker: false`.

Precedente en este mismo repo: el change `wire-token-and-security-policy`
(que también agregó wiring de CLI — `validateVerificationBody` + cableado en
`validate.js`) fue tratado igual: `cli: not_applicable
(NOT_RELEVANT_TO_CHANGE)`, porque el adapter `cli` del runtime-gate es sobre un
harness de ejecución real end-to-end (experimental, `ADAPTER_NOT_IMPLEMENTED`),
no sobre "¿el diff toca código del CLI?" — eso ya lo cubren los tests
unitarios/CLI (`node --test`), que corrieron en verde para este change
(`test/repos.test.js`, `test/dispatch.test.js`).

## browser — not_applicable

- Evidence: capability `browser: false`. Sin UI web en este repo.
- Findings: ninguno.

## http — not_applicable

- Evidence: capability `http: false`. Sin superficie HTTP/REST.
- Findings: ninguno.

## cli — not_applicable (NOT_RELEVANT_TO_CHANGE)

- Evidence: capability `cli: true` (este repo shipea `bin/playbook.js`), pero
  `proposal.md` declara `runtime_relevant_capabilities: []`, excluyéndolo.
  Además de la exclusión explícita, el nuevo comando (`detect-siblings`) fue
  verificado manualmente contra el bin local del working tree
  (`node bin/playbook.js detect-siblings --json --cwd <path-absoluto>`),
  confirmando texto legible y JSON con la forma correcta contra los repos
  hermanos reales de este workspace (`lablab-playbook-ai`, `specloom`).
- Findings: ninguno.

## worker — not_applicable

- Evidence: capability `worker: false`. Sin workers/colas en background.
- Findings: ninguno.
