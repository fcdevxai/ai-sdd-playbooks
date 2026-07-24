---
sources:
  proposal: ea3657208bbb9892256dfb42ac364d5457829aecef1babcce27c8ad2c567c336
  tasks: f325bc485276f66d38deda01a60ca63b7006d763546c0e7f133c7bf83b9147e9
---
# Context Packet — Restaurar `pwd` en `sdd-verify` y el retry cap en `sdd-commit`

## Ticket

convention-drift-verify-commit

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

## Files touched

- `test/skill-contract.test.js`
- `skills/sdd-verify/canonical.md`
- `skills/sdd-verify/SKILL.md`
- `skills/sdd-commit/canonical.md`
- `skills/sdd-commit/SKILL.md`

## Verification commands

- `(sin formatter configurado)`
- `node --check test/skill-contract.test.js`
- `node --test test/skill-contract.test.js`
- `npm test`
- `npm run generate:check`

## Full sources

- openspec/changes/convention-drift-verify-commit/proposal.md
- openspec/changes/convention-drift-verify-commit/tasks.md
