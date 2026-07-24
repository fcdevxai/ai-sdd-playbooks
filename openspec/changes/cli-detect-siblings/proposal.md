---
schema: proposal
schema_version: 1
change_id: cli-detect-siblings
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
impact:            # any true → sdd-design becomes required
  public_contract: true
  data_model: false
  architecture_boundary: false
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
runtime_relevant_capabilities: []   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
---

# Comando CLI `playbook detect-siblings`

## Objective

`sdd-bootstrap-project` paso 3 instruye correr el detector
`detectSiblingRepos` (`src/config/detect-siblings.js`) — una función JS interna
que **ningún comando CLI expone** (no hay comando `detect-*` en
`src/cli/dispatch.js`). El agente que ejecuta el skill tiene que correr JS a
mano o mirar el directorio padre a ojo: frágil y no determinista. Es parte de
lo que hizo tan fácil introducir el bug de ADR-028 (el fix instruye "re-invocar
el detector" sin un mecanismo limpio de invocación).

Este change agrega `playbook detect-siblings` — un wrapper read-only sobre la
función ya existente — y cablea el paso 3 del skill para invocar el comando en
vez de la función JS.

## Guiding principle

**Las skills se regeneran, no se editan a mano** (Principio 1): la edición del
skill es en `canonical.md` + `npm run generate`; `generate:check` no debe
reportar drift. El comando es un **wrapper fino** que sigue el patrón ya
establecido en `src/cli/repos.js` (`repo-plan`/`commit-plan`): flags
`--cwd`/`--json`, salida JSON + texto legible, EXIT codes. La lógica de
detección (`detectSiblingRepos`) **no se toca** — ya existe y está testeada.

## Impacted modules

- `src/cli/repos.js`: nuevo handler `detectSiblingsCommand`, wrapper read-only
  sobre `detectSiblingRepos({ cwd })`.
- `src/cli/dispatch.js`: registrar `'detect-siblings'` en `COMMAND_NAMES`, su
  línea de descripción, y el mapa de handlers.
- `skills/sdd-bootstrap-project/canonical.md`: paso 3 invoca `playbook
  detect-siblings` en vez de referenciar `detectSiblingRepos` por nombre/ruta
  como cosa a ejecutar; se mantiene la instrucción de re-run de ADR-028.
- `skills/sdd-bootstrap-project/SKILL.md`: regenerado vía `npm run generate`.
- `test/`: test del comando (happy path + `--json` + parent sin siblings) +
  `test/skill-contract.test.js` (el skill referencia el comando).

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

No aplica: single-repo (`playbook-ai`).

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un repo con repos hermanos git en el directorio padre, **When**
  corro `playbook detect-siblings`, **Then** imprime una línea por candidato con
  su stack guess y hints de naming (`sharedTokensWithOwn`, `cluster`).
- **Given** el mismo escenario, **When** corro `playbook detect-siblings
  --json`, **Then** devuelve el objeto de `detectSiblingRepos`
  (`{ ownName, parentDir, candidates }`) como JSON.

### Edge cases

- **Given** un directorio padre sin repos git hermanos, **When** corro el
  comando, **Then** `candidates` sale vacío, exit 0, sin error.
- El comando es **read-only**: nunca escribe `playbook.config.yaml` ni nada.

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** `playbook detect-siblings` está registrado en `src/cli/dispatch.js`
(`COMMAND_NAMES` + descripción + handler) y aparece en el `--help`.
**AC-2:** con `--json` devuelve el objeto de `detectSiblingRepos`
(`{ ownName, parentDir, candidates }`).
**AC-3:** sin `--json` imprime texto legible: una línea por candidato con stack
+ hints de naming.
**AC-4:** con el directorio padre sin repos git hermanos, `candidates` sale
vacío y el exit code es 0.
**AC-5:** `skills/sdd-bootstrap-project/canonical.md` paso 3 invoca `playbook
detect-siblings` y ya **no** referencia "`detectSiblingRepos` in
`src/config/detect-siblings.js`" como la cosa a ejecutar (sí puede mencionarlo
como contexto explicativo).
**AC-6:** `npm run generate:check` no reporta drift entre `canonical.md` y
`SKILL.md`.
**AC-7:** `test/skill-contract.test.js` incluye una aserción que falla si el
skill deja de referenciar `playbook detect-siblings`.

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1. -->

**EC-1:** si alguien borra el wiring del comando en `canonical.md`,
`test/skill-contract.test.js` falla nombrando la aserción rota (en vez de fallar
en silencio en producción como en el bug original).
**EC-2:** si `canonical.md` y `SKILL.md` quedan desincronizados, `npm run
generate:check` falla reportando el drift.

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** Not applicable — el comando es **read-only** y solo lista nombres de
directorio y presencia de `.git/` del directorio padre, exactamente la misma
superficie que `detectSiblingRepos` ya inspeccionaba. No introduce, mueve ni
expone secretos, credenciales, datos personales, ni lógica de
autenticación/autorización; no escribe ningún archivo. La lógica de
`detect-siblings.js` no se modifica. El contrato diff-then-approve de
`sdd-bootstrap-project` no cambia: el humano sigue aprobando cualquier escritura
a `playbook.config.yaml`.

## Constraints and non-goals

- **No-goal:** modificar la lógica de `src/config/detect-siblings.js` (intacta,
  testeada en `test/detect-siblings.test.js`).
- **No-goal:** exponer `detectCapabilities` como comando propio — es uso interno
  del detector para el stack guess y no se referencia por nombre en el skill
  (posible follow-up, no acá).
- **Constraint:** el comando sigue el patrón de `src/cli/repos.js`
  (`--cwd`/`--json`, texto + JSON, EXIT codes); read-only, nunca escribe.
- **Nota al reviewer (runtime_relevant_capabilities):** se propone `[]`. Este
  change edita el CLI + texto de un skill; el adapter `cli` es experimental y no
  se ejercita como runtime gate real. **Confirmá o corregí al aprobar.**
- **Nota al reviewer (impact.public_contract):** se propone `true` porque el
  comando agrega superficie pública al CLI (análogo a `repo-plan`/`commit-plan`,
  que tuvieron ADR). Esto dispara `sdd-design`; el diseño será breve (wrapper que
  sigue un patrón ya establecido). **Confirmá o corregí al aprobar.**

## Open technical decisions

<!-- Empty if none. -->

Ninguna. La decisión transversal ("los skills invocan vía comandos `playbook`,
nunca referenciando código fuente interno") queda documentada en
`adr-skills-invoke-via-cli-commands.md`.
