---
schema: tasks
schema_version: 1
change_id: contract-first-consumption
status: passed
owner: Bernardo Machuca
created: 2026-07-27
updated: 2026-07-27
---

# Tasks — Cerrar el circuito de contract-first: autoría → consumo → multi-repo

TDD en todas las tareas: el test se escribe primero y **debe fallar contra el código
previo** (exigencia de ADR-032, porque el adapter `cli` está excluido). Todos los comandos
se corren desde la raíz del repo.

**Dependencias entre fases:** la 2 y la 3 dependen de la 1 (el schema tiene que aceptar
`provided_by`/`consumed_by` antes de que el cross-check o el packet los usen — si no, la
config de prueba falla en validación de schema antes de llegar al chequeo). La 4 es
independiente de las tres anteriores (es solo texto de skills) y puede hacerse en
cualquier momento.

## Phase 1 — Schema del config y template

### Task 1.1 — `contract.provided_by` y `contract.consumed_by` en el schema [x]
- **Files**: `schemas/playbook.config.schema.json`, `test/contract-first.test.js`
- **Success criterion**: el schema acepta `contract.provided_by` (string) y
  `contract.consumed_by` (array de strings); una config que los omite sigue siendo válida
  (aserción explícita de retrocompatibilidad); `provided_by` no-string y `consumed_by`
  no-array fallan validación. Ningún `required` nuevo en `contract`.
- **Linked acceptance criterion**: AC-5

### Task 1.2 — Corregir `role: impacted` en el template [x]
- **Files**: `templates/project/playbook.config.yaml`, `test/contract-first.test.js`
- **Success criterion**: el test descomenta el bloque multi-repo del template tal como está
  documentado, lo valida contra el schema, y pasa — hoy falla con `/repos/<name>/role must
  be equal to one of the allowed values — allowed: sdd`. El template ya no contiene
  `role: impacted` y explica que "impacted" se lee del `## Impacted repos` de la proposal,
  no del config.
- **Linked acceptance criterion**: AC-10

### Task 1.3 — Documentar los roles del contrato en el template [x]
- **Files**: `templates/project/playbook.config.yaml`, `test/contract-first.test.js`
- **Success criterion**: el bloque `contract:` comentado del template incluye
  `provided_by` y `consumed_by` con un ejemplo cuyos nombres coinciden con los repos del
  bloque `repos:` del mismo template; el test verifica esa coherencia (todo nombre de
  ejemplo en los roles existe como repo de ejemplo).
- **Linked acceptance criterion**: AC-11

## Phase 2 — `validate`: canal advisory y cross-check de roles

### Task 2.1 — Canal `notices` no bloqueante en `validate` [x]
- **Files**: `src/cli/validate.js`, `test/contract-first.test.js`
- **Success criterion**: con `contract.path_in_loom` configurado y `capabilities.http:
  false`, `playbook validate` emite un aviso que nombra las dos claves en conflicto, con
  **exit code 0** y **cero artefactos inválidos** (las dos aserciones son el corazón de que
  el aviso sea advisory de verdad); en `--json` aparece la clave `notices` de primer nivel
  y `checked`/`failed`/`results` conservan forma y valores; con `http: true` no hay aviso.
  Los avisos se imprimen con prefijo `note:`, igual que `doctor`.
- **Linked acceptance criterion**: AC-4

### Task 2.2 — Cross-check bloqueante de los roles contra `repos:` [x]
- **Files**: `src/cli/validate.js`, `test/contract-first.test.js`
- **Success criterion**: implementa SEC-002 y su **test negativo primero** — una config con
  `provided_by: noexiste` (y otra con ese nombre en `consumed_by`) falla la validación con
  un error que **nombra el repo desconocido**, sin tocar el filesystem; una config cuyos
  roles sí existen en `repos:` valida; `consumed_by` declarado sin `provided_by` **no** es
  error (cubre EC-4). El chequeo va junto al cross-check de adapters/capabilities existente
  y usa `resolveConfiguredRepoPath`, sin rehacer resolución de paths.
- **Linked acceptance criterion**: AC-5, EC-2

## Phase 3 — El packet transporta la topología del contrato

### Task 3.1 — `sources.contract` en el schema del context-packet [x]
- **Files**: `schemas/context-packet.schema.json`, `test/tokens.test.js`
- **Success criterion**: `sources.contract` (string) declarado y **opcional** — `sources`
  sigue exigiendo solo `proposal` y `tasks`; un packet ya generado, sin `contract`, sigue
  siendo válido (aserción explícita de retrocompatibilidad).
- **Linked acceptance criterion**: AC-9

### Task 3.2 — El packet incluye la sección de contrato [x]
- **Files**: `src/tokens/packet.js`, `src/cli/packet.js`, `test/tokens.test.js`
- **Success criterion**: con una porción de contrato presente, el packet incluye una sección
  con el path del contrato y los roles declarados; sin contrato, la salida es **byte a byte
  idéntica** a la actual (aserción contra el comportamiento previo). La sección **no** entra
  en `PACKET_REQUIRED_SECTIONS`, verificado porque un packet sin ella sigue validando. La
  porción de contrato llega **como parámetro** desde `src/cli/packet.js` (que ya tiene
  `cwd`); `src/tokens/packet.js` no importa `loadConfig` — respeta la separación de capas de
  `docs/doc_architecture.md`.
- **Linked acceptance criterion**: AC-9

### Task 3.3 — Staleness por cambio de topología del contrato [x]
- **Files**: `src/tokens/packet.js`, `src/cli/validate.js`, `test/tokens.test.js`
- **Success criterion**: `packetSourceHashes` incluye `contract` cuando hay porción de
  contrato; cambiar `path_in_loom`, `provided_by` o `consumed_by` hace que `validatePacket`
  reporte el packet obsoleto; un cambio de config **no** relacionado (por ejemplo
  `github.base_branch`) **no** lo reporta obsoleto; un packet sin `sources.contract` nunca
  se reporta obsoleto por esa vía (mismo patrón que el objeto `sources` completo ya usa).
- **Linked acceptance criterion**: AC-9

### Task 3.4 — Contención de la lectura del contrato [x]
- **Files**: `src/tokens/packet.js`, `test/contract-first.test.js`
- **Success criterion**: implementa SEC-001 y su **test negativo primero** — un
  `path_in_loom` que escapa del repo (`..`, absoluto a otro árbol, y escape vía symlink) es
  rechazado con un error que nombra la ruta, **sin intentar la lectura** (cubre EC-1); un
  `path_in_loom` relativo y contenido se resuelve igual que hoy. Pasa por
  `resolveContainedPath`, nunca por concatenación de strings.
- **Linked acceptance criterion**: AC-9, EC-1

## Phase 4 — Wiring en los skills

### Task 4.1 — Guarda de tres condiciones y skip declarativo en `sdd-design` [x]
- **Files**: `skills/sdd-design/canonical.md`, `skills/sdd-design/SKILL.md`,
  `test/skill-contract.test.js`
- **Success criterion**: el paso 2 enumera las **tres** condiciones explícitamente
  (`impact.public_contract`, `contract.path_in_loom`, `capabilities.http`); instruye
  declarar el motivo del skip en `## Public contracts / interfaces` de `design.md` en los
  dos casos de skip (sin HTTP en el proyecto, y contrato público no-HTTP en este change);
  `playbook.config.yaml` figura en el `## Context`. El test de contenido falla si alguna de
  las tres condiciones desaparece o si el skip deja de exigir declaración.
  **Alcanzabilidad (obligatoria antes de cerrar la tarea):** el `## Rules` del skill hoy
  dice "Never write a canonical contract when `contract.path_in_loom` is absent" —
  enuncia **una** condición y contradiría por omisión la guarda de tres. Actualizarlo en
  esta misma tarea y releer `## Preconditions` y `## Context` confirmando que ninguno
  niega el wiring. `npm run generate:check` sin drift.
- **Linked acceptance criterion**: AC-1, AC-2, AC-3

### Task 4.2 — `sdd-plan` planifica contra el contrato [x]
- **Files**: `skills/sdd-plan/canonical.md`, `skills/sdd-plan/SKILL.md`,
  `test/skill-contract.test.js`
- **Success criterion**: el skill instruye planificar las tasks contra los endpoints
  declarados en el contrato cuando `contract.path_in_loom` existe y el change toca la API,
  **leyendo por path desde el hub y sin copiar** el contrato a ningún repo; instruye
  reportar y seguir —sin inventar endpoints— cuando el path está declarado pero el archivo
  no existe (cubre EC-3). El test falla si desaparece la instrucción o si aparece
  cualquier variante de copiar/sincronizar el contrato. Antes de cerrar, releer
  `## Preconditions`, `## Context` y `## Rules` confirmando que no contradicen el wiring.
- **Linked acceptance criterion**: AC-6, AC-8, EC-3

### Task 4.3 — `sdd-apply` lee el contrato según el rol del repo [x]
- **Files**: `skills/sdd-apply/canonical.md`, `skills/sdd-apply/SKILL.md`,
  `test/skill-contract.test.js`
- **Success criterion**: el skill instruye leer el contrato al implementar, distinguiendo
  la obligación del **provider** (la spec que la implementación debe cumplir) de la del
  **consumer** (lo disponible para llamar, incluidos los códigos de error a manejar);
  dice explícitamente que se lee por path desde el hub, nunca se copia; e implementa
  SEC-003 declarando que la conformidad la verifica el CI del provider **si está
  instalado**, y que declarar `provided_by` no lo instala. El test de contenido fija las
  tres cosas. Antes de cerrar, releer `## Preconditions`, `## Context` y `## Rules`
  confirmando que no contradicen el wiring.
- **Linked acceptance criterion**: AC-7, AC-8

## Phase N — Quality gates

- **Format**: (sin formatter configurado todavía)
- **Lint/type-check**: `node --check <archivo.js>` (por archivo tocado)
- **Feature tests**: `node --test test/contract-first.test.js test/tokens.test.js test/skill-contract.test.js`
- **Regression**: `npm test && npm run generate:check`

Evidencia manual para el `runtime-gate-report.md` (el adapter `cli` está excluido, la
evidencia no es opcional): `playbook validate` en este repo mostrando el aviso advisory
nuevo con exit code 0; y `playbook validate` sobre un config temporal con un rol que nombra
un repo inexistente, mostrando el error bloqueante que hoy no existe.

**Nota de redacción** (aprendida en el ciclo anterior): no escribir la etiqueta literal de
la entrada de regresión en la prosa de una tarea — el extractor de `packet` la matchea en
cualquier línea del archivo y la convertiría en un comando falso. Solo aparece en la fase
de quality gates de arriba.

## Execution Report

Las 12 tareas (1.1–4.3) fueron implementadas siguiendo TDD: cada test se escribió antes
del cambio de código correspondiente y se verificó en rojo contra el código previo antes de
implementar (exigencia de ADR-032 registrada en cada tarea de este archivo).

**ACs verificados:**

| AC | Evidencia |
|----|-----------|
| AC-1 | `test/skill-contract.test.js` — `sdd-design` guarda de tres condiciones explícitas (`impact.public_contract`, `contract.path_in_loom`, `capabilities.http`); `## Rules` las enumera sin perder la cláusula original |
| AC-2 | `test/skill-contract.test.js` — skip declarado en `## Public contracts / interfaces` para `http:false` y para `http:true` + contrato no-HTTP; "never silent" fijado por test |
| AC-3 | `test/skill-contract.test.js` — `playbook.config.yaml` en el `## Context` de `sdd-design` |
| AC-4 | `test/contract-first.test.js` — canal `notices` en `validate`: aviso con `path_in_loom` + `http:false`, exit 0, cero artefactos inválidos, `notices` en `--json`, prefijo `note:` en texto |
| AC-5 | `test/contract-first.test.js` — schema acepta `contract.provided_by`/`consumed_by` (con back-compat) y el cross-check bloqueante nombra un repo desconocido (EC-2) |
| AC-6 | `test/skill-contract.test.js` — `sdd-plan` planifica contra los endpoints del contrato cuando `contract.path_in_loom` existe y el change toca la API |
| AC-7 | `test/skill-contract.test.js` — `sdd-apply` distingue provider (must fulfill) de consumer (available to call, incl. error codes) |
| AC-8 | `test/skill-contract.test.js` — `sdd-plan` y `sdd-apply` leen por path y declaran explícitamente que nunca copian el contrato |
| AC-9 | `test/tokens.test.js` — packet incluye sección `## Contract` + `sources.contract` opcional; byte-idéntico sin contrato; staleness por cambio de topología; contención SEC-001 |
| AC-10 | `test/contract-first.test.js` — `role: impacted` removido del template; bloque multi-repo descomentado valida contra el schema |
| AC-11 | `test/contract-first.test.js` — template documenta `provided_by`/`consumed_by` con nombres coherentes con su propio `repos:` de ejemplo |
| EC-1 | `test/contract-first.test.js` — `path_in_loom` que escapa (`..`, absoluto, symlink) rechazado antes de leer, vía `resolveContainedPath` |
| EC-2 | `test/contract-first.test.js` — repo desconocido en `provided_by`/`consumed_by` falla nombrándolo, sin tocar el filesystem |
| EC-3 | `test/skill-contract.test.js` — `sdd-plan` reporta y sigue sin inventar endpoints si el archivo del contrato no existe |
| EC-4 | `test/contract-first.test.js` — `consumed_by` sin `provided_by` no es error |
| SEC-001 | `test/contract-first.test.js` (packet) + texto de `sdd-plan`/`sdd-apply` — lectura contenida, nunca por concatenación |
| SEC-002 | `test/contract-first.test.js` — cross-check vía `resolveConfiguredRepoPath`, sin rehacer resolución de paths |
| SEC-003 | `test/skill-contract.test.js` — `sdd-apply` declara que `provided_by` no instala `contract-drift` en el CI por sí solo |

**Comandos corridos** (vía `playbook run --change contract-first-consumption --step apply --`):

- `node --check` sobre cada archivo `.js` tocado (`src/cli/packet.js`, `src/cli/validate.js`,
  `src/tokens/packet.js`, y los 3 `test/*.test.js` tocados) → todos OK
- `node --test test/contract-first.test.js test/tokens.test.js test/skill-contract.test.js`
  (Feature tests) → ✓ passed (132 líneas), log en `.specloom/runs/1785169577763-2a397374/full.log`
- `npm test && npm run generate:check` (Regression) → ✓ passed (459 líneas), log en
  `.specloom/runs/1785169584762-7cae15a6/full.log`

**Evidencia manual recolectada para `runtime-gate-report.md`** (el adapter `cli` está
excluido — ADR-032 — así que esta captura puntual es obligatoria, no opcional; el reporte
en sí lo escribe `sdd-runtime-gate`, no este paso):

- `playbook validate` en este repo (config real: `path_in_loom` + `http:false`) → exit 0,
  8/8 artefactos válidos, `note: playbook.config.yaml declares contract.path_in_loom but
  capabilities.http is false — contract-first authoring will not trigger`.
- `playbook validate --cwd <tmp>` sobre una config con `contract.provided_by: noexiste` y
  `repos: { backend: {...} }` → exit 1, `✗ playbook.config.yaml` /
  `Unknown repo "noexiste" (not found in playbook.config.yaml repos)` — el error bloqueante
  que antes de este change no existía.

**Resultado:** las 12 tareas están `[x]`, los 3 quality gates de la Fase N están en verde,
y no se tocó ningún archivo fuera de `## Constraints and non-goals` de `proposal.md`. Los 2
ADR drafts (`contract-roles-read-from-hub`, `contract-trigger-scoped-to-http`) ya existían
como `status: proposed`, listos para `sdd-code-review`/`sdd-archive`.
