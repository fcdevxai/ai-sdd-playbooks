---
schema: proposal
schema_version: 1
change_id: bootstrap-repos-diff-on-rerun
status: approved
owner: Bernardo Machuca
created: 2026-07-23
updated: 2026-07-23
impact:            # any true → sdd-design becomes required
  public_contract: false
  data_model: false
  architecture_boundary: false
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:          # http:true alone is NOT elevated
  risk: standard
  triggers: []
runtime_relevant_capabilities: []   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
---

# Detectar repos hermanos nuevos en re-ejecuciones de sdd-bootstrap-project

## Objective

`detectSiblingRepos` (`src/config/detect-siblings.js`) es stateless: en cada
corrida lista todos los repos git hermanos del directorio padre, sin importar
qué ya está en `playbook.config.yaml`. Pero el paso 3 del `canonical.md` de
`sdd-bootstrap-project` nunca le dice al modelo qué hacer en una re-ejecución
cuando `repos:` ya tiene entradas — el modelo interpreta razonablemente "ya
poblado" como "ya resuelto" y saltea la re-detección. En uso real, un
consumer agregó un repo hermano nuevo después del bootstrap inicial, re-corrió
el skill, y ese repo nunca fue propuesto.

Este change cierra el gap de instrucción: en toda re-ejecución, paso 3 debe
re-invocar el detector y presentar el diff contra los repos ya confirmados,
mostrando solo los candidatos nuevos.

## Guiding principle

**Las skills se regeneran, no se editan a mano** (Principio 1): la edición es
en `skills/sdd-bootstrap-project/canonical.md` + `npm run generate`; el
`SKILL.md` es artefacto derivado y `generate:check` no debe reportar drift. El
detector (`detect-siblings.js`) ya es correcto y no se toca — el fix es
puramente de instrucción, sobre cómo el modelo interpreta un config ya
poblado en un re-run.

## Impacted modules

- `skills/sdd-bootstrap-project/canonical.md`: paso 3 gana una instrucción
  explícita de re-run — siempre re-invocar `detectSiblingRepos`, diffear su
  salida contra los repos ya presentes en `playbook.config.yaml`, y presentar
  solo los candidatos no listados todavía. Un `repos:` ya poblado nunca causa
  que el paso se saltee.
- `skills/sdd-bootstrap-project/SKILL.md`: regenerado vía `npm run generate`
  a partir del `canonical.md` actualizado.
- `test/skill-contract.test.js`: gana una aserción de contenido que confirma
  que el `canonical.md` (y por lo tanto el `SKILL.md` regenerado) instruye el
  re-scan en re-run, para que un merge futuro no vuelva a desconectar esta
  política silenciosamente.

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

No aplica: single-repo (`playbook-ai`).

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un proyecto ya bootstrapeado con `repos:` poblado en
  `playbook.config.yaml`, **When** se corre `sdd-bootstrap-project` de nuevo y
  hay un repo hermano nuevo en el directorio padre, **Then** el skill lo lista
  como candidato nuevo para confirmación, sin repetir los ya confirmados como
  si fueran nuevos.
- **Given** el mismo escenario pero sin repos hermanos nuevos, **When** se
  re-corre el skill, **Then** no propone nada en el paso 3 (no hay diff) —
  comportamiento observable idéntico al actual cuando no hay cambios.
- **Given** cualquier edición del `canonical.md`, **When** `npm run
  generate:check`, **Then** sin drift.

### Edge cases

- Un repo hermano fue confirmado en el bootstrap inicial y luego eliminado del
  filesystem: fuera de alcance de este change (ver Constraints and non-goals);
  el paso 3 no lo señala como ausente.
- El directorio padre no tiene siblings git en absoluto: el paso 3 sigue sin
  proponer nada (comportamiento ya existente, sin cambios).

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

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1. -->

**EC-1:** Si alguien edita `canonical.md` y borra la instrucción de re-scan,
`test/skill-contract.test.js` falla nombrando la aserción de contenido rota,
en vez de fallar silenciosamente en producción como ocurrió en el bug
original.
**EC-2:** Si `canonical.md` y `SKILL.md` quedan desincronizados (edición
manual del `SKILL.md` sin regenerar), `npm run generate:check` falla
reportando el drift.

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

## Open technical decisions

<!-- Empty if none. -->

Ninguna. El alcance quedó cerrado en `sdd-enrich-us`; la convención transversal
sobre cómo los skills stateful deben tratar un config ya poblado en un re-run
queda documentada en `adr-stateful-rerun-diff-baseline.md`.
