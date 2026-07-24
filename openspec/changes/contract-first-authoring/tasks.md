---
schema: tasks
schema_version: 1
change_id: contract-first-authoring
status: passed
updated: 2026-07-24
---
# Tasks — Authoring del contrato canónico en `sdd-design`

> **Orden TDD.** Fase 1 escribe las 6 aserciones **antes** de tocar el
> `canonical.md`: 5 arrancan en **rojo** (el texto no existe) y 1 en **verde**
> (guarda de no-regresión sobre `sdd-plan`). Fases 2-3 las ponen en verde.
>
> **Principio 1.** Cada tarea que edita `skills/sdd-design/canonical.md` incluye
> su `npm run generate` — el par es atómico: un `canonical.md` editado sin
> regenerar deja el `SKILL.md` (lo que realmente se instala, y lo que leen los
> tests) desincronizado.
>
> Todos los comandos corren **desde la raíz del repo**. `sdd-apply` los ejecuta
> vía `playbook run --change contract-first-authoring --step apply -- <cmd>`.

## Phase 1 — Aserciones de contenido (TDD, rojo primero)

Todas en `test/skill-contract.test.js`, contra el `SKILL.md` generado vía el
helper `body(name)` ya existente. Nomenclatura `('… (AC-N, EC-N)')`, igual que
las aserciones de packet/spec-index.

### Task 1.1 — Aserción A: el paso de authoring existe y está condicionado [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-design authors the canonical contract when the proposal declares public_contract (AC-1, AC-2)`.
  Matchea sobre `body('sdd-design')`: `impact.public_contract`,
  `contract.path_in_loom`, y la instrucción de **omitir + reportar** cuando la
  clave falta.
- **Success criterion**: `node --test test/skill-contract.test.js` falla y el
  fallo nombra este test por texto ausente (rojo esperado).
- **Linked acceptance criterion**: AC-1, AC-2 (y EC-1)

### Task 1.2 — Aserción B: la ruta sale de config y la regla lo prohíbe hardcodear [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-design takes the contract path from config and never hardcodes it (AC-2)`.
  Dos mitades: (a) `doesNotMatch` del literal
  `openspec/specs/contracts/openapi.yaml` en `body('sdd-design')`; (b) matchea la
  regla de `## Rules` (no escribir contrato sin `contract.path_in_loom`,
  contract-first es opt-in).
- **Success criterion**: el test falla por la mitad (b) — la (a) ya pasa hoy de
  forma vacía y **debe seguir pasando** tras la Fase 2.
- **Linked acceptance criterion**: AC-2

### Task 1.3 — Aserción C: coherencia contrato ↔ `design.md` [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-design keeps the canonical contract and design.md's public contracts in sync (AC-3)`.
  Matchea `Public contracts / interfaces` y la exigencia de "same set".
- **Success criterion**: falla en rojo por texto ausente.
- **Linked acceptance criterion**: AC-3

### Task 1.4 — Aserción D: prohibición de secretos/PII (positiva + negativa) [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-design forbids secrets and PII in the canonical contract (SEC-001, AC-4)`.
  **Mitad positiva**: el body menciona la prohibición sobre
  `example`/`description`/`servers` (secrets / tokens / PII). **Mitad negativa
  (SEC-001)**: `doesNotMatch` de literales con forma de credencial en el propio
  texto del skill — `/Bearer\s+[A-Za-z0-9._-]{8,}/`,
  `/api[_-]?key\s*[:=]\s*\S/i`, `/-----BEGIN [A-Z ]*PRIVATE KEY-----/` — mismo
  patrón que `test/contract-first.test.js:131` usa sobre el CI template. Una
  instrucción que predica no filtrar secretos no puede traer uno en su ejemplo.
- **Success criterion**: falla por la mitad positiva; la negativa pasa y debe
  seguir pasando tras la Fase 2.
- **Linked acceptance criterion**: AC-4 (SEC-1 / control SEC-001)

### Task 1.5 — Aserción E: `sdd-plan` no autora el contrato (guarda verde) [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-plan does not author the canonical contract — that is sdd-design's step (AC-1)`.
  `doesNotMatch /openapi/i` sobre `body('sdd-plan')`.
- **Success criterion**: pasa en **verde desde el arranque** (hoy `sdd-plan` no
  menciona `openapi`) y queda como no-regresión de la regla 1 del ADR draft: la
  propiedad del paso es de `sdd-design`, exclusiva.
- **Linked acceptance criterion**: AC-1 (regla 1 del ADR)

### Task 1.6 — Aserción F: el README nombra `sdd-design` [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `the README names sdd-design as the contract authoring stage (AC-5)`.
  Lee `README.md` desde la raíz del repo; matchea que el bloque contract-first
  nombra `sdd-design` y `doesNotMatch` la promesa vieja `during \`sdd-plan\``.
- **Success criterion**: falla en rojo (hoy el README dice `sdd-plan`).
- **Linked acceptance criterion**: AC-5

## Phase 2 — Wiring de `sdd-design`

### Task 2.1 — Paso 2 de `## Behavior` + renumeración [x]
- **Files**: `skills/sdd-design/canonical.md`, `skills/sdd-design/SKILL.md` (regenerado)
- **Qué**: insertar el paso de *Canonical contract authoring (conditional)* como
  **paso 2**, entre "Design the solution" (1) y "Security refinement" (hoy 2).
  Renumerar 2→3, 3→4, 4→5. Texto literal en
  `design.md` → `## Approach` → sección 1. El literal
  `openspec/specs/contracts/openapi.yaml` **no** debe aparecer (rompería la
  aserción B(a)). Luego `npm run generate`.
- **Depende de**: Tasks 1.1, 1.3, 1.4 (sus tests deben existir en rojo antes).
- **Success criterion**: las aserciones A, C y D (mitad positiva) pasan;
  B(a) y D(negativa) siguen verdes; `npm run generate:check` sin drift.
- **Linked acceptance criterion**: AC-1, AC-2, AC-3, AC-4 (EC-1, EC-2)

### Task 2.2 — Regla en `## Rules` + `output_file` [x]
- **Files**: `skills/sdd-design/canonical.md`, `skills/sdd-design/SKILL.md` (regenerado)
- **Qué**: (a) agregar a `## Rules`: nunca escribir un contrato canónico cuando
  `contract.path_in_loom` está ausente, y nunca hardcodear una ruta de contrato —
  contract-first es opt-in por proyecto. (b) `output_file` →
  `design.md (+ the canonical contract at contract.path_in_loom when impact.public_contract: true)`.
  `produces` **no se toca** (el contrato es un spec permanente, no un artefacto
  del change folder). Luego `npm run generate`.
- **Depende de**: Task 1.2.
- **Success criterion**: la aserción B pasa completa (ambas mitades);
  `**Output file:**` del `SKILL.md` refleja el efecto condicional.
- **Linked acceptance criterion**: AC-2

## Phase 3 — Corrección del README

### Task 3.1 — El bloque contract-first nombra `sdd-design` [x]
- **Files**: `README.md`
- **Qué**: en `## Contract-first (optional)` (líneas 168-176), `during
  \`sdd-plan\`` → `during \`sdd-design\``, más una cláusula corta que nombre el
  motivo (el contrato entra en la firma humana del diseño). Único cambio del
  bloque: `paths: {}`, "feature by feature" y `contract-drift` en el CI del
  backend ya son correctos.
- **Depende de**: Task 1.6.
- **Success criterion**: la aserción F pasa.
- **Linked acceptance criterion**: AC-5

## Phase 4 — Quality gates

> **Etiquetas exactas del template de `sdd-plan`.** `playbook packet` extrae los
> comandos de estas líneas con un regex que sólo reconoce
> `Format|Lint/type-check|Feature tests|Regression`
> ([packet.js:49](src/tokens/packet.js:49)) y se lleva **todos** los tokens entre
> backticks de la línea. Etiquetas propias o backticks de prosa hacen que el
> packet —que es lo que leen los gates siguientes— quede con comandos faltantes
> o basura, y sin warning (sólo avisa si la lista queda vacía).

- **Format**: (sin formatter configurado)
- **Lint/type-check**: `node --check test/skill-contract.test.js`
- **Feature tests**: `node --test test/skill-contract.test.js`
- **Regression**: `npm test` + `npm run generate:check`

Evidencia esperada de la regresión: los 7 tests de `test/contract-first.test.js`
siguen pasando sin haberse tocado — o sea que el lado de verificación
(`contract-drift`) no se rompió. `generate:check` cubre AC-6.

**Chequeo manual de no-scope** (no es un comando de gate, no va al packet):
`git diff --stat` no debe listar nada bajo `src/`, `schemas/`, `templates/` ni
`openspec/specs/contracts/openapi.yaml` (no-goals del proposal).

---

# Execution Report

**Fecha:** 2026-07-24 · **Resultado:** todas las tareas `[x]`, gates verdes.

## Criterios de aceptación → evidencia

| AC | Evidencia | Estado |
|---|---|---|
| AC-1 | `test/skill-contract.test.js` → `sdd-design authors the canonical contract when the proposal declares public_contract (AC-1, AC-2)` + `sdd-plan does not author the canonical contract` | ✅ |
| AC-2 | mismo test + `sdd-design takes the contract path from config and never hardcodes it (AC-2)` (incluye `doesNotMatch` del literal `openspec/specs/contracts/openapi.yaml` y la aserción de `**Output file:**`) | ✅ |
| AC-3 | `sdd-design keeps the canonical contract and design.md's public contracts in sync (AC-3)` | ✅ |
| AC-4 | `sdd-design forbids secrets and PII in the canonical contract (SEC-001, AC-4)` — mitad negativa (sin literales con forma de credencial) + positiva | ✅ |
| AC-5 | `the README names sdd-design as the contract authoring stage (AC-5)` | ✅ |
| AC-6 | `npm run generate:check` sin drift | ✅ |
| AC-7 | 6 aserciones nuevas; `npm test` = **345 pass / 0 fail** | ✅ |

## Casos de borde y controles

- **EC-1 / EC-2** — cubiertos por el texto del paso 2 (omitir + reportar cuando falta
  `contract.path_in_loom`; crear con esqueleto mínimo cuando el archivo no existe) y
  asertados en el test de AC-1/AC-2 (`skip this step and say so`, `minimal skeleton`).
- **EC-3** — la aserción de AC-1..AC-4 falla si se borra el wiring: verificado en el
  rojo inicial (5 fallos por texto ausente).
- **EC-4** — `npm run generate:check` verde.
- **SEC-001** — test negativo **primero**, como exige el skill para una tarea ligada a un
  `SEC-N`: `doesNotMatch` de `Bearer <token>`, `api_key=…` y bloque `PRIVATE KEY` sobre el
  body del skill, replicando `test/contract-first.test.js:131`. Pasó desde el arranque y
  sigue verde tras el wiring.
- **SEC-002** — `git diff --stat` confirma 4 archivos: `README.md`,
  `skills/sdd-design/{canonical,SKILL}.md`, `test/skill-contract.test.js`. Cero cambios en
  `src/`, `schemas/`, `templates/` y `openspec/specs/contracts/openapi.yaml`.

## Comandos (todos vía `playbook run --change contract-first-authoring --step apply`)

| Comando | Resultado |
|---|---|
| `node --test test/skill-contract.test.js` (rojo TDD) | 33 pass / **5 fail** — A, B, C, D, F rojas; E verde |
| `npm run generate` | ✅ (`SKILL.md` regenerado) |
| `node --test test/skill-contract.test.js` (2º intento) | 37 pass / 1 fail — regex de `example`/`description` sin tolerancia al wrap |
| `node --test test/skill-contract.test.js` (3º intento) | ✅ 38/38 |
| `node --check test/skill-contract.test.js` | ✅ |
| `npm run generate:check` | ✅ sin drift |
| `npm test` | ✅ **345 pass / 0 fail** |

Cap de reintentos: 1 fix sobre 2 permitidos (se corrigió el regex del test, no el texto
del skill — el texto era correcto y el regex era demasiado estricto sobre el salto de línea).

## Desviaciones respecto del plan

1. **Aserción F acotada al bloque `## Contract-first`** en vez de leer el `README.md`
   completo. Motivo real: en el rojo de TDD el fallo volcó el README entero al output.
   La aserción ahora corta la sección con `split(/^## Contract-first/m)` — mismo criterio
   de ahorro de contexto que persigue el resto del repo. No cambia lo que verifica AC-5.
2. **Ninguna otra.** El texto del paso 2, la regla, el `output_file` y el fix del README
   salieron literales del `design.md` aprobado.

## Observaciones de dogfooding (para el archive / plan maestro)

- **Las skills instaladas en `~/.claude/skills/` están atrasadas respecto de `main`.**
  El `sdd-apply` que corrió esta sesión todavía dice `.playbook/runs/`, path que el Ciclo A
  (PR #9, mergeado) ya corrigió a `.specloom/runs/`. El código sí escribe en
  `.specloom/runs/` — verificado en cada log de esta sesión. Falta correr
  `playbook install`/`sync` tras los merges de los Ciclos A/B.
- **Consecuencia directa para este ciclo:** el `sdd-design` que produjo el `design.md` es
  la copia previa al change, sin el paso 2. El paso no se autoejecutó; su regla se cumplió
  a mano (contrato no tocado porque `impact.public_contract: false` → camino de EC-3).
- **La compactación de `playbook run` no acota el output de una aserción de `node --test`
  con un `actual` gigante.** El "last 40 lines" incluyó el README completo serializado.
  No es un bug de scope acá, pero es un caso real donde la compactación no ahorra: la
  mitigación aplicable es del lado del test (desviación 1), no del comando.

## Addendum post-apply (remediaciones de gates)

Cambios aplicados **después** de que este `tasks.md` pasara a `passed`, cada uno
originado en un hallazgo de un gate y re-verificado con la suite completa:

1. **`sdd-code-review` / Issue 1** — `## Phase 4` reescrita con las etiquetas
   exactas del template de `sdd-plan` (`Format`, `Lint/type-check`,
   `Feature tests`, `Regression`) y sin backticks de prosa, para que
   `playbook packet` extraiga los comandos reales. `context-packet.md`
   regenerado. No cambia ningún AC.
2. **`sdd-security-gate` / SEC-F1** — `skills/sdd-design/canonical.md` paso 2
   gana la restricción de contención de la ruta ("The resolved path must stay
   **inside the repo** — if it escapes the project root, stop and report it
   instead of writing"), más su aserción en el test de AC-2. Regenerado con
   `npm run generate`.

Re-verificación tras ambas: `npm test` = **345 pass / 0 fail**,
`npm run generate:check` sin drift.
