---
sources:
  proposal: 266bc424c5558d2793808c37fa591f7d4a3a00558ba2ca79c40621a01f5feb8d
  tasks: 2553b6bc168296a1587f151eeb44b8e894a86fabe45b6814a30c1b0033bf9b40
---
# Context Packet — Cablear la política de tokens y seguridad en los playbooks

## Ticket

wire-token-and-security-policy

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** Los 3 gates (`sdd-code-review`, `sdd-security-gate`, `sdd-runtime-gate`) instruyen diff-first — `grep -l 'changed-files' skills/sdd-code-review skills/sdd-security-gate skills/sdd-runtime-gate` da los tres (hoy: 0).
**AC-2:** Los playbooks de lectura de specs (los 3 gates + `sdd-verify` + `sdd-commit`) instruyen `spec-read` (grep > 0); `sdd-apply` y `sdd-archive` NO lo instruyen.
**AC-3:** `sdd-verify/canonical.md` contiene el paso de re-correr los negativos `SEC-N` post-merge y su template del reporte trae la tabla `## Security considerations`.
**AC-4:** `playbook validate` **falla** un `verification-report.md` sin `## Security considerations` (o con la sección vacía) y **acepta** uno completo.
**AC-5:** `sdd-enrich-us/canonical.md` lista "Security and data sensitivity" como dimensión de decisión obligatoria.
**AC-6:** `npm run generate:check` no reporta drift tras regenerar los `SKILL.md`.

## Constraints and non-goals

- **No-goal:** cambiar lógica del motor, delivery, o cualquier invariante conservado (packet-verbatim, planner-only, riesgo monótono, inmutabilidad de ADRs — Principio 4).
- **No-goal:** editar `SKILL.md` a mano — solo `canonical.md` + `npm run generate` (Principio 1).
- **No-goal:** aplicar section-first a `sdd-apply`/`sdd-archive` (necesitan contexto completo, como en specloom).
- **Constraint:** `validateVerificationBody` sigue el mismo patrón que `validateProposalBody` (secciones presentes + no vacías; "Not applicable: <razón>" cuenta como contenido válido).
- **Nota al reviewer (runtime_relevant_capabilities):** se propone `[]` (mismo criterio que Fase 1/2). Este change edita playbooks (texto) + un helper de validación puro; no agrega ni ejercita comportamiento de runtime. El adapter `cli` es experimental (nunca `passed`); declararlo relevante bloquearía `sdd-runtime-gate` sin harness real. La conducta se cubre con `test/schema.test.js` (validateVerificationBody) + `test/skill-contract.test.js` (asserts de contenido). **Confirmá o corregí al aprobar.**

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** **El hilo de seguridad no puede desconectarse silenciosamente.** El enforcement (`validateVerificationBody` + cableado en `validate.js`) convierte la sección de seguridad del `verification-report.md` en un requisito duro: un reporte sin evidencia de seguridad **falla la validación**. Test negativo: un reporte sin `## Security considerations` es rechazado por `playbook validate`.
**SEC-2:** **Diff-first no debilita el juicio de seguridad.** La directiva diff-first se agrega preservando **explícitamente** el derecho del `sdd-security-gate` a full-read en superficie sensible (autorización/ownership/input). Test de contenido: el `canonical.md` del security gate conserva la cláusula de full-read en superficie sensible junto a la directiva diff-first.
**SEC-3:** **`verify` valida contra el código mergeado, no contra el reporte pre-merge.** El paso nuevo re-corre los tests negativos de cada `SEC-N` contra el estado post-merge; la regla dura marca `status: failed` ante cualquier `SEC-N` sin evidencia. No se confía en aserciones previas al merge.

## Files touched

- `src/schema/body-rules.js`
- `src/cli/validate.js`
- `test/schema.test.js`
- `skills/sdd-code-review/canonical.md`
- `skills/sdd-security-gate/canonical.md`
- `skills/sdd-verify/canonical.md`
- `test/skill-contract.test.js`
- `skills/sdd-enrich-us/canonical.md`
- `SKILL.md`

## Verification commands

- `(sin formatter configurado — N/A)`
- `node --check src/schema/body-rules.js && node --check src/cli/validate.js`
- `node --test test/schema.test.js && node --test test/skill-contract.test.js`

## Full sources

- openspec/changes/wire-token-and-security-policy/proposal.md
- openspec/changes/wire-token-and-security-policy/tasks.md
