---
schema: proposal
schema_version: 1
change_id: runtime-coverage-per-criterion-capabilities
title: Cobertura de runtime por criterio con omisiones explícitas de capacidades
status: approved
owner: Felipe Campos
created: '2026-11-04'
updated: '2026-11-04'
impact:
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
security:
  risk: standard
  triggers: []
runtime_relevant_capabilities: []
---
# Cobertura de runtime por criterio con omisiones explícitas de capacidades

## Objective

Permitir que un change cuyos repositorios declaran varias capacidades selle
`sdd-runtime-gate` con evidencia verdadera. Hoy `validateRuntimeCoverage`
(`src/lifecycle/runtime-coverage.js`) exige que cada par criterio/repositorio mapeado mapee
**todas** las capacidades habilitadas del repositorio: un criterio que solo se ejercita por
HTTP en un repositorio con `http` y `worker` exige igualmente un recibo de `worker`. Las únicas
salidas son citar recibos no relacionados o dejar de declarar capacidades reales. El change
`lia-institutional-token-validation` del Hub LIA quedó `blocked` por esta regla con la evidencia
real ya reunida (issue fcdevxai/ai-sdd-playbooks#34).

El change alinea la implementación con ADR-043 §5 y con `openspec/specs/cli/spec.md`, que exigen
las capacidades habilitadas a nivel de adaptador, y conserva la protección por criterio: omitir
una capacidad requiere una declaración explícita con motivo en el plan.

## Guiding principle

La evidencia de un gate debe ser verdadera. Una regla que solo se puede cumplir citando
evidencia que no corresponde al criterio protege menos que una regla que exige una decisión
escrita y revisada.

## Impacted modules

- `src/lifecycle/runtime-coverage.js`: regla por criterio con omisiones explícitas y mensaje
  de mapeo contradictorio multi-repo.
- `src/tokens/handoff.js`: validación de forma de `handoff.runtime_not_applicable` y transporte
  al manifest como `runtime_not_applicable`.
- `schemas/tasks.schema.json` y `schemas/handoff-manifest.schema.json`: lista aditiva opcional.
- `skills/sdd-plan/canonical.md` y `skills/sdd-runtime-gate/canonical.md`, con sus `SKILL.md`
  regenerados.
- `test/`: pruebas de cobertura de runtime y de handoff.
- `docs/security-checklist.md`: riesgo aceptado nuevo.
- `CHANGELOG.md`, `package.json` y `package-lock.json`: release `0.12.0`.

## Impacted repos

## Files touched

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un repositorio con `http` y `worker` habilitados, un criterio mapeado solo a `http`
  y una entrada `runtime_not_applicable` para ese criterio, repositorio y `worker` con motivo,
  **when** se valida el reporte del gate con el adaptador `worker` en `passed` y evidencia ligada
  a otro criterio, **then** la validación no exige fila de `worker` para ese criterio y no
  reporta `enabled capability worker not mapped`.
- **Given** un `tasks.md` con `handoff.runtime_not_applicable`, **when** se ejecuta
  `playbook packet`, **then** el manifest incluye `runtime_not_applicable` con las mismas entradas.
- **Given** un `tasks.md` sin la lista, **when** se ejecuta `playbook packet` y se valida,
  **then** el manifest y el resultado son idénticos a los de la versión 0.11.0.

### Edge cases

- La capacidad se omite en todos los criterios del repositorio: el adaptador sigue siendo
  obligatorio y solo puede cerrarse con una exclusión a nivel de adaptador.
- Entrada multi-repo con una capacidad que uno de los repositorios no tiene: sigue fallando, y
  el mensaje pide partir la entrada por repositorio.
- Un recibo etiquetado con otro repositorio sigue sin poder cubrir la fila.

## Acceptance criteria

- **AC-1:** `tasks.md` acepta la lista opcional `handoff.runtime_not_applicable` con entradas `{criterion, repository, capability, rationale}`; el esquema rechaza entradas sin alguno de esos campos o con propiedades adicionales.
- **AC-2:** `playbook packet` copia la lista al handoff manifest como `runtime_not_applicable`; si la lista falta o está vacía, el manifest no incluye el campo y no cambia respecto de la versión 0.11.0.
- **AC-3:** Un par criterio/repositorio mapeado que omite una capacidad habilitada mediante una entrada válida no produce `enabled capability … not mapped` y no exige fila de cobertura para esa capacidad.
- **AC-4:** Sin entrada de omisión, una capacidad habilitada sin mapear sigue produciendo `enabled capability … not mapped`.
- **AC-5:** Toda capacidad habilitada de todo repositorio impactado sigue exigiendo un adaptador `passed` con recibos ligados a su cobertura o `not_applicable` con exclusión válida, aunque esté omitida en todos los criterios.
- **AC-6:** El error de mapeo contradictorio de una entrada multi-repo nombra el criterio, el repositorio y la capacidad, e indica partir la entrada por repositorio.
- **AC-7:** `skills/sdd-plan/canonical.md` explica cómo escribir `runtime_coverage` multi-repo y `runtime_not_applicable`; `skills/sdd-runtime-gate/canonical.md` explica que las omisiones no requieren fila de cobertura y que `--repo` de `playbook run` es el sistema probado aunque el comando corra en el contenedor de otro repositorio; `npm run generate` no deja diferencias.
- **AC-8:** Un ADR complementa ADR-043 §5 con la regla por criterio, sin editar ADR-043.
- **AC-9:** `package.json` y `package-lock.json` declaran `0.12.0` y `CHANGELOG.md` describe el cambio y su compatibilidad.
- **AC-10:** `node --test` termina en verde.

## Error cases

- **EC-1:** Una omisión con `rationale` vacío o solo con espacios se reporta con un mensaje que nombra criterio, repositorio y capacidad.
- **EC-2:** Una omisión de un par criterio/repositorio que no está mapeado en `runtime_coverage` se reporta como error.
- **EC-3:** Una omisión de una capacidad deshabilitada o desconocida en ese repositorio se reporta como error.
- **EC-4:** Una capacidad mapeada y omitida a la vez para el mismo par se reporta como error.
- **EC-5:** Una omisión con criterio o repositorio desconocidos se reporta como error.
- **EC-6:** Dos omisiones para el mismo criterio, repositorio y capacidad se reportan como error.
- **EC-7:** Si `handoff.runtime_not_applicable` no es una lista o contiene entradas que no son objetos, `playbook packet` falla con un mensaje y el validador lo reporta como problema, sin excepción no controlada.

## Security considerations

- **SEC-1:** No se manejan secretos, credenciales ni datos personales: el único dato nuevo es el texto de motivo en `tasks.md`, versionado y aprobado por una persona.
- **SEC-2:** La relajación no admite omisiones silenciosas: toda omisión es explícita, se valida contra el mapa de cobertura y las capacidades del repositorio, y queda cubierta por el hash del handoff manifest (modelo de amenaza de ADR-043: errores honestos de agentes o personas).
- **SEC-3:** La exigencia por adaptador no cambia: ninguna capacidad habilitada de un repositorio impactado queda sin evidencia relacionada ni exclusión validada.
- **SEC-4:** Entradas malformadas fallan cerradas: producen problemas reportados, nunca una aceptación ni una excepción no controlada.
- **SEC-5:** La veracidad del motivo de una omisión no es verificable por máquina, igual que el de `non_runtime`; se registra como riesgo aceptado en `docs/security-checklist.md`.

## Constraints and non-goals

- Sin cambios a la regla `receipt.repository === row.repository`.
- Sin aceptar combinaciones repositorio × capacidad deshabilitadas.
- Sin salida adicional en `playbook validate` ni en `playbook status`.
- Sin cambios al adaptador `cli`, que sigue experimental; `runtime_relevant_capabilities: []`
  lo deja excluido según ADR-032, con pruebas unitarias que fallan contra el código anterior.
- Sin editar ADR-043 ni la spec permanente `openspec/specs/cli/spec.md`: la spec cambia en
  `sdd-archive`.
- Sin corregir el mapa de `lia-institutional-token-validation`: se hace en el Hub LIA cuando este
  change esté mergeado y el `playbook` global actualizado.
- Sin tocar el checkout principal de `~/ai-sdd-playbooks`: el trabajo vive en el worktree
  `~/ai-sdd-playbooks-wt/runtime-coverage-per-criterion-capabilities`.
- Sin push ni pull request sin aprobación explícita.

## Open technical decisions
