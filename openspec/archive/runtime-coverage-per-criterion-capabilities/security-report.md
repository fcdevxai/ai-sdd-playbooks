---
schema: security-report
schema_version: 2
change_id: runtime-coverage-per-criterion-capabilities
status: passed
risk: standard
threat_model_required: false
updated: '2026-11-04'
source_binding:
  manifest_path: >-
    openspec/changes/runtime-coverage-per-criterion-capabilities/handoff-manifest-sdd-security-gate-7874a3a99e99fdeef216478b0c9ec2a1855bebc9a3034a5512158aa9472f39ef.json
  manifest_hash: 7874a3a99e99fdeef216478b0c9ec2a1855bebc9a3034a5512158aa9472f39ef
  governed_manifest_hash: 980e4a664f80117a255f0149027add72315b4dd598d62b3ef14884b1bb307d88
  repositories:
    - name: loom
      branch: runtime-coverage-per-criterion-capabilities
      commit_sha: 09da47cef366833b9845c0171e08a8cd545d7cba
      source_hash: c2b112de0d2165a662018e32a0a4ecc004ca6ebb6da858a63f067c17d44d4121
      tree_hash: 661a6724271e1af2d1c48eebab546994b1682744798b21e3e430d9ac7c4fb459
  proposal_hash: 60b794ec33e9273427b0a7fb5f6ef89a9114a9f548f2503826627536b1b977b1
  design_hash: unknown
  normative_tasks_hash: dae7c31f51ef3eba745f7b4e7d21b69d0f1cc214e6b59b798de4e97d2f58f5bc
  contract_hashes:
    - path: openspec/specs/contracts/openapi.yaml
      hash: 18a5d47d03953801479346fe7779ac169469c18fd63c05f65585561693460a4f
  receipts:
    - repository: loom
      path: .specloom/runs/1793836484584-a8e82ca8-l3uh9T/execution-receipt.json
      sha256: 4147989cb834556d4181b79bb45592be040c7256562238907871e09a9e3a04fe
    - repository: loom
      path: .specloom/runs/1793836488002-0c3aa9b3-2hCv4w/execution-receipt.json
      sha256: 4136aae9fb1ebefb539d6006ea7d307fa9d7ee9a7bd9f1330ddc013009b58e85
  delivery_state: uncommitted
---
# Security Report — Cobertura de runtime por criterio con omisiones explícitas de capacidades

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: revisión completa. El change no toca autenticación, datos de usuarios,
secretos ni dependencias, pero sí procesa entrada externa (el YAML de `tasks.md`) y relaja un
control del ciclo de vida que fallaba cerrado (la cobertura de runtime por criterio). Ambas
cosas justifican aplicar el checklist completo.

## Rules

- Never lower an approved risk level automatically; you may raise it with justification.
- Any blocking finding → `status: blocked` (the change moves to the blocked view).
- Always include the non-replacement disclaimer in the report and CLI output.
- Do not claim the change is "secure" — claim only that the declared controls
  have (or lack) evidence.
- Missing/client-side-only/broader-than-specified authorization, cross-tenant
  data access, unsanitized input reaching a query/command/template, sensitive
  data exposed in a response/log/error, or a committed secret → always blocking.
- Do not propose scope expansion beyond the approved feature.

## Risk model

- The **proposal** declares `security.risk` (`low | standard | elevated`) and
  `security.triggers`. `http: true` alone is **not** elevated.
- The **design** (when present) sets `threat_model_required` and lists
  `controls` (`SEC-00x`).
- This gate **may raise** the risk if it detects omitted signals; it **never
  lowers** an approved risk automatically.

## Checklist

- [n-a] Authorization and access control — el change no agrega ni modifica endpoints, roles ni
  permisos. El control que se relaja es de gobernanza del ciclo, y se evalúa en la coherencia.
- [n-a] Ownership boundaries (IDOR) — no hay referencias a objetos de usuario ni de tenant.
- [pass] Input handling — `handoff.runtime_not_applicable` llega del YAML de `tasks.md`.
  `buildHandoffManifest` valida su forma y copia solo los cuatro campos conocidos, de modo que
  las propiedades extra no pasan al manifest. Las listas mal formadas, incluido `null`, fallan
  cerradas (SEC-4). El validador usa `Map`/`Set` y `Object.hasOwn(ADAPTERS, …)`, así que valores
  como `__proto__` caen en «unknown». Los valores solo aparecen en mensajes y en el JSON del
  manifest; no llegan a shell, `eval` ni plantillas (escaneo `1793836488002-0c3aa9b3-2hCv4w`).
- [pass] Data exposure — no se introducen datos sensibles; el único texto nuevo es el motivo de
  una omisión, que vive en `tasks.md` igual que `non_runtime` (SEC-1).
- [pass] Secrets and credentials — el escaneo del diff no encuentra patrones de secretos; no hay
  configuración nueva.
- [pass] Dependencies and integrations — `package.json` y `package-lock.json` cambian solo el
  campo `version`; no hay dependencias ni integraciones nuevas. La instalación de `node_modules`
  en el worktree usó la lockfile existente con `--ignore-scripts` y no se versiona.

## Risk rationale

Riesgo declarado: `standard`, sin triggers. Riesgo detectado: `standard`. El change relaja una
regla fail-closed, pero solo mediante una declaración explícita, validada contra el mapa de
cobertura y las capacidades, y sin tocar la exigencia por adaptador. No toca autenticación,
datos personales ni secretos. Reconciliado: `max(standard, standard) = standard`. No se requiere
threat model formal (`threat_model: auto` con riesgo `standard`); el modelo de amenaza aplicable
es el de ADR-043: errores honestos de agentes o personas.

## Control checklist (control → evidence)

| Control | Evidencia |
|---|---|
| SEC-1 | Diff revisado y escaneado sin secretos ni datos personales (`1793836488002-0c3aa9b3-2hCv4w`) |
| SEC-2 | Pruebas de EC-1 a EC-6 y del hash gobernado (`test/runtime-coverage.test.js`, `test/handoff.test.js`; `1793836484584-a8e82ca8-l3uh9T`) |
| SEC-3 | Prueba de AC-5: un adaptador omitido en todos los criterios sigue exigiendo evidencia ligada o exclusión (`1793836484584-a8e82ca8-l3uh9T`) |
| SEC-4 | Pruebas de EC-7 en packet (incluido `null`, corregido en la ronda 2 de code review) y en el validador (`1793836484584-a8e82ca8-l3uh9T`) |
| SEC-5 | Fila de riesgo aceptado en `docs/security-checklist.md`, verificada por `test/readme.test.js` |

## Threat model (when required)

No requerido. Se aplica el modelo de ADR-043: defiende contra errores honestos; la falsificación
deliberada de un actor con escritura sobre el repositorio es un límite aceptado.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| — | — | — | — | Sin hallazgos bloqueantes |

## Follow-ups

| finding | severity | unmet condition | owner | destination (new change, issue, accepted as-is) |
|---|---|---|---|---|
| F-1: la fila del checklist de seguridad y el ADR draft `adr-per-criterion-capability-omissions.md` hablan de «aprobación humana de `tasks.md`». El ciclo no tiene un paso de aprobación de `tasks.md` (`src/lifecycle/model.js` solo espera a una persona en la proposal y en el merge; `engine.js`, en el design). El control humano real es la revisión del pull request que contiene `tasks.md`, antes del merge, y eso ocurre después de los gates | low | No hay un control ausente ni un defecto reproducible: la revisión humana existe en el merge; es una imprecisión de redacción | maintainers | Ajustar la redacción del ADR y de la fila del checklist al promoverlos en `sdd-archive` de este change |
| F-2: los valores de una omisión se imprimen tal cual en los mensajes del validador, así que un `tasks.md` con secuencias de escape de terminal podría alterar la salida | low | Fuera del modelo de amenaza: requiere escritura deliberada sobre el repositorio (límite aceptado de ADR-043); el mismo comportamiento ya existe para `runtime_coverage` y `non_runtime` | maintainers | Aceptado tal cual |

## Review rounds

| round | full or delta | date | commit reviewed | blocking findings | result |
|---|---|---|---|---|---|
| 1 | full | 2026-11-04 | `09da47c` + árbol de trabajo sin commitear (incluye la corrección de la ronda 2 de code review) | 0 | passed |

## Recibos de esta revisión

| ID | Comando | Resultado |
|---|---|---|
| `1793836484584-a8e82ca8-l3uh9T` | `node test/helpers/run-tests.js test/runtime-coverage.test.js test/handoff.test.js test/handoff-schema.test.js` | Verde, 40 pruebas |
| `1793836488002-0c3aa9b3-2hCv4w` | escaneo del diff contra `origin/main`: dependencias, patrones de secretos y sinks de shell/eval en `src` | Solo cambia `version`; sin secretos; sin sinks |
