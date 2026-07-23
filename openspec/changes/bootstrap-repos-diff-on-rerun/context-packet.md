---
sources:
  proposal: 94cc17f318eb9305fa66b1345e1676aac2272fc2f15131b80181af8d2a9202f1
  tasks: b94f666361f70577ed4578b52916ee83ac3897f2fb369715c8b0b196c37491ca
---
# Context Packet — Detectar repos hermanos nuevos en re-ejecuciones de sdd-bootstrap-project

## Ticket

bootstrap-repos-diff-on-rerun

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** `skills/sdd-bootstrap-project/canonical.md` paso 3 instruye
explícitamente re-invocar el detector en cada re-ejecución, incluso cuando
`repos:` ya tiene entradas, y presentar el diff contra lo ya confirmado.
**AC-2:** El texto del paso 3 aclara que un `repos:` ya poblado nunca es, por
sí solo, motivo para saltear la re-detección.
**AC-3:** `skills/sdd-bootstrap-project/SKILL.md` refleja el mismo texto tras
`npm run generate` (sin drift vs. `canonical.md`).
**AC-4:** `test/skill-contract.test.js` incluye una aserción que falla si la
instrucción de re-scan-en-re-run se elimina del `canonical.md`/`SKILL.md`.
**AC-5:** `npm run generate:check` no reporta drift tras regenerar.

## Constraints and non-goals

- **No-goal:** detectar repos previamente confirmados que fueron eliminados o
  renombrados — se trata como una decisión separada, no incluida acá.
- **No-goal:** aplicar la misma corrección de re-run a los pasos 2
  (capabilities) y 4 (document mappings) del mismo skill — si el mismo patrón
  existe ahí, se reporta como hallazgo independiente.
- **No-goal:** cambiar `detect-siblings.js` — ya es correcto y stateless;
  `test/detect-siblings.test.js` sigue en verde sin modificaciones.
- **Constraint:** el fix no cambia el contrato diff-then-approve — sigue sin
  escribir nada sin aprobación humana explícita.
- **Nota al reviewer (runtime_relevant_capabilities):** se propone `[]`. Este
  change edita un playbook (texto) + un test de contenido; no agrega ni
  ejercita comportamiento de runtime de ningún adapter. **Confirmá o corregí
  al aprobar.**

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** Not applicable — este change es texto de instrucciones para un
skill de IA (prompt engineering) más una aserción de test de contenido. No
introduce, mueve, ni expone secretos, credenciales, datos personales, ni
lógica de autenticación/autorización. `detectSiblingRepos` sigue siendo una
inspección de solo lectura del filesystem local (nombres de directorio y
presencia de `.git/`); el fix no cambia qué se lee ni qué se escribe, solo
cuándo el modelo re-invoca esa lectura y qué subconjunto de su salida se le
muestra al humano para aprobación. El humano sigue siendo quien aprueba
cualquier escritura a `playbook.config.yaml` (contrato diff-then-approve, sin
cambios).

## Files touched

- `skills/sdd-bootstrap-project/canonical.md`
- `skills/sdd-bootstrap-project/SKILL.md`
- `test/skill-contract.test.js`

## Verification commands

- `docs/doc_verification_guide.md`
- `node --check skills/sdd-bootstrap-project/canonical.md`
- `node --check src/generator/generate-skills.js`
- `node --test test/skill-contract.test.js`
- `npm test`
- `standard`
- `triggers`

## Full sources

- openspec/changes/bootstrap-repos-diff-on-rerun/proposal.md
- openspec/changes/bootstrap-repos-diff-on-rerun/tasks.md
