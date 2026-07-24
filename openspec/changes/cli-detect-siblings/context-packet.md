---
sources:
  proposal: 591f525d6c6c0fcf05ab54ca9c2001be99c21a6092364109d20e31bc55ccc495
  tasks: b5276dd7b9f4c8c25b7edff964902dbf1c865d16fe1d14b849af3f4c906ee67e
---
# Context Packet — Comando CLI `playbook detect-siblings`

## Ticket

cli-detect-siblings

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

## Files touched

- `src/cli/repos.js`
- `src/cli/dispatch.js`
- `test/repos.test.js`
- `skills/sdd-bootstrap-project/canonical.md`

## Verification commands

- `docs/doc_verification_guide.md`
- `node --check src/cli/repos.js`
- `node --check src/cli/dispatch.js`
- `node --test test/repos.test.js`
- `node --test test/skill-contract.test.js`
- `npm test`
- `standard`

## Full sources

- openspec/changes/cli-detect-siblings/proposal.md
- openspec/changes/cli-detect-siblings/tasks.md
