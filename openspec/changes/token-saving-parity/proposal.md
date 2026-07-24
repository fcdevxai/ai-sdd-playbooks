---
schema: proposal
schema_version: 1
change_id: token-saving-parity
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
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
  risk: standard   # PROPUESTO — podría bajarse a `low` (sin superficie sensible); ver nota al reviewer
  triggers: []
runtime_relevant_capabilities: []   # decidido en sdd-runtime-gate — ver "Open technical decisions"
---

# Paridad de ahorro de tokens: cablear packet + spec-index

## Objective

El programa de ahorro de tokens portado desde `specloom` (context-packet
ADR-010 + spec-index/section-first ADR-012) quedó **cableado a medias** tras la
fusión `ai-sdd-playbooks`+`specloom` (ADR-026). La capacidad existe y está
testeada, pero varios skills **no la invocan** — el modo de falla es "más
tokens, igual correcto", así que pasó desapercibido. Este change cierra tres
facetas desconectadas + un bug de doc, todas de la misma clase ("implementado
pero ningún skill lo invoca"):

1. **Packet sub-consumido.** ADR-010 define 5 consumidores del
   `context-packet.md` (code-review, security-gate, ux-gate→runtime-gate,
   commit, verify). Hoy `sdd-commit` y `sdd-runtime-gate` **no** lo leen
   (`grep context-packet` en sus `canonical.md` = 0) → releen
   `proposal.md`+`tasks.md` enteros.
2. **`spec-read` mal dirigido.** `sdd-verify:39` y `sdd-commit:27` ponen ejemplos
   apuntando a `proposal.md#...` — algo que el comando **no puede** hacer: está
   confinado a `openspec/specs/**` (`src/tokens/spec-index.js:130`,
   `spec path outside openspec/specs`). Verificado además contra specloom
   (`framework/cli/lib.js:204`, mismo confinamiento) y contra ADR-010: el
   contenido de proposal/tasks sale **del packet**, no de `spec-read`.
3. **Discovery de `spec-index` no cableado.** El comando existe
   (`src/tokens/spec-index.js`, `dispatch.js`) y está testeado, pero **0 skills**
   lo invocan → `.specloom/index/` nunca se crea en un consumer. specloom lo
   usaba para *descubrir* el anchor de una spec permanente cuando no se conocía.
4. **Bug de doc.** `skills/sdd-apply/canonical.md:59` dice `.playbook/runs/`, pero
   el código escribe `.specloom/runs/` (`src/tokens/run.js`).

## Guiding principle

**Las skills se regeneran, no se editan a mano** (Principio 1): toda edición va
en `skills/<slug>/canonical.md` + `npm run generate`; `generate:check` no debe
reportar drift. Este change **no decide arquitectura nueva** — restaura la
intención ya decidida en ADR-010 (packet) y ADR-012 (spec-index section-first),
que la fusión dejó a medias. Enforcement: **wiring + test de contenido** (el
test es un gate mecánico duro que impide que un merge futuro borre el wiring en
silencio), más un warning read-only advisory en `playbook doctor`. Los ejemplos
de `spec-read` y el bloque del packet se replican **textualmente** de los skills
que ya los tienen, para no introducir variantes.

## Impacted modules

- `skills/sdd-commit/canonical.md`: agregar el bloque de lectura de
  `context-packet.md`; corregir el ejemplo de `spec-read` (apuntar a spec
  permanente, aclarar que proposal/tasks salen del packet); cablear discovery de
  `spec-index`.
- `skills/sdd-runtime-gate/canonical.md`: agregar el bloque de lectura del
  packet; cablear discovery de `spec-index`.
- `skills/sdd-verify/canonical.md`: corregir el ejemplo de `spec-read`
  (`proposal.md#acceptance-criteria` → spec permanente + aclaración del packet);
  cablear discovery de `spec-index`.
- `skills/sdd-code-review/canonical.md`, `skills/sdd-security-gate/canonical.md`:
  cablear discovery de `spec-index` (ambos ya leen el packet y usan `spec-read`).
- `skills/sdd-apply/canonical.md`: fix de doc `.playbook/runs/` → `.specloom/runs/`.
- `skills/*/SKILL.md`: regenerados vía `npm run generate`.
- `src/cli/doctor.js`: nuevo check advisory pure/testable (patrón
  `workflowStaleness`) que empuja a `warnings[]` cuando falta el índice.
- `test/`: test del check de doctor + `test/skill-contract.test.js` (aserciones
  de contenido de los wirings).

## Impacted repos

<!-- Repo names from playbook.config.yaml's `repos:` that must pass cross-repo gate-check. Empty means no cross-repo gate — leave the section header even on a single-repo project. -->

No aplica: single-repo (`playbook-ai`).

## Files touched

<!-- Only for multi-repo changes (## Impacted repos non-empty). Leave empty on a single-repo project. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un change con `context-packet.md`, **When** corre `sdd-commit` o
  `sdd-runtime-gate`, **Then** el skill instruye leer el packet en vez de
  `proposal.md`+`tasks.md` enteros (con fallback silencioso a full-read si el
  packet no existe), igual que code-review/security-gate/verify.
- **Given** un skill section-first que necesita una sección de una spec
  permanente y no conoce el anchor, **When** `.specloom/index/spec-index.json` no
  existe, **Then** el skill instruye correr `playbook spec-index` para
  descubrirlo, y usar `playbook spec-read openspec/specs/<file>#<anchor>` para
  leer solo esa sección.
- **Given** un repo sin índice construido, **When** corre `playbook doctor`,
  **Then** aparece un warning advisory (canal `warnings[]`, en texto y en
  `--json`) señalando la oportunidad de ahorro; `healthy` y el exit code no
  cambian.

### Edge cases

- **Given** que `playbook spec-index` falla o el anchor no se encuentra, **When**
  un skill lo invoca, **Then** el skill cae en full-read de la spec y **reporta
  el motivo** (degradación correcta: más tokens, nunca resultado incorrecto).
- **Given** un change sin `context-packet.md` (creado antes de la convención),
  **When** corre un consumidor, **Then** fallback silencioso a full-read, sin
  error ni warning (contrato de ADR-010).
- El `spec-read` sigue confinado a `openspec/specs/**`: apuntarlo a
  `proposal.md`/`tasks.md` es un error y no se documenta como uso válido.

## Acceptance criteria

<!-- Testable list, one per line. Stable IDs, sequential from 1. -->

**AC-1:** `skills/sdd-commit/canonical.md` y `skills/sdd-runtime-gate/canonical.md`
contienen el bloque de lectura de `context-packet.md` ("read it instead of
`proposal.md`+`tasks.md` in full … fall back … no error, no warning")
equivalente al de code-review/security-gate/verify.
**AC-2:** ningún `skills/*/canonical.md` contiene un ejemplo de `spec-read`
apuntando a `proposal.md`/`tasks.md`; todo ejemplo de `spec-read` apunta a
`openspec/specs/...`.
**AC-3:** `skills/sdd-verify/canonical.md` y `skills/sdd-commit/canonical.md`
aclaran que el contenido de proposal/tasks se lee del `context-packet`, no de
`spec-read`.
**AC-4:** los 5 skills section-first (`sdd-code-review`, `sdd-security-gate`,
`sdd-runtime-gate`, `sdd-verify`, `sdd-commit`) instruyen correr `playbook
spec-index` para descubrir un anchor de una spec permanente cuando
`.specloom/index/spec-index.json` no existe, con fallback a full-read + reporte
del motivo.
**AC-5:** `skills/sdd-apply/canonical.md` referencia `.specloom/runs/` y ya no
`.playbook/runs/`.
**AC-6:** `playbook doctor` emite un warning advisory por el canal `warnings[]`
(visible en texto y en `--json`) cuando `.specloom/index/spec-index.json` no
existe; nunca modifica `healthy` ni el exit code.
**AC-7:** `npm run generate:check` no reporta drift entre `canonical.md` y
`SKILL.md` de los skills tocados.
**AC-8:** `test/skill-contract.test.js` incluye aserciones que fallan si: (a)
sdd-commit o sdd-runtime-gate dejan de leer el packet; (b) reaparece un ejemplo
`spec-read` sobre `proposal.md`/`tasks.md`; (c) alguno de los 5 skills deja de
mencionar `spec-index`; (d) sdd-apply vuelve a decir `.playbook/runs/`.
**AC-9:** existe un test del check de doctor (función pura + su integración en
`doctorCommand`) que falla si el warning no se emite cuando el índice falta.

## Error cases

<!-- What happens on failure. Stable IDs, sequential from 1. -->

**EC-1:** si un merge borra cualquiera de los wirings (packet, spec-index,
corrección de spec-read, path de runs) en un `canonical.md`,
`test/skill-contract.test.js` falla nombrando la aserción rota — en vez de
degradar en silencio a "más tokens" como el bug original.
**EC-2:** si `canonical.md` y `SKILL.md` quedan desincronizados, `npm run
generate:check` falla reportando el drift.
**EC-3:** en runtime, si `playbook spec-index` falla o el índice no existe, el
skill instruye full-read de la spec + reportar el motivo (nunca resultado
incorrecto, solo más tokens).

## Security considerations

<!-- Data/permissions/input touched and how it's protected, or "Not applicable: <reasoning>" — never empty. Stable IDs, sequential from 1. -->

**SEC-1:** Superficie mínima. El único cambio de código es un check **read-only**
en `playbook doctor` que consulta la existencia de
`.specloom/index/spec-index.json` bajo el `cwd` (mismo molde que
`workflowStaleness`): sin input externo, sin escritura, sin secretos, sin datos
personales, sin lógica de autenticación/autorización. El resto son cambios de
prosa en `canonical.md`.
**SEC-2:** `spec-read` **mantiene** su confinamiento a `openspec/specs/**` — este
change no lo amplía. No se abre ninguna vía de path-traversal hacia
`openspec/changes/` ni fuera del repo. El contrato de fallback de ADR-010 (leer
las fuentes completas si el packet no existe o contradice) se preserva.

## Constraints and non-goals

- **No-goal:** ampliar el confinamiento de `spec-read` para leer change
  artifacts — es **peor** para tokens (N lecturas por anchor vs. 1 packet
  pre-extraído) y requeriría cambio de código + review de path-traversal.
- **No-goal:** crear un ADR nuevo — la convención ya está en ADR-010 (accepted) +
  ADR-012 (accepted); no se superseden ni se modifican.
- **No-goal:** enforcement duro del índice (no fail CI, no `playbook validate` del
  índice) ni hooks. El índice es cache de sesión gitignoreado; su ausencia =
  fallback a full-read = correcto.
- **No-goal:** scaffolding de `.specloom/` (lazy: `index/` aparece al correr
  `spec-index`, `runs/` al correr `run`).
- **No-goal:** tocar `skills/sdd-apply/canonical.md` más allá del fix de doc (#4).
- **Constraint:** las skills se editan solo en `canonical.md` + `npm run
  generate`; `SKILL.md` es derivado.
- **Constraint:** el bloque del packet y las instrucciones de `spec-index` se
  replican **textualmente** de los skills que ya los tienen, sin variantes.

## Open technical decisions

- **Gating del warning de doctor — CERRADA en `sdd-plan`/Task 2.1:** se emite
  siempre que falte el índice y existan specs permanentes (nunca en repos sin
  specs). Implementado en `specIndexAdvisory` (`src/cli/doctor.js`).
- **`runtime_relevant_capabilities` — CERRADA en `sdd-runtime-gate`:** fijado a
  `[]` (ver frontmatter). Mismo razonamiento y precedente que
  `cli-detect-siblings`: el adapter `cli` del runtime-gate es sobre un harness
  E2E real (experimental, no implementado), no sobre "¿el diff toca código del
  CLI?" — eso ya lo cubren los tests unitarios (`test/doctor.test.js`,
  `test/skill-contract.test.js`), verdes. Sin esta exclusión, el adapter `cli`
  bloquearía (`ADAPTER_NOT_IMPLEMENTED`) cualquier change que toque `src/cli/`.
- **`security.risk` — CERRADA en `sdd-security-gate`:** se mantuvo `standard`
  (el gate nunca baja automáticamente un riesgo aprobado); el gate confirmó
  `not_applicable` por ausencia de superficie sensible.
