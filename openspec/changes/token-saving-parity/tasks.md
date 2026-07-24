---
schema: tasks
schema_version: 1
change_id: token-saving-parity
status: passed
updated: 2026-07-24
---
# Tasks — Paridad de ahorro de tokens: cablear packet + spec-index

## Rules

- Every task has a verifiable success criterion; no mixing unrelated layers.
- No changes to files outside `## Constraints and non-goals` del proposal.
- Skills se editan SOLO en `canonical.md`; `SKILL.md` se regenera (Task 1.6).
- Los tests de contenido asertan sobre `SKILL.md` (generado) → toda edición de
  `canonical.md` requiere `npm run generate` antes de que los tests pasen.
- Comandos escritos para correr desde la raíz del repo (sin `cd`).

## Textos canónicos a replicar (fuente de verdad, sin variantes)

- **Bloque packet** (de `skills/sdd-code-review/canonical.md`): *"If
  `context-packet.md` exists, read it instead of `proposal.md`+`tasks.md` in full
  — it carries acceptance criteria, constraints, security considerations, files
  touched, and verification commands copied verbatim from those sources. If it
  doesn't exist, fall back to reading both in full (no error, no warning). If its
  content visibly contradicts the live `proposal.md`/`tasks.md` … prefer the full
  sources and note the discrepancy."*
- **Instrucción spec-index** (nueva, idéntica en los 5): *"If you need a
  permanent-spec anchor you don't know and `.specloom/index/spec-index.json`
  doesn't exist, run `playbook spec-index` to build it, then `playbook spec-read
  openspec/specs/<file>#<anchor>`. If `spec-index` or the lookup fails, full-read
  the spec and report why."*
- **Ejemplo spec-read correcto**: `openspec/specs/system.md#code-conventions`
  (anchor real, verificado).

## Preconditions (self-check)

`proposal.status == approved`; design `not_applicable` (`design_required:
false`). Verificado con `playbook validate --precondition sdd-plan
token-saving-parity` → OK.

## Phase 1 — Skill wiring (`canonical.md`)

### Task 1.1 — sdd-commit: packet + fix spec-read + spec-index [x]
- **Files**: `skills/sdd-commit/canonical.md`
- **Cambios**: (a) agregar el **bloque packet** al inicio de `## Context`; (b)
  reemplazar el ejemplo malo `proposal.md#impacted-repos` por un spec permanente
  (`openspec/specs/system.md#code-conventions`) y aclarar que impacted-repos /
  acceptance criteria salen **del packet**, no de `spec-read`; (c) agregar la
  **instrucción spec-index**.
- **Success criterion**: `canonical.md` contiene el bloque packet, la
  instrucción spec-index, ningún `proposal.md#`/`tasks.md#`, y un ejemplo
  spec-read a `openspec/specs/...`.
- **Linked AC**: AC-1, AC-2, AC-3, AC-4

### Task 1.2 — sdd-runtime-gate: packet + spec-index [x]
- **Files**: `skills/sdd-runtime-gate/canonical.md`
- **Cambios**: agregar el **bloque packet** a `## Context`; agregar la
  **instrucción spec-index**. (El ejemplo spec-read ya es genérico `<file>#<anchor>`
  — no toca faceta 2.)
- **Success criterion**: `canonical.md` contiene el bloque packet y la
  instrucción spec-index; no introduce `proposal.md#`/`tasks.md#`.
- **Linked AC**: AC-1, AC-4

### Task 1.3 — sdd-verify: fix spec-read + spec-index [x]
- **Files**: `skills/sdd-verify/canonical.md`
- **Cambios**: reemplazar el ejemplo malo `proposal.md#acceptance-criteria` por
  `openspec/specs/system.md#<anchor>` + aclarar que acceptance criteria salen del
  packet; agregar la **instrucción spec-index**. (Ya tiene bloque packet.)
- **Success criterion**: `canonical.md` sin `proposal.md#`/`tasks.md#`, con
  ejemplo spec-read a `openspec/specs/...` y con la instrucción spec-index.
- **Linked AC**: AC-2, AC-3, AC-4

### Task 1.4 — sdd-code-review + sdd-security-gate: spec-index [x]
- **Files**: `skills/sdd-code-review/canonical.md`, `skills/sdd-security-gate/canonical.md`
- **Cambios**: agregar la **instrucción spec-index** a `## Context` de ambos (ya
  leen packet y usan spec-read genérico; solo falta el discovery).
- **Success criterion**: ambos `canonical.md` contienen `spec-index`; no
  introducen `proposal.md#`/`tasks.md#`.
- **Linked AC**: AC-4

### Task 1.5 — sdd-apply: fix bug de doc del runs path [x]
- **Files**: `skills/sdd-apply/canonical.md`
- **Cambios**: `.playbook/runs/` → `.specloom/runs/` (línea ~59). No agregar
  `spec-read` (apply no debe instruir section-first — test existente lo asegura).
- **Success criterion**: `grep -R "\.playbook/runs" skills/` no devuelve nada;
  `sdd-apply/canonical.md` dice `.specloom/runs/`.
- **Linked AC**: AC-5

### Task 1.6 — Regenerar SKILL.md [x]
- **Files**: `skills/*/SKILL.md` (derivados)
- **Cambios**: `npm run generate`.
- **Success criterion**: `npm run generate:check` sin drift (exit 0).
- **Linked AC**: AC-7
- **Depende de**: 1.1–1.5.

## Phase 2 — Doctor advisory (código)

### Task 2.1 — Check advisory de spec-index en `playbook doctor` [x]
- **Files**: `src/cli/doctor.js` (y reutilizar el helper de path del índice de
  `src/tokens/spec-index.js` — importar, no duplicar la ruta).
- **Cambios**: función pura `specIndexAdvisory({ cwd })` (molde de
  `workflowStaleness`): devuelve `null` si no hay specs permanentes que indexar
  (`openspec/specs/system.md` ausente) o si el índice ya existe; devuelve el
  string advisory (oportunidad de ahorro de tokens) cuando hay specs pero falta
  `.specloom/index/spec-index.json`. Empujar su resultado a `warnings` en
  `doctorCommand` (canal advisory existente, sale en texto y en `--json`).
- **Cierre de decisión abierta (gating):** se emite siempre que el índice falte
  **y** existan specs permanentes; nunca en repos sin specs.
- **Success criterion**: `playbook doctor --json` en un repo con specs y sin
  índice incluye el warning en `warnings[]`; `healthy` y el exit code NO cambian.
- **Linked AC**: AC-6

## Phase 3 — Tests (enforcement)

### Task 3.1 — Tests de contenido en skill-contract [x]
- **Files**: `test/skill-contract.test.js`
- **Cambios**: nuevo bloque de tests que falla si se borra cualquier wiring:
  - `sdd-commit` y `sdd-runtime-gate` contienen el bloque packet
    (`/context-packet\.md/` + `/read it instead of/`).
  - ninguno de los skills contiene `proposal.md#` ni `tasks.md#` (anti-patrón
    spec-read → change artifacts).
  - los 5 (`sdd-code-review`, `sdd-security-gate`, `sdd-runtime-gate`,
    `sdd-verify`, `sdd-commit`) contienen `spec-index`.
  - `sdd-apply` contiene `.specloom/runs/` y NO `.playbook/runs/`.
- **Success criterion**: `node --test test/skill-contract.test.js` verde con las
  nuevas aserciones; si se revierte un wiring en un `SKILL.md`, la aserción
  correspondiente falla nombrando el skill (cubre EC-1).
- **Linked AC**: AC-8 · **cubre**: EC-1, SEC-2 (anti-patrón spec-read = negativo)
- **Depende de**: 1.6 (asertan sobre `SKILL.md` generado).

### Task 3.2 — Test del doctor advisory [x]
- **Files**: `test/doctor.test.js`
- **Cambios**: (a) test unitario de `specIndexAdvisory` — string cuando hay specs
  y falta el índice; `null` cuando el índice existe o no hay specs; (b) test de
  integración de `doctorCommand` — el warning aparece en `warnings[]`/`--json`
  cuando falta el índice.
- **Success criterion (incluye negativo SEC-1)**: el test asegura que, aun cuando
  el warning se emite, `healthy` sigue `true` (si no hay `problems`) y el exit
  code NO cambia — el check es read-only y nunca bloquea.
- **Linked AC**: AC-9 · **cubre**: SEC-1 (negativo: advisory nunca altera
  healthy/exit)

## Phase 4 — Quality gates

- **Format**: (sin formatter configurado)
- **Lint/type-check**: `node --check src/cli/doctor.js`
- **Feature tests**: `node --test test/skill-contract.test.js test/doctor.test.js`
- **Sincronía skills**: `npm run generate:check`
- **Regresión**: `npm test`

## Execution Report

**Estado al arrancar `sdd-apply`:** Phase 1 (wiring de `canonical.md`, tasks
1.1–1.6) ya estaba implementada en el árbol de trabajo (branch
`token-saving-parity`) antes de esta sesión — confirmado con
`npm run generate:check` (sin drift) y grep directo de cada wiring. Esta
sesión ejecutó Phase 2 (doctor advisory) y Phase 3 (tests) con TDD, y marcó
las tasks 1.5/1.6 (ya satisfechas) como `[x]`.

**Phase 2 — `specIndexAdvisory` (Task 2.1):**
- Test-first: se agregaron los tests unitarios (`specIndexAdvisory: null
  cuando no hay specs permanentes`, `warns cuando falta el índice`, `null una
  vez construido`) y el de integración (`doctor warns … spec index is
  missing`, `does not warn once built`) en `test/doctor.test.js` antes de la
  implementación — confirmado rojo (`SyntaxError: … does not provide an
  export named 'specIndexAdvisory'`).
- Implementación en `src/cli/doctor.js`: función pura `specIndexAdvisory({cwd})`
  (mismo molde que `workflowStaleness`), reutiliza `discoverSpecFiles` y
  `defaultSpecIndexPath` de `src/tokens/spec-index.js` (sin duplicar la ruta,
  per constraint de la task). Empuja al canal `warnings[]` existente de
  `doctorCommand` — no toca `problems`/`healthy`/exit code (SEC-1).
- Verde: `node --test test/doctor.test.js` → pass.

**Phase 3 — Tests de contenido (Task 3.1):**
- Se agregaron 4 tests nuevos a `test/skill-contract.test.js` (packet en
  sdd-commit/sdd-runtime-gate; ningún skill con `proposal.md#`/`tasks.md#`;
  los 5 skills mencionan `spec-index`; sdd-apply dice `.specloom/runs/` y no
  `.playbook/runs/`). Los 4 pasaron en verde de inmediato porque Phase 1 ya
  estaba implementada — sirven como regresión (EC-1): si un merge futuro borra
  cualquiera de los wirings, la aserción correspondiente falla nombrando el
  skill.

**Verificación de acceptance criteria:**

| AC | Evidencia |
|---|---|
| AC-1 | test `sdd-commit and sdd-runtime-gate read the context-packet…` (skill-contract.test.js) — pass |
| AC-2 | test `no skill instructs spec-read against proposal.md/tasks.md…` — pass (recorre los 13+ skills) |
| AC-3 | verificado por lectura directa de `sdd-verify`/`sdd-commit` canonical.md (aclaración packet presente); cubierto indirectamente por AC-1/AC-2 |
| AC-4 | test `the 5 section-first skills instruct spec-index discovery…` — pass |
| AC-5 | test `sdd-apply references .specloom/runs/…` — pass |
| AC-6 | tests `doctor warns … spec index is missing` / `does not warn once built` (doctor.test.js) — pass; `healthy`/exit code sin cambios verificado explícitamente |
| AC-7 | `npm run generate:check` → "No drift — 13 skill(s) in sync." |
| AC-8 | los 4 tests de contenido nuevos en skill-contract.test.js cubren (a)-(d) |
| AC-9 | 3 tests unitarios de `specIndexAdvisory` + 2 de integración de `doctorCommand` |

**Comandos corridos** (todos vía `playbook run --change token-saving-parity
--step apply -- <cmd>`):
- `node --test test/doctor.test.js` → passed
- `node --test test/skill-contract.test.js test/doctor.test.js` → passed (57 líneas, 0 fail)
- `npm run generate:check` → passed, sin drift
- `npm test` → passed (362 líneas, suite completa verde)

**Scope check:** único archivo de código tocado, `src/cli/doctor.js` (SEC-1:
check read-only, sin escritura, sin input externo). Tests en `test/doctor.test.js`
y `test/skill-contract.test.js`. Ningún archivo fuera de `## Impacted modules`
del proposal.

**Resultado:** todas las tasks `[x]`, todos los gates verdes. `status: passed`.
