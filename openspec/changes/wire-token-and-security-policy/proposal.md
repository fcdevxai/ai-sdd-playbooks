---
schema: proposal
schema_version: 1
change_id: wire-token-and-security-policy
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
security:
  risk: standard
  triggers: []
runtime_relevant_capabilities: []   # PROPUESTO — ver nota al reviewer en "Constraints and non-goals"
---

# Cablear la política de tokens y seguridad en los playbooks

## Objective

Los comandos de eficiencia de tokens (`playbook changed-files --diff`,
`playbook spec-read <file>#<anchor>`) están completos y testeados, pero **ningún
playbook los invoca** → el ahorro nunca ocurre (grep en `skills/` = 0). Y el hilo
de seguridad **se rompe en `verify`** (no re-corre los tests negativos `SEC-N`
post-merge, confía en el reporte pre-merge) y **se debilita en `enrich`** (cayó
la dimensión de seguridad obligatoria que siembra los `SEC-N`). Este change
**cablea** esa política ya portada editando los `canonical.md` + regenerando, y
agrega el **enforcement** que impide que la sección de seguridad del
`verification-report.md` vuelva a desconectarse.

## Guiding principle

**Las skills se regeneran, no se editan a mano** (Principio 1): toda edición es en
`skills/<slug>/canonical.md` + `npm run generate`; el `SKILL.md` es artefacto y
`generate:check` no debe reportar drift. **Tests de contenido** (no solo de
comportamiento) blindan la política para que un merge futuro no la vuelva a
desconectar. **Preservar** el derecho del security gate a full-read en superficie
sensible: diff-first es el default, no una restricción sobre el juicio de seguridad.

## Impacted modules

- `skills/sdd-code-review/canonical.md`, `skills/sdd-security-gate/canonical.md`, `skills/sdd-runtime-gate/canonical.md`: **diff-first** (3a) — `playbook changed-files <change-id> --diff` primero; full-read solo si el diff toca autorización/ownership/input o no alcanza. El security gate conserva su derecho explícito a full-read en superficie sensible.
- Los mismos 3 gates + `skills/sdd-verify/canonical.md` + `skills/sdd-commit/canonical.md`: **section-first** (3b) — `playbook spec-read <file>#<anchor>`; si el anchor no existe, full-read y reportar el motivo. **Excluye** `sdd-apply` y `sdd-archive`.
- `skills/sdd-verify/canonical.md`: **reparar seguridad** (3c) — paso de re-correr los negativos de cada `SEC-N` contra el código mergeado; tabla `## Security considerations` en el template del reporte; regla dura: `SEC-N` sin evidencia post-merge → `status: failed`.
- `src/schema/body-rules.js`: (3d) `VERIFICATION_REQUIRED_SECTIONS = ['Acceptance criteria', 'Security considerations', 'Regression']` + `validateVerificationBody(body)` (mismo patrón que `validateProposalBody`).
- `src/cli/validate.js`: (3d) cablear `validateVerificationBody` en el mapa de body-validators (`'verification-report.md'`).
- `skills/sdd-enrich-us/canonical.md`: (3e) restaurar "Security and data sensitivity" como dimensión de decisión **obligatoria** antes de redactar el draft.
- Todos los `SKILL.md` afectados: regenerados por `npm run generate` (3f).

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

No aplica: el change se desarrolla íntegramente en el repo `playbook-ai` (single-repo).

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** los 3 gates, **When** grep `changed-files` sobre `skills/`, **Then** aparece la directiva diff-first en los tres (hoy: 0).
- **Given** los gates + `sdd-verify` + `sdd-commit`, **When** grep `spec-read` sobre `skills/`, **Then** aparece la directiva section-first (hoy: 0); `sdd-apply` y `sdd-archive` NO la traen.
- **Given** un `verification-report.md` con `SEC-N` declarados, **When** corre `sdd-verify`, **Then** el reporte trae la tabla `## Security considerations` (filas `SEC-N | control | test/check | passed`) y el paso re-corre los negativos post-merge.
- **Given** un `verification-report.md` **sin** `## Security considerations`, **When** corro `playbook validate`, **Then** falla con un issue accionable.
- **Given** `sdd-enrich-us`, **When** se lee su `canonical.md`, **Then** lista "Security and data sensitivity" como dimensión obligatoria.
- **Given** cualquier edición de `canonical.md`, **When** `npm run generate:check`, **Then** sin drift.

### Edge cases

- Un anchor de `spec-read` inexistente → el playbook instruye caer a full-read y reportar el motivo (no falla silenciosamente).
- Un `verification-report.md` cuya `## Security considerations` dice "Not applicable: <razón>" (sin `SEC-N` en la proposal) → `validateVerificationBody` acepta (sección presente y no vacía), igual que `validateProposalBody`.

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** Los 3 gates (`sdd-code-review`, `sdd-security-gate`, `sdd-runtime-gate`) instruyen diff-first — `grep -l 'changed-files' skills/sdd-code-review skills/sdd-security-gate skills/sdd-runtime-gate` da los tres (hoy: 0).
**AC-2:** Los playbooks de lectura de specs (los 3 gates + `sdd-verify` + `sdd-commit`) instruyen `spec-read` (grep > 0); `sdd-apply` y `sdd-archive` NO lo instruyen.
**AC-3:** `sdd-verify/canonical.md` contiene el paso de re-correr los negativos `SEC-N` post-merge y su template del reporte trae la tabla `## Security considerations`.
**AC-4:** `playbook validate` **falla** un `verification-report.md` sin `## Security considerations` (o con la sección vacía) y **acepta** uno completo.
**AC-5:** `sdd-enrich-us/canonical.md` lista "Security and data sensitivity" como dimensión de decisión obligatoria.
**AC-6:** `npm run generate:check` no reporta drift tras regenerar los `SKILL.md`.

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1. -->

**EC-1:** `verification-report.md` presente pero sin `## Security considerations` → `validateVerificationBody` devuelve `{ ok: false, issues: ['missing section: "## Security considerations"'] }` y `playbook validate` sale con código de error, nombrando la sección faltante.
**EC-2:** `verification-report.md` con `## Security considerations` presente pero vacía → issue `empty content in "## Security considerations"` (mismo patrón que las secciones requeridas de proposal).

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** **El hilo de seguridad no puede desconectarse silenciosamente.** El enforcement (`validateVerificationBody` + cableado en `validate.js`) convierte la sección de seguridad del `verification-report.md` en un requisito duro: un reporte sin evidencia de seguridad **falla la validación**. Test negativo: un reporte sin `## Security considerations` es rechazado por `playbook validate`.
**SEC-2:** **Diff-first no debilita el juicio de seguridad.** La directiva diff-first se agrega preservando **explícitamente** el derecho del `sdd-security-gate` a full-read en superficie sensible (autorización/ownership/input). Test de contenido: el `canonical.md` del security gate conserva la cláusula de full-read en superficie sensible junto a la directiva diff-first.
**SEC-3:** **`verify` valida contra el código mergeado, no contra el reporte pre-merge.** El paso nuevo re-corre los tests negativos de cada `SEC-N` contra el estado post-merge; la regla dura marca `status: failed` ante cualquier `SEC-N` sin evidencia. No se confía en aserciones previas al merge.

## Constraints and non-goals

- **No-goal:** cambiar lógica del motor, delivery, o cualquier invariante conservado (packet-verbatim, planner-only, riesgo monótono, inmutabilidad de ADRs — Principio 4).
- **No-goal:** editar `SKILL.md` a mano — solo `canonical.md` + `npm run generate` (Principio 1).
- **No-goal:** aplicar section-first a `sdd-apply`/`sdd-archive` (necesitan contexto completo, como en specloom).
- **Constraint:** `validateVerificationBody` sigue el mismo patrón que `validateProposalBody` (secciones presentes + no vacías; "Not applicable: <razón>" cuenta como contenido válido).
- **Nota al reviewer (runtime_relevant_capabilities):** se propone `[]` (mismo criterio que Fase 1/2). Este change edita playbooks (texto) + un helper de validación puro; no agrega ni ejercita comportamiento de runtime. El adapter `cli` es experimental (nunca `passed`); declararlo relevante bloquearía `sdd-runtime-gate` sin harness real. La conducta se cubre con `test/schema.test.js` (validateVerificationBody) + `test/skill-contract.test.js` (asserts de contenido). **Confirmá o corregí al aprobar.**

## Open technical decisions

<!-- Empty if none. -->

Ninguna. El plan de mejora (Fase 3) cerró el alcance; no hay decisiones difíciles
de revertir que ameriten un ADR nuevo (la eficiencia de tokens y el security gate
ya tienen ADRs migrados de specloom).
