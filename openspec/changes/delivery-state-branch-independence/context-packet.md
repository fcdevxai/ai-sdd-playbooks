---
sources:
  proposal: 198e50f0e36885f3cdb12d93ec48845ac62ff9b8f3337d2e9a19ff902d06a2c7
  tasks: 160fe2e6796042ef1d8e6e3501219195f63299cdcd935860f004a250f9304ec0
---
# Context Packet — Delivery independiente de la branch actual

## Ticket

delivery-state-branch-independence

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** `resolveDelivery` acepta un `slug` opcional y, cuando está presente,
resuelve el PR y los checks de esa branch en vez de la actual.
**AC-2:** sin `slug`, el comportamiento es idéntico al actual — los 20 tests
existentes de `test/delivery.test.js` pasan sin modificarse.
**AC-3:** `resolveMultiRepoDelivery` propaga el `slug` a `resolveOne`, tanto en el
camino single-repo como en el fan-out por repo impactado.
**AC-4:** existe un test que **falla contra el código actual**: change con PR
mergeado, `currentBranch` = `main`, delivery resuelto = `merged` (no `committed`).
**AC-5:** el corto-circuito de árbol sucio sigue intacto — `test/delivery.test.js:51`
("dirty working tree → uncommitted (GitHub not consulted)") pasa sin tocarse.
**AC-6:** el slug se valida antes de convertirse en argumento de `gh`; un slug
inválido no produce ninguna invocación de `gh`.
**AC-7:** `openspec/specs/playbooks/spec.md` documenta el criterio de exclusión del
adapter `cli` y qué evidencia se exige en su lugar.
**AC-8:** `npm test` verde y `playbook validate --ci` exit 0.

## Constraints and non-goals

- **No-goal:** tocar `localGitState` ni el corto-circuito de árbol sucio (decisión
  cerrada; ver EC-3).
- **No-goal:** tocar `DELIVERY_NEXT` ni el mapeo lifecycle→next de
  `src/lifecycle/engine.js`. El motor puro no cambia.
- **No-goal:** persistir la referencia al PR o cualquier estado de delivery — violaría
  `system.md`.
- **No-goal:** implementar el harness del adapter `cli`. Se documenta el criterio de
  exclusión (draft de ADR); implementarlo es un change propio, con el disparador que
  ese ADR define.
- **No-goal:** los otros follow-ups de la §11 del plan (distribución, path handling,
  warning del packet).
- **Constraint:** el camino sin `slug` queda byte-idéntico; los 20 tests actuales de
  `delivery.test.js` no se modifican.
- *Nota al reviewer sobre `impact.public_contract: false`:* la superficie **documentada**
  del CLI no cambia — ningún comando nuevo, ninguna flag, ninguna forma de `--json`
  distinta. Cambia el **valor** computado de un campo existente, que es justamente el
  bug. Contraste con `cli-detect-siblings`, que declaró `true` porque **agregaba un
  comando**. Hay una ambigüedad de fondo acá (en este repo "contrato público" puede
  significar la superficie del CLI o una API HTTP, y el paso 2 de `sdd-design` de
  ADR-030 asume lo segundo); está registrada en la §12 del plan de wiring-gaps y **no
  es de este change**. Si lo corregís a `true`, `sdd-design` va a evaluar el paso de
  authoring del contrato canónico, que no aplica: `capabilities.http: false` y no hay
  endpoints.
- *Nota al reviewer sobre `runtime_relevant_capabilities: []`:* **quinto ciclo
  consecutivo**, pero por primera vez con un criterio escrito en vez de una
  justificación ad hoc — ver `adr-cli-adapter-exclusion-criterion.md`. La diferencia
  con los 4 anteriores importa: aquéllos no tocaban `src/` en absoluto, así que "no hay
  superficie de runtime" era literalmente cierto. Este **sí** modifica comportamiento
  observable del CLI, así que el ADR exige que el `runtime-gate-report.md` registre
  **evidencia conductual real** (la invocación, antes y después) aunque el adapter
  quede `not_applicable`. Exclusión no es exención de evidencia.

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** El slug se usa como nombre de branch en `gh pr view <branch>` y
`gh pr checks <branch>`. Ya viaja como **elemento de un array**, no por shell, así que
**no hay inyección de comandos** — eso es el estado actual, no un logro de este
change. Lo que falta y este change agrega es la **validación** del slug antes de que
se convierta en argumento, replicando `isSafeSlug` (`src/tokens/packet.js:33`), que ya
guarda sus 4 call sites. Sin ella, un nombre de carpeta malformado se convierte en un
nombre de branch arbitrario. Cierra parcialmente la inconsistencia de validación entre
módulos que el Ciclo G documenta.
*Nota al reviewer sobre `security.triggers`:* se propone `[]`. El change no toca
autenticación, autorización, datos de usuario, secretos ni dependencias; agrega una
validación de entrada. Declarar un trigger distorsionaría la clasificación del gate.
**SEC-2:** **Nada se persiste.** `src/github/` es estado en vivo por diseño
(`system.md`), y este change **refuerza** esa restricción: la alternativa descartada
—registrada en el draft de ADR— era guardar la referencia al PR en el change folder.
El change modifica *qué branch* se consulta, no *qué* se consulta ni *quién* puede: no
agrega llamadas de red de un tipo nuevo, ni permisos, ni exposición de datos. El
`--json` de `status` no cambia de forma.

## Files touched

- `ninguno (sólo captura; la salida se transcribe al Execution Report)`
- `test/delivery.test.js`
- `src/github/index.js`
- `src/repos/delivery.js`
- `openspec/specs/playbooks/spec.md`
- `runtime-gate-report.md`

## Verification commands

- `(sin formatter configurado)`
- `node --check src/github/index.js`
- `node --test test/delivery.test.js`
- `npm test`
- `npm run generate:check`

## Full sources

- openspec/changes/delivery-state-branch-independence/proposal.md
- openspec/changes/delivery-state-branch-independence/tasks.md
