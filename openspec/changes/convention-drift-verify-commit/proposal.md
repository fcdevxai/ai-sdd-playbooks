---
schema: proposal
schema_version: 1
change_id: convention-drift-verify-commit
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
impact:            # any true → sdd-design becomes required
  public_contract: false
  data_model: false
  architecture_boundary: true   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: []     # PROPUESTO — ver nota al reviewer en SEC-1
runtime_relevant_capabilities: []   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
---

# Restaurar `pwd` en `sdd-verify` y el retry cap en `sdd-commit`

## Objective

Dos convenciones que **ADR-011 (`accepted`) decidió y nombra explícitamente** no
llegaron a los prompts que se ejecutan. Verificado sobre `main` en `7054b9e`:

1. **`pwd` en `sdd-verify`.** ADR-011 `## Decision` línea 27: "`sdd-apply` **y
   `sdd-verify`**, al ejecutar esos comandos, deben verificar el cwd (`pwd`) antes
   de correrlos y nunca asumir el cwd heredado del paso o tarea anterior".
   `openspec/specs/playbooks/spec.md:77` dice lo mismo. `grep -c pwd
   skills/sdd-verify/canonical.md` = **0** (`sdd-apply` = 2).
2. **Retry cap en `sdd-commit`.** ADR-011 `## Decision` línea 19: "`sdd-new` y
   **`sdd-commit`**: máximo 3 iteraciones del loop fix→`validate`→re-run".
   `spec.md:57` dice lo mismo. `grep -c` del cap en
   `skills/sdd-commit/canonical.md` = **0** (`sdd-new` = 8).

Es el mismo patrón que este plan de trabajo viene cerrando: la capacidad está
decidida y documentada, pero **el prompt no la contiene**, así que no ocurre. Son
los dos últimos gaps catalogados.

**Matiz que no hay que perder:** `sdd-commit` hoy dice "Run `playbook validate` —
stop on any violation". No hay loop. Así que este change **introduce
comportamiento**, no sólo alinea texto: pasa de un stop inmediato a un fix
acotado. Eso abre la pregunta que ADR-011 no responde —*qué* puede arreglar el
loop— y de ahí sale el ADR draft de este change.

## Guiding principle

**Las skills se regeneran, no se editan a mano** (Principio 1): toda edición va en
`skills/<slug>/canonical.md` + `npm run generate`; `SKILL.md` es derivado y
`generate:check` no debe reportar drift.

Los dos wirings se **restauran desde la intención original verificada**, no se
reinventan: `specloom/framework/playbooks/sdd-verify/canonical.md` tenía `pwd` en
3 lugares (líneas 44, 73, 132) y su `sdd-commit` tenía el cap en 2 (líneas 55,
147). Del texto de specloom se replica también el *guard language*, no sólo el
número: "fix the reported issues and re-run — **don't reason about the reports
yourself**" y "at the 4th failed attempt, stop … **without further blind
edits**". Un cap sin ese guard invita justamente a lo que hay que evitar.

Enforcement: **wiring + test de contenido**, el gate mecánico que impide que un
merge futuro los vuelva a borrar en silencio.

## Impacted modules

- `skills/sdd-verify/canonical.md`: chequeo de `pwd` antes de los comandos de
  feature (paso 1), antes de los de regresión (paso 5), y como regla en
  `## Rules`. El wording nombra `tasks.md` **y** `context-packet.md`.
- `skills/sdd-commit/canonical.md`: loop acotado en 3 iteraciones en el paso 1,
  con el guard de no razonar sobre los reportes ni hacer ediciones a ciegas, la
  restricción de alcance (sólo regeneración determinista), y su regla en
  `## Rules`.
- `skills/{sdd-verify,sdd-commit}/SKILL.md`: regenerados vía `npm run generate`.
- `test/skill-contract.test.js`: aserciones de contenido que blindan los wirings.
- `openspec/changes/convention-drift-verify-commit/adr-retry-loop-never-mutates-signed-artifacts.md`:
  draft de ADR (lo numera y promueve `sdd-archive`).

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

No aplica: single-repo (`playbook-ai`).

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un change ya mergeado, **When** corre `sdd-verify`, **Then** el skill
  instruye verificar `pwd` antes de correr los comandos de feature y antes de los
  de regresión, sin asumir el cwd heredado del paso anterior.
- **Given** que `playbook validate` falla en `sdd-commit` por un artefacto
  derivado regenerable (típicamente `context-packet.md` stale), **When** corre el
  paso 1, **Then** el skill regenera con `playbook packet <change-id>` y reintenta
  `validate`, hasta 3 iteraciones.
- **Given** que `validate` falla por algo que exigiría editar `proposal.md`,
  `design.md`, `tasks.md` o un reporte de gate, **When** corre el paso 1,
  **Then** el skill se detiene y reporta qué artefacto y qué issue, **sin consumir
  una iteración** y sin editar nada.

### Edge cases

- **Given** 3 iteraciones agotadas, **When** `validate` sigue fallando, **Then**
  stop/report con la salida textual de `validate`, sin más ediciones. El cap
  **nunca aborta el trabajo**: es stop/report y espera instrucción humana; si el
  humano decide continuar, eso resetea el contador conscientemente (ADR-011).
- **Given** comandos de un `tasks.md`/`context-packet.md` viejo que asumen un `cd`
  previo, **When** `sdd-verify` los corre, **Then** el chequeo de `pwd` actúa como
  fallback defensivo, sin reescribir retroactivamente el ticket
  (`spec.md:78`).
- **Given** un artefacto cuyo tipo no está clasificado como regenerable,
  **When** `validate` falla por él, **Then** se trata como firmado — el default es
  el lado estricto, así que detiene el loop en vez de editarlo.

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** `skills/sdd-verify/canonical.md` instruye verificar `pwd` antes de los
comandos de feature y antes de los de regresión, y lo repite como regla en
`## Rules`.
**AC-2:** ese wording nombra `context-packet.md` además de `tasks.md` — post
Ciclo A los comandos de verificación salen del packet.
**AC-3:** `skills/sdd-commit/canonical.md` acota el loop fix→`validate`→re-run en
3 iteraciones y describe el stop/report del 4º intento con la salida textual de
`validate`.
**AC-4:** incluye el guard de no razonar sobre los reportes por cuenta propia ni
hacer ediciones a ciegas.
**AC-5:** restringe el loop a regeneración determinista (`playbook packet`) y
prohíbe editar `proposal.md`, `design.md`, `tasks.md` o un reporte de gate para
hacer pasar `validate`.
**AC-6:** `npm run generate:check` no reporta drift entre los `canonical.md` y los
`SKILL.md` de los dos skills tocados.
**AC-7:** `test/skill-contract.test.js` incluye aserciones que fallan si se borra
cualquiera de los wirings de AC-1..AC-5; `npm test` queda verde.

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1. -->

**EC-1:** `validate` falla por algo no regenerable → stop inmediato, sin consumir
iteraciones del cap, nombrando el artefacto y el issue.
**EC-2:** 3 iteraciones agotadas → stop/report con la salida de `validate` tal
cual, sin más ediciones a ciegas.
**EC-3:** si un merge futuro borra cualquiera de los dos wirings,
`test/skill-contract.test.js` falla nombrando la aserción rota — en vez de volver
al estado actual (convención en el ADR y en la spec, ausente en el prompt).
**EC-4:** si `canonical.md` y `SKILL.md` quedan desincronizados, `npm run
generate:check` falla reportando el drift.

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** El loop nuevo **nunca** debe hacer pasar `validate` debilitando el
status de un reporte de gate — en particular flipear `security-report.md` a
`passed`. Es el análogo, en la etapa de delivery, del guard de ADR-011 (`##
Decision`, línea 22) que impide que el cap de TDD marque completa una tarea con su
test de seguridad en rojo: **un presupuesto de reintentos nunca es razón para
debilitar una regla de seguridad**. Refuerza la regla que `sdd-commit` ya tiene
("Do not commit around a blocking finding"). La regla se escribe **dentro** de la
instrucción, no sólo acá, y AC-5 la blinda con un test de contenido.
*Nota al reviewer sobre `security.triggers`:* se propone `[]`. El trigger describe
lo que el change **toca**, y este no maneja secretos, permisos ni datos: agrega
una prohibición. Declararlo distorsionaría la clasificación del gate. Corregir si
preferís el criterio conservador.
**SEC-2:** Superficie del change: cero cambios en `src/`. Sólo prosa de
`canonical.md`, sus `SKILL.md` derivados y tests. Sin input externo, permisos,
persistencia ni lógica de autenticación/autorización. El chequeo de `pwd` es
**defensivo**: reduce el riesgo de ejecutar un comando de verificación en el
directorio equivocado, que es el modo de falla que ADR-011 quería cerrar.

## Constraints and non-goals

- **No-goal:** tocar `sdd-apply` y `sdd-new` — ya tienen sus convenciones
  (`pwd` y el cap respectivamente) y son la fuente de la que se replica.
- **No-goal:** los demás topes de ADR-011. El de `sdd-enrich-us` (4 rondas de
  Q&A) ya está presente; el de `sdd-apply` (2 reintentos de TDD) también.
- **No-goal:** parametrizar los topes en `playbook.config.yaml`. ADR-011 lo deja
  explícitamente para una fase futura del roadmap de tokens: "los topes viven como
  texto en los propios `canonical.md`".
- **No-goal:** superseder ADR-011. El ADR draft de este change lo **complementa**
  con la dimensión de alcance que ADR-011 no cubre; sus caps, su semántica de
  stop/report y el reset del contador quedan intactos.
- **No-goal:** tocar `src/`, `schemas/` o `templates/`. Ningún cambio de código.
- **No-goal:** actualizar `openspec/specs/playbooks/spec.md:57`/`:77` en esta
  feature — es trabajo del archive, que además debe sumarles la restricción de
  alcance nueva.
- **Constraint:** las skills se editan sólo en `canonical.md` + `npm run
  generate`; `SKILL.md` es derivado.
- **Constraint:** el wording se replica de specloom (la referencia de intención
  original), incluido el guard language — no se inventa una variante.
- *Nota al reviewer sobre `impact.architecture_boundary: true`:* se propone `true`
  **por el ADR draft, no por los dos wirings**. Los wirings son restauración pura
  de ADR-011 (que en el Ciclo A justificó todos los impacts en `false`), pero la
  decisión 4 —qué puede mutar un skill de delivery— es una **convención
  transversal nueva**, más estricta que ADR-011. Es el mismo criterio que se aplicó
  en el Ciclo C (`contract-first-authoring`): convención nueva + ADR → boundary
  true; restauración sin ADR → todo false. Consecuencia si lo confirmás:
  `design_required: true`, así que `playbook next` rutea a `sdd-design` antes de
  `sdd-plan`. Si lo corregís a `false`, se saltea el diseño y el resto del ciclo no
  cambia.
- *Nota al reviewer sobre `runtime_relevant_capabilities: []`:* mismo criterio y
  precedente que `cli-detect-siblings`, `token-saving-parity` y
  `contract-first-authoring`. La única capability habilitada es `cli: true`, cuyo
  adapter de runtime-gate es un harness E2E experimental no implementado que
  bloquearía (`ADAPTER_NOT_IMPLEMENTED`) cualquier change que lo declare
  relevante. Este change no toca `src/` en absoluto, así que no hay superficie de
  runtime que ejercitar. **Es el cuarto ciclo consecutivo declarándolo `[]` por el
  mismo motivo** — ver el hallazgo 7 de la §8 del plan de wiring-gaps: amerita
  decidir aparte si el harness `cli` se implementa o si la exclusión se documenta
  como la vía normal.

## Open technical decisions

<!-- Empty if none. -->

Ninguna. La única decisión abierta que tenía el ciclo (qué puede arreglar el loop
de `sdd-commit`) se cerró en `sdd-enrich-us` y está registrada en el draft de ADR
con sus tres alternativas descartadas.

**Nota de dogfooding:** es el primer ciclo que arranca con las skills instaladas
al día (`playbook install` corrido antes de empezar, verificado byte a byte contra
`main`). Los dos wirings de este change **no** se ejercitan sobre sí mismos salvo
que se reinstale antes del `sdd-verify` post-merge; si no se reinstala, ese
`sdd-verify` corre con el estado viejo (sin el chequeo de `pwd`). La verificación
de AC-1..AC-5 es por test de contenido, no por ejecución.
