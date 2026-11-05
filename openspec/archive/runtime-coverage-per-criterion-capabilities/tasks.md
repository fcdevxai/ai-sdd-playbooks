---
schema: tasks
schema_version: 1
change_id: runtime-coverage-per-criterion-capabilities
status: passed
updated: '2026-11-04'
handoff:
  specs:
    - {repository: loom, path: openspec/specs/cli/spec.md}
    - {repository: loom, path: openspec/specs/playbooks/spec.md}
    - {repository: loom, path: openspec/specs/system.md}
    - {repository: loom, path: openspec/specs/adr/ADR-043-evidence-bound-lifecycle-threat-model.md}
  architecture:
    - {repository: loom, path: docs/doc_architecture.md}
    - {repository: loom, path: docs/doc_verification_guide.md}
    - {repository: loom, path: docs/agent_architecture.md}
    - {repository: loom, path: docs/security-checklist.md}
  contracts: []
  required_skills:
    - {name: sdd-apply, repository: loom, path: skills/sdd-apply/SKILL.md}
  required_tools:
    - {name: playbook, context: loom, purpose: lifecycle}
    - {name: node, context: loom, purpose: test-runner}
    - {name: git, context: loom, purpose: worktree isolation from the global CLI checkout}
  runtime_coverage: []
  non_runtime:
    - {criterion: AC-1, rationale: Schema acceptance and rejection of the new list; proven by schema unit tests, no runtime surface (cli excluded by ADR-032).}
    - {criterion: AC-2, rationale: Transport of the list by buildHandoffManifest and unchanged manifest when absent; proven by handoff unit tests, no runtime surface (cli excluded by ADR-032).}
    - {criterion: AC-3, rationale: Pure validator behavior for a valid omission; proven by unit tests of validateRuntimeCoverage, no runtime surface (cli excluded by ADR-032).}
    - {criterion: AC-4, rationale: Pure validator behavior without omission (rule unchanged); proven by the existing and adjusted unit tests, no runtime surface (cli excluded by ADR-032).}
    - {criterion: AC-5, rationale: Pure validator behavior of the per-adapter requirement; proven by unit tests, no runtime surface (cli excluded by ADR-032).}
    - {criterion: AC-6, rationale: Text of a validator message; proven by a unit test, no runtime surface (cli excluded by ADR-032).}
    - {criterion: AC-7, rationale: Skill instruction text in sdd-plan and sdd-runtime-gate; proven by the skill contract test and generate:check, no runtime surface.}
    - {criterion: AC-8, rationale: ADR drafts under the change folder, promoted at archive; proven by playbook validate and the adr tests, no runtime surface.}
    - {criterion: AC-9, rationale: Version, changelog and pin files; proven by the readme test and npm test, no runtime surface.}
    - {criterion: AC-10, rationale: Full test suite result; proven by running npm test, no runtime surface.}
    - {criterion: EC-1, rationale: Validator error for an empty rationale; proven by a unit test, no runtime surface (cli excluded by ADR-032).}
    - {criterion: EC-2, rationale: Validator error for an omission of an unmapped pair; proven by a unit test, no runtime surface (cli excluded by ADR-032).}
    - {criterion: EC-3, rationale: Validator error for a disabled or unknown capability; proven by a unit test, no runtime surface (cli excluded by ADR-032).}
    - {criterion: EC-4, rationale: Validator error for a capability both mapped and omitted; proven by a unit test, no runtime surface (cli excluded by ADR-032).}
    - {criterion: EC-5, rationale: Validator error for unknown criterion or repository in an omission; proven by a unit test, no runtime surface (cli excluded by ADR-032).}
    - {criterion: EC-6, rationale: Validator error for duplicate omissions; proven by a unit test, no runtime surface (cli excluded by ADR-032).}
    - {criterion: EC-7, rationale: Malformed list in packet and validator without uncontrolled exceptions; proven by unit tests, no runtime surface (cli excluded by ADR-032).}
    - {criterion: SEC-1, rationale: No secrets or personal data introduced; proven by review of the touched files and the unchanged scope, no runtime surface.}
    - {criterion: SEC-2, rationale: Explicit validated omissions covered by the manifest hash; proven by validator and governed-digest unit tests, no runtime surface (cli excluded by ADR-032).}
    - {criterion: SEC-3, rationale: Per-adapter requirement unchanged; proven by the AC-5 unit tests, no runtime surface (cli excluded by ADR-032).}
    - {criterion: SEC-4, rationale: Malformed input fails closed; proven by the EC-7 unit tests, no runtime surface (cli excluded by ADR-032).}
    - {criterion: SEC-5, rationale: Accepted-risk row in docs/security-checklist.md; proven by a content assertion in the readme test, no runtime surface.}
  unresolved_risks:
    - "El adaptador cli (experimental) queda excluido por runtime_relevant_capabilities: [] segun ADR-032; la sustitucion es un test unitario que falla contra el codigo anterior y una invocacion registrada antes y despues (Task 2.3)."
    - "Los pins de version de README.md y de las dos plantillas CI no figuran en Impacted modules de la proposal; se actualizan porque test/readme.test.js los exige iguales a la version del paquete."
  blockers: []
---
# Tasks — Cobertura de runtime por criterio con omisiones explícitas de capacidades

## Rules

- Todos los comandos corren desde la raíz del worktree
  `~/ai-sdd-playbooks-wt/runtime-coverage-per-criterion-capabilities`; nunca desde el checkout
  principal `~/ai-sdd-playbooks`, que sirve al `playbook` global. Usar `node bin/playbook.js`
  para ejecutar el CLI en curso.
- Cada tarea tiene un criterio de éxito verificable; las pruebas se escriben antes que el
  código (TDD) dentro de la misma fase.
- Correr los tests con `node test/helpers/run-tests.js <archivo>`; nunca `node --test` directo.
- Las skills se editan en `skills/<nombre>/canonical.md` y se regeneran con `npm run generate`.
- Toda tarea que implementa un `SEC-N` nombra su prueba negativa en el criterio de éxito.
- Sin push ni pull request sin aprobación explícita; sin tocar el checkout principal.
- No se edita ADR-043 ni `openspec/specs/cli/spec.md`; los ADR del change son drafts y se
  promueven en `sdd-archive`.
- Dependencias: Fase 1 → Fase 2 → Fase 3; la Fase 4 depende de las Fases 1 a 3.

## Preconditions (self-check)

Verificadas: `proposal.status == approved`; diseño no requerido (`design_required: false`, las
decisiones están en los dos ADR drafts del change).

## Phase 1 — Campo `runtime_not_applicable`: esquemas y transporte

### Task 1.1 — Pruebas rojas de esquema y de manifest
- [x] Complete.
- **Files**: `test/handoff-schema.test.js`, `test/handoff.test.js`
- **Success criterion**: pruebas nuevas que fallan contra el código actual y cubren: `tasks.schema.json` acepta `handoff.runtime_not_applicable` con entradas `{criterion, repository, capability, rationale}` y rechaza entradas sin alguno de los cuatro campos, con propiedades adicionales o que no sean lista (AC-1); `buildHandoffManifest` copia la lista al manifest como `runtime_not_applicable` y la incluye en el contenido gobernado que se hashea (AC-2, SEC-2); con la lista ausente o vacía el manifest no contiene el campo y su contenido gobernado es idéntico al actual (AC-2); lista que no es arreglo o con entradas que no son objetos hace fallar `playbook packet` con un mensaje y sin excepción no controlada (EC-7, SEC-4, prueba negativa).
- **Depends on**: —
- **Linked acceptance criterion**: AC-1, AC-2, EC-7, SEC-2, SEC-4

### Task 1.2 — Esquemas aditivos
- [x] Complete.
- **Files**: `schemas/tasks.schema.json`, `schemas/handoff-manifest.schema.json`
- **Success criterion**: ambos esquemas declaran la lista opcional con entradas de cuatro campos obligatorios y `additionalProperties: false` en cada entrada; las pruebas de esquema de la tarea 1.1 pasan; los fixtures existentes siguen validando.
- **Depends on**: 1.1
- **Linked acceptance criterion**: AC-1, SEC-4

### Task 1.3 — Transporte en `playbook packet`
- [x] Complete.
- **Files**: `src/tokens/handoff.js`
- **Success criterion**: `buildHandoffManifest` valida la forma de `handoff.runtime_not_applicable` (lista; entradas objeto con `criterion`, `repository`, `capability` y `rationale` de texto), la copia al manifest solo cuando no está vacía, y la incluye en el contenido gobernado; la lista ausente no altera el manifest ni su hash; las pruebas de la tarea 1.1 pasan.
- **Depends on**: 1.2
- **Linked acceptance criterion**: AC-2, EC-7, SEC-2, SEC-4

## Phase 2 — Validador de cobertura de runtime

### Task 2.1 — Pruebas rojas del validador
- [x] Complete.
- **Files**: `test/runtime-coverage.test.js`
- **Success criterion**: la prueba que fija la regla actual (`repository-specific capability applicability excludes unrelated workspaces`) se ajusta para exigir el mismo error sin omisión y aceptar la omisión explícita; pruebas nuevas que fallan contra el código actual cubren: omisión válida sin fila de cobertura para esa capacidad y con el adaptador cubierto por otro criterio (AC-3); sin omisión sigue el error `enabled capability … not mapped` (AC-4); capacidad omitida en todos los criterios con el adaptador `passed` sin recibos ligados, o sin adaptador, sigue fallando (AC-5, SEC-3, prueba negativa); mensaje multi-repo que nombra criterio, repositorio y capacidad e indica partir la entrada por repositorio (AC-6); errores con mensaje por par para motivo vacío o en blanco (EC-1, SEC-2), par no mapeado (EC-2), capacidad deshabilitada o desconocida (EC-3), mapeada y omitida a la vez (EC-4), criterio o repositorio desconocidos (EC-5), duplicados (EC-6); lista `runtime_not_applicable` que no es arreglo o con entradas no objeto produce problemas reportados sin lanzar excepción (EC-7, SEC-4, prueba negativa).
- **Depends on**: 1.3
- **Linked acceptance criterion**: AC-3, AC-4, AC-5, AC-6, EC-1, EC-2, EC-3, EC-4, EC-5, EC-6, EC-7, SEC-2, SEC-3, SEC-4

### Task 2.2 — Regla por criterio con omisiones explícitas
- [x] Complete.
- **Files**: `src/lifecycle/runtime-coverage.js`
- **Success criterion**: `validateRuntimeCoverage` lee `manifest.runtime_not_applicable`; para cada par criterio/repositorio mapeado, una capacidad habilitada sin mapear solo se acepta con una omisión válida y deja de exigir su fila de cobertura, y todo otro caso conserva el error actual; implementa las seis validaciones de omisión de EC-1 a EC-6 con mensajes que identifican el par; el error de mapeo contradictorio multi-repo añade la indicación de partir la entrada por repositorio; la exigencia de adaptadores (`requiredAdapters`, recibos ligados, exclusiones) y la regla `receipt.repository === row.repository` no cambian; toda la suite `runtime-coverage.test.js` pasa.
- **Depends on**: 2.1
- **Linked acceptance criterion**: AC-3, AC-4, AC-5, AC-6, EC-1, EC-2, EC-3, EC-4, EC-5, EC-6, EC-7, SEC-2, SEC-3, SEC-4

### Task 2.3 — Registrar el comportamiento antes y después (sustituto del adaptador `cli`, ADR-032)
- [x] Complete.
- **Files**: ninguno nuevo; se ejecuta `node bin/playbook.js run` sobre el script de la tarea con recibos en `.specloom/runs/`.
- **Success criterion**: dos recibos de `node bin/playbook.js run --change runtime-coverage-per-criterion-capabilities --step apply --repo loom --agent claude --provider anthropic --model claude-sonnet-5-5 -- node -e <script>`: uno contra el código anterior (la versión de `origin/main` extraída con `git show` a un archivo temporal fuera del repo) que muestra el error `enabled capability worker not mapped` para un criterio con omisión declarada, y otro contra el código nuevo que muestra el resultado sin ese error; al menos una prueba unitaria de la tarea 2.1 falla contra el código anterior.
- **Depends on**: 2.2
- **Linked acceptance criterion**: AC-3, AC-4

## Phase 3 — Documentación y skills

### Task 3.1 — Pruebas rojas de contenido
- [x] Complete.
- **Files**: `test/skill-contract.test.js`, `test/readme.test.js`
- **Success criterion**: aserciones que fallan contra el contenido actual y exigen: `skills/sdd-plan/canonical.md` documenta `runtime_not_applicable` y la regla de partir `runtime_coverage` por repositorio cuando difieren sus capacidades; `skills/sdd-runtime-gate/canonical.md` documenta que las omisiones no requieren fila de cobertura y que `--repo` de `playbook run` identifica el sistema probado aunque el comando corra en el contenedor de otro repositorio (AC-7); `docs/security-checklist.md` contiene la fila de riesgo aceptado sobre la veracidad no verificable del motivo de una omisión (SEC-5).
- **Depends on**: 2.2
- **Linked acceptance criterion**: AC-7, SEC-5

### Task 3.2 — Skills y checklist de seguridad
- [x] Complete.
- **Files**: `skills/sdd-plan/canonical.md`, `skills/sdd-runtime-gate/canonical.md`, `docs/security-checklist.md`
- **Success criterion**: el texto cubre lo exigido en 3.1; `npm run generate` regenera los `SKILL.md` correspondientes y `npm run generate:check` no reporta diferencias; las aserciones de 3.1 pasan.
- **Depends on**: 3.1
- **Linked acceptance criterion**: AC-7, SEC-5

## Phase 4 — Release 0.12.0

### Task 4.1 — Prueba roja de versión
- [x] Complete.
- **Files**: `test/readme.test.js`
- **Success criterion**: la prueba `release version, changelog and CI pins agree` exige `0.12.0` en `package.json`, `package-lock.json` (ambos campos), `CHANGELOG.md`, el comando de instalación de `README.md` y las dos plantillas CI, y falla contra los archivos actuales.
- **Depends on**: 3.2
- **Linked acceptance criterion**: AC-9

### Task 4.2 — Archivos de release
- [x] Complete.
- **Files**: `CHANGELOG.md`, `package.json`, `package-lock.json`, `README.md`, `templates/project/github/workflows/playbook-validation.yml`, `templates/project/github/workflows/contract-drift-check.yml`
- **Success criterion**: `CHANGELOG.md` tiene una entrada `0.12.0` que describe la omisión explícita, el campo `runtime_not_applicable` y la compatibilidad (un CLI anterior ignora el campo y el gate sigue fallando cerrado); las tres versiones valen `0.12.0` y los pins `semver:^0.12.0` coinciden; la prueba de 4.1 pasa.
- **Depends on**: 4.1
- **Linked acceptance criterion**: AC-9

## Phase 5 — Quality gates

- **Format**: `N/A (no formatter configured)`
- **Lint/type-check**: `node --check src/lifecycle/runtime-coverage.js && node --check src/tokens/handoff.js && node --check test/runtime-coverage.test.js && node --check test/handoff.test.js && node --check test/handoff-schema.test.js && node --check test/skill-contract.test.js && node --check test/readme.test.js`
- **Feature tests**: `node test/helpers/run-tests.js test/runtime-coverage.test.js test/handoff.test.js test/handoff-schema.test.js test/skill-contract.test.js test/readme.test.js`
- **Regression**: `npm test && npm run generate:check && node bin/playbook.js validate --ci`

## Execution Report

### Resultado final — 2026-11-04

`passed`. Las diez tareas están completas y las compuertas locales pasaron. No hubo STOP ni
ambigüedad de spec, y ninguna tarea necesitó más de un ciclo rojo→verde. No se creó ningún ADR
nuevo: las decisiones estaban en los dos drafts del change. No se tocaron archivos fuera de
`Files touched` de las tareas; el checkout principal `~/ai-sdd-playbooks` no se modificó.

Implementación:

- `tasks.schema.json` y `handoff-manifest.schema.json` aceptan la lista opcional
  `runtime_not_applicable` (cuatro campos obligatorios, sin propiedades extra).
- `playbook packet` valida la forma de la lista, la copia al manifest solo si no está vacía y la
  incluye en el contenido gobernado que se hashea; con la lista ausente o vacía el manifest no cambia.
- `validateRuntimeCoverage` acepta una capacidad habilitada sin mapear solo con una omisión
  válida, y reporta por par los errores de EC-1 a EC-7; la exigencia por adaptador, las
  exclusiones y `receipt.repository === row.repository` no cambiaron. El mensaje del mapeo
  contradictorio de entradas multi-repo indica partir la entrada por repositorio.
- `sdd-plan` y `sdd-runtime-gate` documentan la regla, las omisiones y el etiquetado de recibos;
  `docs/security-checklist.md` registra el riesgo aceptado; versión `0.12.0` con `CHANGELOG.md`.

Notas de la tarea 2.1: la prueba existente `repository-specific capability applicability
excludes unrelated workspaces` no necesitó cambios, porque sin omisión la regla actual se
conserva; el caso con omisión se cubre con pruebas nuevas.

### Cobertura de criterios

| Criterios | Evidencia | Resultado |
|---|---|---|
| AC-1, SEC-4 | `test/handoff-schema.test.js`: dos pruebas nuevas (tasks y manifest) | Verificado |
| AC-2, EC-7, SEC-2 | `test/handoff.test.js`: transporte, hash gobernado, lista ausente o vacía, lista mal formada | Verificado |
| AC-3, AC-4, AC-5, SEC-3 | `test/runtime-coverage.test.js`: omisión válida, sin omisión, exigencia por adaptador, fila sobrante | Verificado |
| AC-6 | `test/runtime-coverage.test.js`: mensaje multi-repo con y sin indicación | Verificado |
| EC-1 a EC-6, SEC-2 | `test/runtime-coverage.test.js`: una prueba por caso de error | Verificado |
| AC-7, SEC-5 | `test/skill-contract.test.js`, `test/readme.test.js` y `generate:check` | Verificado |
| AC-8 | Dos ADR drafts del change; `playbook validate` los valida | Verificado |
| AC-9 | `test/readme.test.js` (versión, changelog, README y plantillas) | Verificado |
| AC-10 | `npm test`: 873 pruebas, 865 pasan, 0 fallan, 8 `todo` preexistentes | Verificado |
| SEC-1 | Revisión de los archivos tocados: sin secretos ni datos personales | Verificado |

### Recibos

Cada ID corresponde a `.specloom/runs/<ID>/execution-receipt.json`, con `full.log`, `stdout.raw`
y `stderr.raw` en el mismo directorio. Se ejecutaron con `node bin/playbook.js run --change
runtime-coverage-per-criterion-capabilities --step apply --repo loom --agent claude --provider
anthropic --model claude-sonnet-5-5 --` desde el worktree.

| ID | Comando después de `--` | Resultado |
|---|---|---|
| `1793828684204-3c7c434c-sMYAfv` | `node test/helpers/run-tests.js test/handoff-schema.test.js test/handoff.test.js` | Rojo esperado, cinco pruebas nuevas |
| `1793828701589-01d8ac1b-9jskhl` | igual | Rojo esperado, cuatro pruebas nuevas (corregida la prueba de lista vacía) |
| `1793828716932-27778b9e-uXoova` | `… handoff-schema … handoff … schema` | Rojo esperado: esquemas verdes, transporte pendiente |
| `1793828729956-634eaacc-JD6JUm` | igual | Verde, 38 pruebas |
| `1793828791976-6810d915-yEUqKy` | `node test/helpers/run-tests.js test/runtime-coverage.test.js` | Rojo esperado, nueve pruebas nuevas |
| `1793828816099-2fcf6f90-G1uPMs` | igual | Verde, 23 pruebas |
| `1793828863515-d5518c9b-QDqlsM` | `node rc-demo.mjs <runtime-coverage.js de origin/main>` | Antes: `AC-1 service enabled capability worker not mapped` |
| `1793828864238-8637520f-eihItD` | `node rc-demo.mjs <runtime-coverage.js del worktree>` | Después: sin problemas |
| `1793828905335-0637e6b6-dFQnK3` | `… skill-contract … readme` | Rojo esperado, tres pruebas nuevas |
| `1793828948539-a636f76a-K7GN7n` | `npm run generate` | Verde |
| `1793828949361-49541caa-eEcm8p` | `npm run generate:check` | Verde |
| `1793828950181-12220fb9-61JbgZ` | `… skill-contract … readme` | Rojo esperado: solo la prueba de versión |
| `1793828964591-09b5a2b4-nd2H2R` | `… readme` | Verde, 5 pruebas |
| `1793828974396-82cdb800-kaBNbc` | `node --check` de los siete archivos tocados | Verde |
| `1793828975144-b98e125f-k7kIYN` | pruebas focalizadas de la compuerta | Verde, 112 pruebas |
| `1793828985234-6c5170e8-wce8ob` | `npm test` | Verde, 873 pruebas (865 pasan, 8 `todo` preexistentes) |
| `1793829210801-2347b69c-JtkpTo` | `npm run generate:check` | Verde |
| `1793829224137-7097760b-vLLz5c` | `node bin/playbook.js validate --ci` | Rojo esperado: handoff desactualizado por los cambios; se regenera con `playbook packet` y se vuelve a validar |
| `1793829279479-6df06353-2wkvO4` | `node bin/playbook.js validate --ci` (tras regenerar el handoff con `playbook packet --stage sdd-apply`) | Verde: 8 artefactos revisados, 0 fallos |

El «antes» de la tarea 2.3 usa el `src/` de `origin/main` extraído con `git archive` a un
directorio temporal fuera del repo; el script de demostración también vive fuera del repo.
`git diff --check` y la ausencia de archivos nuevos de implementación (solo se editaron
archivos existentes) significan que no hace falta `handoff.source_paths`. No se ejecutó commit,
push ni pull request.

### Corrección de la ronda 1 de `sdd-code-review` — 2026-11-04

Se corrigió solo el hallazgo bloqueante Issue 1 (EC-7, SEC-4): `playbook packet` aceptaba
`runtime_not_applicable:` sin valor (YAML `null`) como lista vacía. Ahora solo la clave ausente
equivale a «sin omisiones»; `null` falla con `tasks.md handoff.runtime_not_applicable must be a list`.

| ID | Comando después de `--` | Resultado |
|---|---|---|
| `1793833381367-abf9dab1-G7CNe6` | `node test/helpers/run-tests.js test/handoff.test.js` | Rojo esperado: el caso `runtime_not_applicable:` sin valor no fallaba |
| `1793833403728-d6631fef-DRXnSr` | `node test/helpers/run-tests.js test/handoff.test.js test/handoff-schema.test.js` | Verde, 17 pruebas |
| `1793833418274-8cd40d10-FPhXeK` | `node --check src/tokens/handoff.js` | Verde |
| `1793833418879-3cad94a7-mPcvJj` | `npm test` | Verde, 873 pruebas (865 pasan, 8 `todo` preexistentes) |
| `1793833646936-7dd10735-rFRp0y` | `npm run generate:check` | Verde |

Archivos tocados: `src/tokens/handoff.js` (una línea y su comentario) y `test/handoff.test.js`
(un caso nuevo en la prueba de lista mal formada). Recibos con `--model claude-opus-5-5`.
