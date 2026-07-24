---
schema: tasks
schema_version: 1
change_id: cli-detect-siblings
status: passed
updated: 2026-07-24
---
# Tasks — Comando CLI `playbook detect-siblings`

## Rules

- Every task must have a verifiable success criterion; never mix unrelated layers
  in one task if it makes verification non-atomic.
- Do not plan changes to files outside `## Constraints and non-goals`.
- State inter-task dependencies explicitly.
- Any task implementing a `## Security considerations` entry (`SEC-N`) must name
  its negative test as part of its success criterion. (SEC-1 is "Not applicable"
  — read-only command, no new sensitive surface; no negative security test applies.)

## Preconditions (self-check)

`proposal.status == approved` ✓ y `design.status == approved` ✓ (confirmado con
`playbook validate cli-detect-siblings --precondition sdd-plan`).

## Phase 1 — Core implementation

### Task 1.1 — Comando CLI `detect-siblings` (handler + registro + tests) [x]
- **Files**: `src/cli/repos.js`, `src/cli/dispatch.js`, `test/repos.test.js`
- **Detalle**:
  - En `src/cli/repos.js`: `import { detectSiblingRepos } from '../config/detect-siblings.js';`
    y nuevo export `detectSiblingsCommand(parsed, io)` — resuelve `cwd`, llama
    `detectSiblingRepos({ cwd })`, imprime JSON con `--json` o texto legible por
    default (encabezado + una línea por candidato; línea "No git-repo siblings
    found in <parentDir>" si vacío), `return EXIT.OK` (try/catch → `EXIT.VIOLATION`).
  - En `src/cli/dispatch.js`: 4 puntos — import de `./repos.js`, `'detect-siblings'`
    en `COMMAND_NAMES` (tras `changed-files`), línea en `COMMAND_SUMMARIES`, entrada
    en `HANDLERS`.
- **Success criterion (test-first)**: nuevos tests en `test/repos.test.js` (usando
  `run([...], io)` con `--cwd` a un tmp dir) que, corridos con
  `node --test test/repos.test.js`, verifican: (a) `--json` devuelve la forma
  `{ ownName, parentDir, candidates }`; (b) texto por default lista una línea por
  candidato; (c) padre sin siblings git → `candidates` vacío y `EXIT.OK`. Escribir
  los tests primero (rojo), luego el handler+registro hasta verde.
- **Linked acceptance criterion**: AC-1, AC-2, AC-3, AC-4

### Task 1.2 — Cablear el skill + regenerar + test de contrato [x]
- **Files**: `skills/sdd-bootstrap-project/canonical.md`,
  `skills/sdd-bootstrap-project/SKILL.md`, `test/skill-contract.test.js`
- **Detalle**:
  - `canonical.md` paso 3: reemplazar la instrucción de ejecutar `detectSiblingRepos`
    por "correr `playbook detect-siblings` (`--json` para consumo programático)".
    `detectSiblingRepos` puede quedar como contexto explicativo, no como la cosa a
    ejecutar. Conservar la instrucción de re-run de ADR-028.
  - Regenerar `SKILL.md` con `npm run generate`.
  - `test/skill-contract.test.js`: aserción de contenido — el `SKILL.md` de
    `sdd-bootstrap-project` referencia `playbook detect-siblings`.
- **Success criterion (test-first)**: la aserción nueva en `skill-contract.test.js`
  se confirma **roja** contra el `SKILL.md` actual (antes de editar canonical),
  luego **verde** tras editar canonical + regenerar. `npm run generate:check` sin
  drift. La aserción falla si se quita el wiring (EC-1); el drift falla `generate:check` (EC-2).
- **Linked acceptance criterion**: AC-5, AC-6, AC-7
- **Depends on**: Task 1.1 (el comando debe existir antes de instruir invocarlo)

## Phase 2 — Quality gates

- **Format**: sin formatter configurado (`docs/doc_verification_guide.md`) — n/a.
- **Lint/type-check**: `node --check src/cli/repos.js` y `node --check src/cli/dispatch.js` (archivos JS tocados).
- **Feature tests**: `node --test test/repos.test.js` y `node --test test/skill-contract.test.js`.
- **Drift check**: `npm run generate:check`.
- **Regression**: `npm test` (riesgo `standard`, sin triggers de seguridad — la suite completa alcanza).

## Execution Report

**Approach**: TDD por tarea. Task 1.1: 3 tests nuevos en `test/repos.test.js`
(texto, `--json`, edge sin siblings) escritos primero y confirmados **rojos**
(3 fail, comando inexistente → `unknown command`), luego handler en
`src/cli/repos.js` + registro en `src/cli/dispatch.js` hasta verde. Task 1.2:
aserción de contenido en `test/skill-contract.test.js` confirmada **roja**
contra el `SKILL.md` viejo, luego editado `canonical.md` paso 3 + `npm run
generate` → verde.

| AC | Evidencia |
|---|---|
| AC-1 | `detect-siblings` en `dispatch.js` (COMMAND_NAMES + COMMAND_SUMMARIES + HANDLERS + import); `node bin/playbook.js --help` lo lista. |
| AC-2 | Test "`--json` emits the detector object" → `{ownName, parentDir, candidates}` con `candidates` incluyendo `backend`. Verificado también manual con `--cwd` absoluto (detecta lablab-playbook-ai + specloom). |
| AC-3 | Test "lists git-repo siblings (text)" → una línea por candidato con stack + hints. |
| AC-4 | Test "no git siblings → empty candidates, exit 0" → `candidates: []`, `EXIT.OK`. |
| AC-5 | `canonical.md` paso 3 ahora invoca `playbook detect-siblings --json`; `detectSiblingRepos` queda solo como contexto explicativo. |
| AC-6 | `npm run generate:check` sin drift (`.specloom/runs/1784909393980-0a68d601`). |
| AC-7 | Test de contrato "invokes the `playbook detect-siblings` command" (rojo→verde). |

**Comandos** (vía `playbook run --change cli-detect-siblings --step apply --`):
- `node --test test/repos.test.js` → 43/43 (los 3 nuevos rojos antes del handler)
- `npm run generate` + `npm run generate:check` → sin drift
- `node --test test/skill-contract.test.js` → verde (aserción nueva rojo→verde)
- `node --check src/cli/repos.js` y `src/cli/dispatch.js` → OK
- `npm test` → 330/330

**Nota de scope**: se actualizó también `test/dispatch.test.js` (no listado
explícito en `## Impacted modules`, que decía "test/" + los dos named). Es una
consecuencia **mecánica necesaria** de registrar el comando: ese test fija la
lista exacta de `COMMAND_NAMES` y falla si no se agrega el nuevo comando. Es el
mismo dominio que estoy cambiando (la superficie del CLI), no una feature nueva.

**Seguridad**: SEC-1 "Not applicable" — comando read-only, sin superficie
sensible nueva; no aplica test negativo. `src/config/detect-siblings.js`
intacto.

**ADR**: sin STOP durante la implementación; `adr-skills-invoke-via-cli-commands.md`
(creado en sdd-new) cubre la decisión transversal sin cambios.
