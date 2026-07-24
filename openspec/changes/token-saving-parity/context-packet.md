---
sources:
  proposal: 426c7023c1f62d27fb4e8c8714bd446d23de171e249f3669bded560b7717c5d3
  tasks: 5dec39423d8eb78d9e62122f3c15dda6c24593cb1b129744da92720fb0800d6a
---
# Context Packet — Paridad de ahorro de tokens: cablear packet + spec-index

## Ticket

token-saving-parity

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

## Files touched

- `skills/sdd-commit/canonical.md`
- `skills/sdd-runtime-gate/canonical.md`
- `skills/sdd-verify/canonical.md`
- `skills/sdd-code-review/canonical.md`
- `skills/sdd-security-gate/canonical.md`
- `skills/sdd-apply/canonical.md`
- `skills/*/SKILL.md`
- `src/cli/doctor.js`
- `test/skill-contract.test.js`
- `test/doctor.test.js`

## Verification commands

- `(sin formatter configurado)`
- `node --check src/cli/doctor.js`
- `node --test test/skill-contract.test.js test/doctor.test.js`

## Full sources

- openspec/changes/token-saving-parity/proposal.md
- openspec/changes/token-saving-parity/tasks.md
