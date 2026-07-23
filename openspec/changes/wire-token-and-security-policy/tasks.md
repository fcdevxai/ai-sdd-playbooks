---
schema: tasks
schema_version: 1
change_id: wire-token-and-security-policy
status: passed
updated: 2026-07-23
---
# Tasks — Cablear la política de tokens y seguridad en los playbooks

## Rules

- Cada task tiene un criterio de éxito verificable (grep de contenido o test que pasa).
- **Principio 1:** las skills se editan en `skills/<slug>/canonical.md` y se
  regeneran con `npm run generate`; los `SKILL.md` son artefactos. `generate:check`
  no debe reportar drift.
- Toda task que implementa un `SEC-N` nombra su **test negativo** como parte del
  criterio de éxito.
- Los tests de **contenido** (en `test/skill-contract.test.js`) leen el `SKILL.md`
  generado, así que el orden por playbook es: escribir el assert (rojo) → editar
  `canonical.md` → `npm run generate` → assert verde. Blindan la política contra
  una desconexión futura (riesgo transversal del plan).

## Preconditions (self-check)

`proposal.status == approved` ✓, design no requerido (todos los `impact.*` false)
— verificado con `playbook validate wire-token-and-security-policy --precondition sdd-plan`.

## Phase 1 — Enforcement de la sección de seguridad (código, TDD)

### Task 1.1 — `validateVerificationBody` + cableado en `validate` [x]
- **Files**: `src/schema/body-rules.js`, `src/cli/validate.js`, `test/schema.test.js`
- **Descripción**: agregar `VERIFICATION_REQUIRED_SECTIONS = ['Acceptance criteria',
  'Security considerations', 'Regression']` y `validateVerificationBody(body)`
  (mismo patrón que `validateProposalBody`: secciones presentes + no vacías,
  "Not applicable: …" cuenta como contenido). Cablearlo en el mapa de
  body-validators de `src/cli/validate.js` bajo `'verification-report.md'`.
- **Success criterion (TDD, tests primero)**: en `test/schema.test.js` —
  (a) `validateVerificationBody` **rechaza** un cuerpo sin `## Security considerations`
  (issue `missing section`) → **test negativo de SEC-1**; (b) rechaza uno con la
  sección vacía (issue `empty content`); (c) **acepta** un cuerpo con las tres
  secciones no vacías. `node --test test/schema.test.js` verde.
- **Linked acceptance criterion**: AC-4, EC-1, EC-2, SEC-1.

## Phase 2 — diff-first en los 3 gates (3a)

### Task 2.1 — Directiva diff-first en code-review / security-gate / runtime-gate [x]
- **Files**: `skills/sdd-code-review/canonical.md`, `skills/sdd-security-gate/canonical.md`,
  `skills/sdd-runtime-gate/canonical.md`, `test/skill-contract.test.js`
- **Descripción**: reemplazar "read every file listed as created/modified" (donde
  aparezca) por la directiva: "Corré `playbook changed-files <change-id> --diff`
  primero; leé el archivo completo **solo** si el diff toca autorización/ownership/
  input o no alcanza para juzgar." En `sdd-security-gate`, **preservar
  explícitamente** el derecho a full-read en superficie sensible junto a la directiva.
- **Success criterion**: assert de contenido (parity checklist de
  `test/skill-contract.test.js`) — el `SKILL.md` de los 3 gates matchea
  `/changed-files .*--diff/`; el de `sdd-security-gate` **además** conserva la
  cláusula de full-read en superficie sensible (**test de contenido de SEC-2**).
  `grep -l 'changed-files' skills/sdd-code-review skills/sdd-security-gate skills/sdd-runtime-gate`
  → los 3.
- **Linked acceptance criterion**: AC-1, SEC-2.

## Phase 3 — section-first en playbooks que leen specs (3b)

### Task 3.1 — Directiva `spec-read` en gates + verify + commit (no apply/archive) [x]
- **Files**: `skills/sdd-code-review/canonical.md`, `skills/sdd-security-gate/canonical.md`,
  `skills/sdd-runtime-gate/canonical.md`, `skills/sdd-verify/canonical.md`,
  `skills/sdd-commit/canonical.md`, `test/skill-contract.test.js`
- **Descripción**: agregar "Usá `playbook spec-read <file>#<anchor>` para leer solo
  la sección relevante; si el anchor no existe, caé a full-read y reportá el motivo."
  **No** tocar `sdd-apply` ni `sdd-archive` (necesitan contexto completo).
- **Success criterion**: assert de contenido — el `SKILL.md` de los 5 playbooks
  matchea `/spec-read/`, y el de `sdd-apply`/`sdd-archive` **no** lo matchea.
- **Linked acceptance criterion**: AC-2.

## Phase 4 — Reparar el eslabón de seguridad en verify (3c)

### Task 4.1 — Re-run SEC-N post-merge + tabla + regla dura en `sdd-verify` [x]
- **Files**: `skills/sdd-verify/canonical.md`, `test/skill-contract.test.js`
- **Depende de**: Task 1.1 (el template debe traer las secciones que el validador exige).
- **Descripción**: (a) agregar paso: "Re-correr los tests negativos de cada `SEC-N`
  contra el código mergeado (no confiar en el reporte pre-merge)."; (b) agregar al
  template del reporte la tabla `## Security considerations` con filas
  `SEC-N | control | test/check | passed`; (c) regla dura: cualquier `SEC-N` sin
  evidencia post-merge → `status: failed`.
- **Success criterion**: assert de contenido — el `SKILL.md` de `sdd-verify`
  contiene el paso de re-run de negativos `SEC-N` y la sección/tabla
  `## Security considerations` en su template (**test de contenido de SEC-3**).
- **Linked acceptance criterion**: AC-3, SEC-3.

## Phase 5 — Restaurar la dimensión de seguridad en enrich (3e)

### Task 5.1 — "Security and data sensitivity" obligatoria en `sdd-enrich-us` [x]
- **Files**: `skills/sdd-enrich-us/canonical.md`, `test/skill-contract.test.js`
- **Descripción**: volver a incluir "Security and data sensitivity" como dimensión
  de decisión **obligatoria** a resolver antes de redactar el draft (sembrar los `SEC-N`).
- **Success criterion**: assert de contenido — el `SKILL.md` de `sdd-enrich-us`
  matchea `/security and data sensitivity/i` como dimensión obligatoria.
- **Linked acceptance criterion**: AC-5.

## Phase 6 — Regenerar y gates de calidad (3f)

### Task 6.1 — `npm run generate` + no-drift [x]
- **Files**: todos los `SKILL.md` afectados (artefactos regenerados)
- **Depende de**: Fases 2–5.
- **Descripción**: `npm run generate` para propagar cada `canonical.md` a su `SKILL.md`.
- **Success criterion**: `npm run generate:check` sin drift.
- **Linked acceptance criterion**: AC-6.

### Quality gates (fase final)
- **Format**: (sin formatter configurado — N/A)
- **Lint/type-check**: `node --check src/schema/body-rules.js && node --check src/cli/validate.js`
- **Feature tests**: `node --test test/schema.test.js && node --test test/skill-contract.test.js`
- **No-drift de skills**: `npm run generate:check`
- **Regresión completa** (risk: standard): `npm test`

## Execution Report

**Fecha**: 2026-07-23 · **Resultado**: passed — 6/6 tasks completas; gates de calidad verdes.

### Acceptance criteria → evidencia
| AC | Evidencia | Resultado |
|---|---|---|
| AC-1 | `test/skill-contract.test.js` "diff-first…" — los 3 gates matchean `/changed-files .*--diff/`; `grep -rl 'changed-files' skills/sdd-code-review skills/sdd-security-gate skills/sdd-runtime-gate` → 3 | passed |
| AC-2 | `test/skill-contract.test.js` "section-first…" — 5 playbooks matchean `/spec-read/`; `sdd-apply`/`sdd-archive` no | passed |
| AC-3 | `test/skill-contract.test.js` "sdd-verify re-runs SEC-N…" — paso de re-run + tabla `## Security considerations` en el template | passed |
| AC-4 / EC-1 / EC-2 | `test/schema.test.js` `validateVerificationBody` rechaza sección faltante y vacía, acepta cuerpo completo; cableado en `src/cli/validate.js` `BODY_VALIDATORS['verification-report.md']` | passed |
| AC-5 | `test/skill-contract.test.js` "sdd-enrich-us lists Security and data sensitivity…" | passed |
| AC-6 | `npm run generate:check` → sin drift | passed |

### Security considerations → evidencia (test negativo primero)
| SEC | Control | Test/Check | Resultado |
|---|---|---|---|
| SEC-1 | `validateVerificationBody` hace de la sección de seguridad del reporte un requisito duro | `test/schema.test.js` — cuerpo **sin** `## Security considerations` es **rechazado** (test negativo) | passed |
| SEC-2 | diff-first preserva el derecho del security gate a full-read en superficie sensible | `test/skill-contract.test.js` — el SKILL.md de `sdd-security-gate` conserva `full-read` + `sensitive surface` junto a la directiva diff-first | passed |
| SEC-3 | `verify` re-corre los negativos `SEC-N` contra el código mergeado; regla dura falla ante evidencia ausente | `test/skill-contract.test.js` — el SKILL.md de `sdd-verify` trae el paso de re-run + tabla + regla dura | passed |

### Comandos corridos (vía `playbook run --step apply`)
- `node --check src/schema/body-rules.js` → passed
- `node --check src/cli/validate.js` → passed
- `node --test test/schema.test.js test/skill-contract.test.js` → passed
- `npm run generate:check` → sin drift
- `npm test` → passed (regresión completa)

### Notas
- `playbook validate wire-token-and-security-policy` reporta `context-packet.md` **stale** — esperado: el packet hashea `tasks.md`, que `sdd-apply` necesariamente edita (checkboxes, status, este reporte). No es un gate de cierre de apply; `sdd-code-review` lee las fuentes vivas cuando el packet las contradice. Refrescar con `playbook packet wire-token-and-security-policy` en el punto del ciclo que corresponda.
- Ningún archivo tocado fuera de `## Constraints and non-goals`. Los `SKILL.md` cambiaron **solo** vía `npm run generate` (Principio 1), sin edición a mano.
