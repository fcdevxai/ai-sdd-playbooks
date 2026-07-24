---
schema: tasks
schema_version: 1
change_id: convention-drift-verify-commit
status: passed
updated: 2026-07-24
---
# Tasks — Restaurar `pwd` en `sdd-verify` y el retry cap en `sdd-commit`

> **Orden TDD.** La Fase 1 escribe las 7 aserciones **antes** de tocar cualquier
> `canonical.md`. De las 7: **5 arrancan en rojo**, 1 es mixta (SEC-001: mitad
> negativa verde, positiva roja) y 1 arranca verde (guarda de no-regresión sobre
> `sdd-apply`/`sdd-new`). Fases 2-3 las ponen todas en verde.
>
> **Principio 1.** Cada tarea que edita un `canonical.md` incluye su
> `npm run generate` — el par es atómico: un `canonical.md` editado sin regenerar
> deja desincronizado el `SKILL.md`, que es lo que se instala y lo que leen los tests.
>
> **Textos literales.** El texto exacto de cada inserción está en
> `design.md` → `## Approach`, secciones 1 y 2. Se replica de specloom (la
> referencia de intención original de ADR-011), no se reescribe.
>
> Todos los comandos corren **desde la raíz del repo**. `sdd-apply` los ejecuta vía
> `playbook run --change convention-drift-verify-commit --step apply -- <cmd>`.

## Phase 1 — Aserciones de contenido (TDD, rojo primero)

Todas en `test/skill-contract.test.js`, contra el `SKILL.md` generado vía el helper
`body(name)` ya existente. Nomenclatura `('… (AC-N)')`, igual que las aserciones de
packet/spec-index/contract-authoring.

### Task 1.1 — Aserción A: `pwd` en los 3 lugares de `sdd-verify` [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-verify verifies pwd before running feature and regression commands (AC-1)`.
  Sobre `body('sdd-verify')`: el chequeo del paso 1, el de antes de la regresión, y
  la regla de `## Rules`.
- **Success criterion**: `node --test test/skill-contract.test.js` falla nombrando
  este test por texto ausente (`grep -c pwd skills/sdd-verify/canonical.md` = 0 hoy).
- **Linked acceptance criterion**: AC-1

### Task 1.2 — Aserción B: el wording cubre `context-packet.md` [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-verify's pwd rule covers context-packet.md commands, not just tasks.md (AC-2)`.
  Matchea `context-packet.md` en el contexto del chequeo de `pwd` — post Ciclo A los
  comandos de verificación salen del packet, no de `tasks.md`.
- **Success criterion**: falla en rojo por texto ausente.
- **Linked acceptance criterion**: AC-2

### Task 1.3 — Aserción C: el cap de 3 iteraciones en `sdd-commit` [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-commit caps the fix→validate→re-run loop at 3 iterations (AC-3)`.
  Matchea `capped at 3 iterations` y el stop del 4º intento reportando la salida
  textual de `playbook validate`.
- **Success criterion**: falla en rojo (hoy `sdd-commit` dice "stop on any
  violation", sin loop ni cap).
- **Linked acceptance criterion**: AC-3

### Task 1.4 — Aserción D: guard contra ediciones a ciegas [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-commit forbids blind edits inside the retry loop (AC-4)`.
  Matchea `don't reason about the reports yourself` y `without further blind edits`
  — el guard language de specloom, no sólo el número.
- **Success criterion**: falla en rojo por texto ausente.
- **Linked acceptance criterion**: AC-4

### Task 1.5 — Aserción E: alcance derivado vs firmado [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-commit's retry loop regenerates derived artifacts and never edits signed ones (AC-5)`.
  Matchea: `playbook packet` como fix permitido; la prohibición nombrando
  `proposal.md`, `design.md`, `tasks.md` y los reportes de gate; `without consuming
  an iteration`; y la frase de default estricto (lo no nombrado como regenerable
  cuenta como firmado).
- **Success criterion**: falla en rojo por texto ausente.
- **Linked acceptance criterion**: AC-5

### Task 1.6 — Aserción F: SEC-001 (negativa primero, después positiva) [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-commit never makes validate pass by weakening a gate status (SEC-001)`.
  **Mitad negativa, escrita y asertada primero**: el body no contiene ninguna
  instrucción de escribir o flipear un status de reporte —
  `doesNotMatch(/(set|change|update|edit|flip)[^.\n]{0,60}(security-report|gate report|report'?s? status)/i)`
  y `doesNotMatch(/status:\s*passed/i)`. **Ambos regex ya validados contra el body
  actual: 0 matches** (`grep -ci` sobre `skills/sdd-commit/SKILL.md`), así que la
  mitad negativa es viable y arranca verde. **Mitad positiva**: el body contiene la
  prohibición explícita y **sigue conteniendo** `Do not commit around a blocking
  finding` (verificado presente hoy, 1 match) — la regla preexistente sobre la que
  SEC-001 se apoya; si desaparece, SEC-001 queda huérfano.
- **Success criterion**: la mitad **negativa** pasa desde el arranque y **debe
  seguir pasando** tras la Fase 3 — ése es el test negativo de SEC-1, no un
  formalismo: si el texto nuevo introdujera un ejemplo con `status: passed`, se
  ajusta el regex y **nunca** se ablanda la instrucción. La mitad positiva falla en
  rojo hasta la Task 3.2.
- **Linked acceptance criterion**: AC-5 (SEC-1 / control SEC-001)

### Task 1.7 — Aserción G: `sdd-apply` y `sdd-new` conservan lo que se replica [x]
- **Files**: `test/skill-contract.test.js`
- **Qué**: test `sdd-apply and sdd-new keep the conventions this change replicates (AC-1, AC-3)`.
  `sdd-apply` sigue mencionando `pwd`; `sdd-new` sigue mencionando el cap de 3
  iteraciones.
- **Success criterion**: pasa en **verde desde el arranque** y queda como
  no-regresión: este change replica **desde** esos dos skills, así que si la fuente
  se borra la convención vuelve a quedar a medias.
- **Linked acceptance criterion**: AC-1, AC-3

## Phase 2 — Wiring de `sdd-verify`

### Task 2.1 — `pwd` en paso 1, paso 5 y `## Rules` [x]
- **Files**: `skills/sdd-verify/canonical.md`, `skills/sdd-verify/SKILL.md` (regenerado)
- **Qué**: insertar los tres textos de `design.md` → `## Approach` § 1: versión
  corta en el paso 1, versión larga (con la nota de los `tasks.md`/`context-packet.md`
  viejos que asumen un `cd`) en el paso 5, y la regla transversal en `## Rules`.
  Luego `npm run generate`.
- **Depende de**: Tasks 1.1, 1.2 (sus tests deben existir en rojo antes).
- **Success criterion**: las aserciones A y B pasan; `npm run generate:check` sin drift.
- **Linked acceptance criterion**: AC-1, AC-2

## Phase 3 — Wiring de `sdd-commit`

### Task 3.1 — Paso 1: loop acotado con alcance restringido [x]
- **Files**: `skills/sdd-commit/canonical.md`, `skills/sdd-commit/SKILL.md` (regenerado)
- **Qué**: reemplazar el paso 1 actual ("Run `playbook validate` — stop on any
  violation.") por el texto de `design.md` → `## Approach` § 2: cap de 3
  iteraciones, guard de no razonar sobre los reportes ni editar a ciegas, alcance
  restringido a regeneración determinista (`playbook packet`), lista explícita de
  artefactos firmados, default estricto, y el stop sin consumir iteración. Luego
  `npm run generate`.
- **Depende de**: Tasks 1.3, 1.4, 1.5.
- **Success criterion**: las aserciones C, D y E pasan; la mitad negativa de F sigue
  verde; `generate:check` sin drift.
- **Linked acceptance criterion**: AC-3, AC-4, AC-5 (EC-1, EC-2)

### Task 3.2 — Las 2 reglas de `## Rules` (una ligada a SEC-001) [x]
- **Files**: `skills/sdd-commit/canonical.md`, `skills/sdd-commit/SKILL.md` (regenerado)
- **Qué**: (a) el cap como regla transversal; (b) **la regla de SEC-001**: nunca
  hacer pasar `validate` debilitando el status de un reporte de gate, y menos el de
  `security-report.md` — un presupuesto de reintentos nunca prevalece sobre una
  regla de seguridad. La regla existente "Do not commit around a blocking finding"
  **no se toca**. Luego `npm run generate`.
- **Depende de**: Task 1.6.
- **Success criterion**: la aserción F pasa **completa** — la mitad **negativa**
  (sin instrucción de escribir/flipear un status de reporte, sin `status: passed`)
  sigue verde, y la positiva (prohibición presente + `Do not commit around a
  blocking finding` intacta) pasa a verde. Si la negativa se pusiera roja, la tarea
  **no** se marca completa: se corrige el texto, no el test.
- **Linked acceptance criterion**: AC-5 (SEC-1 / control SEC-001)

## Phase 4 — Quality gates

> Etiquetas exactas del template de `sdd-plan`, sin backticks de prosa: `playbook
> packet` extrae los comandos de estas líneas con un regex que sólo reconoce
> `Format|Lint/type-check|Feature tests|Regression` y se lleva todos los tokens
> entre backticks de la línea. Lección del Ciclo C, donde etiquetas propias dejaron
> `npm test` afuera del packet sin ningún warning.

- **Format**: (sin formatter configurado)
- **Lint/type-check**: `node --check test/skill-contract.test.js`
- **Feature tests**: `node --test test/skill-contract.test.js`
- **Regression**: `npm test` + `npm run generate:check`

Referencia de regresión: **345 tests verdes** en `main` (`7054b9e`); con los 7
nuevos deberían quedar **352**. `generate:check` cubre AC-6.

**Chequeo manual de no-scope** (no es comando de gate, no va al packet):
`git diff --stat` no debe listar nada bajo `src/`, `schemas/`, `templates/`, ni en
`skills/sdd-apply/`, `skills/sdd-new/` o `README.md` (no-goals del proposal).

---

# Execution Report

**Fecha:** 2026-07-24 · **Resultado:** 10/10 tareas `[x]`, gates verdes, sin desviaciones.

## Criterios de aceptación → evidencia

| AC | Evidencia | Estado |
|---|---|---|
| AC-1 | `sdd-verify verifies pwd before running feature and regression commands (AC-1)` + la guarda `sdd-apply and sdd-new keep the conventions this change replicates` | ✅ |
| AC-2 | `sdd-verify's pwd rule covers context-packet.md commands, not just tasks.md (AC-2)` | ✅ |
| AC-3 | `sdd-commit caps the fix→validate→re-run loop at 3 iterations (AC-3)` | ✅ |
| AC-4 | `sdd-commit forbids blind edits inside the retry loop (AC-4)` | ✅ |
| AC-5 | `sdd-commit's retry loop regenerates derived artifacts and never edits signed ones (AC-5)` + `sdd-commit never makes validate pass by weakening a gate status (SEC-001)` | ✅ |
| AC-6 | `npm run generate:check` sin drift | ✅ |
| AC-7 | 7 aserciones nuevas; `npm test` = **352 pass / 0 fail** (345 en `main` + 7, exactamente lo que predijo el diseño) | ✅ |

## Casos de borde y controles

- **EC-1 / EC-2** — cubiertos por el texto del paso 1 de `sdd-commit` y asertados:
  `without consuming an iteration` (stop sin gastar presupuesto), `4th failed attempt` +
  `exactly as playbook validate returns them` (agotamiento del cap), y
  `not named regenerable counts as signed` (default estricto).
- **EC-3** — verificado **empíricamente** en el rojo de TDD: 6 fallos por texto ausente
  antes del wiring (39 pass / 6 fail).
- **EC-4** — `generate:check` verde; es el gate del drift y corre en CI.
- **SEC-001 — el test negativo se escribió y corrió PRIMERO**, como exige la regla para
  una tarea ligada a un `SEC-N`. Las dos mitades negativas
  (`doesNotMatch` de verbo+reporte, y de `status: passed`) pasaron desde el arranque
  y **siguen pasando contra el body nuevo**: `grep -ci` = **0** en ambos casos tras el
  wiring. La mitad positiva pasó de roja a verde en la Task 3.2. Bonus verificable:
  `Do not commit around a blocking finding` pasó de **1** a **2** apariciones — la regla
  original más la referencia explícita desde la regla nueva, que es justamente la
  dependencia que el test custodia.
- **SEC-002** — `git diff --stat` sobre `src/ schemas/ templates/ skills/sdd-apply/
  skills/sdd-new/ README.md` → **0 líneas**. Los 5 archivos tocados son
  `skills/sdd-{verify,commit}/{canonical,SKILL}.md` y `test/skill-contract.test.js`.

## Comandos (todos vía `playbook run --change convention-drift-verify-commit --step apply`)

| Comando | Resultado |
|---|---|
| `node --test test/skill-contract.test.js` (rojo TDD) | 39 pass / **6 fail** — 5 rojas + la positiva de SEC-001; la negativa de SEC-001 y la guarda 1.7 verdes |
| `npm run generate` (tras Fase 2) | ✅ |
| `node --test test/skill-contract.test.js` | 41 pass / 4 fail — A y B verdes |
| `npm run generate` (tras Fase 3) | ✅ |
| `node --test test/skill-contract.test.js` | ✅ **45/45** |
| `node --check test/skill-contract.test.js` | ✅ |
| `npm test` | ✅ **352 pass / 0 fail** |
| `npm run generate:check` | ✅ sin drift |

**Cero reintentos consumidos**: cada tarea pasó en el primer intento (cap: 2 reintentos
por tarea). Ninguna corrección de test fue necesaria — a diferencia del Ciclo C, donde
hubo que ajustar un regex por un salto de línea. Motivo probable: los regex de
multilínea se escribieron con `\s*\n?\s*` desde el arranque, aprendido de ese ciclo.

## Desviaciones respecto del plan

**Ninguna.** Los textos salieron literales del `design.md` aprobado; las 7 aserciones
son las 7 planeadas; el conteo de regresión (352) coincide con la predicción del diseño.

## Observaciones de dogfooding

- **Primer ciclo con las skills instaladas al día.** `playbook install` se corrió antes
  de arrancar (verificado byte a byte contra `main`), así que el `sdd-apply` de esta
  sesión ya trae `.specloom/runs/` en vez del `.playbook/runs/` viejo — el fix del
  Ciclo A funcionando en el prompt, no sólo en el test.
- **El paso 2 de `sdd-design` (Ciclo C) se ejecutó de verdad y se comportó bien.** Con
  `impact.public_contract: false`, la instrucción indicó no tocar el contrato canónico
  y no se tocó: 0 archivos modificados bajo `openspec/specs/contracts/`, `openapi.yaml`
  sigue en `paths: {}`. Y la guarda que decidió fue el flag del proposal, no la ausencia
  de config — `contract.path_in_loom` **sí** está configurado en este repo. Es la
  primera ejecución real de ese wiring.
- **Límite honesto, ya anticipado en el `design.md`:** los tests prueban que las
  instrucciones **están**, no que un agente las **obedezca**. El comportamiento nuevo de
  `sdd-commit` (regenerar un packet stale y reintentar; detenerse ante un artefacto
  firmado) no es ejercitable por `node --test`. Se va a ejercitar recién cuando un ciclo
  futuro tropiece con un `validate` fallido **y** con la skill reinstalada — no antes.
  El `sdd-commit` que corra en este mismo ciclo todavía es la copia previa al change.
