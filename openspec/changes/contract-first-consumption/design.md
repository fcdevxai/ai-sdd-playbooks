---
schema: design
schema_version: 1
change_id: contract-first-consumption
status: approved 
security:
  risk: standard
  threat_model_required: false
  controls: [SEC-001, SEC-002, SEC-003]
updated: 2026-07-27
---
# Technical design — Cerrar el circuito de contract-first: autoría → consumo → multi-repo

## Approach

El change tiene cuatro piezas independientes entre sí, que se pueden implementar
y verificar por separado:

**1. Acotar el trigger de autoría (AC-1, AC-2, AC-3).** Texto en
`skills/sdd-design/canonical.md`: la guarda del paso 2 pasa de dos a tres
condiciones, y el skip se vuelve declarativo. Se agrega `playbook.config.yaml`
al `## Context` — hoy el paso 2 depende de un archivo que ninguna sección manda
leer, así que el wiring existente es parcial por omisión.

**2. Aviso advisory en `validate` (AC-4).** Hallazgo de diseño: **`validate` no
tiene hoy ningún canal no bloqueante** — `grep warning|warn src/cli/validate.js`
= 0. Su modelo es `results: [{file, valid, errors}]` y `EXIT.VIOLATION` si alguno
es inválido. Hay que introducir el canal, y la decisión es **reusar el
vocabulario de `doctor`** (`problems`/`warnings`/`notes`, ya establecido en
`src/cli/doctor.js:215`) en vez de inventar uno nuevo. Concretamente:

- Un array `notices` separado de `results`, para que un aviso nunca pueda
  contarse como artefacto inválido.
- En `--json`, clave nueva `notices` de primer nivel. `checked`/`failed`/`results`
  no cambian de forma ni de semántica: un consumer que hoy parsea el JSON sigue
  funcionando sin enterarse.
- En texto, se imprimen después de la lista de artefactos, con el prefijo `note:`
  igual que `doctor`.
- El `return` sigue siendo `failures.length ? EXIT.VIOLATION : EXIT.OK`: los
  avisos **no participan** del exit code. Esto es lo que hace al aviso advisory
  de verdad y no de palabra.

**3. Roles del contrato (AC-5, EC-2).** Dos mitades que van en capas distintas,
y confundirlas sería un error de diseño:

- **Schema** (`schemas/playbook.config.schema.json`): `contract.provided_by`
  (string) y `contract.consumed_by` (array de strings), ambos opcionales. Es
  puro ajv, aditivo: ningún config existente se invalida.
- **Chequeo cross-field** (`src/cli/validate.js`): que los nombres existan en
  `repos:` **no es expresable en ajv** (compara dos ramas del documento), así que
  va como chequeo semántico, al lado del cross-check de adapters/capabilities que
  ya vive ahí (`src/cli/validate.js:79-87`). Ese es el precedente a seguir.

Este chequeo sí es **bloqueante** (a diferencia del punto 2): un `provided_by`
que nombra un repo inexistente es un error de config, no una configuración
legítima. La asimetría con el aviso del punto 2 es deliberada — ahí la config
señalada (hub CLI-only con `path_in_loom` para fixtures) es válida; acá no.

**4. Consumo en plan/apply y en el packet (AC-6..AC-9, EC-3).** Texto en
`skills/sdd-plan/canonical.md` y `skills/sdd-apply/canonical.md` + el packet
transportando la topología.

Sobre el packet hay una **restricción que la proposal no anticipó** y que este
diseño resuelve: la detección de staleness (`src/tokens/packet.js:170-180`)
hashea únicamente `proposal.md` y `tasks.md`. Si el packet pasa a derivar
información de `playbook.config.yaml` (path del contrato + roles), un cambio de
topología **no marcaría el packet obsoleto** y los gates seguirían leyendo roles
viejos en silencio — exactamente la clase de fallo que este trabajo elimina.

Decisión: hashear **solo la porción de config relevante al contrato**
(`path_in_loom`, `provided_by`, `consumed_by`), como `sources.contract` en el
frontmatter del packet. Hashear el config completo se descartó: un cambio en
`github.base_branch` marcaría obsoletos todos los packets, ruido que entrenaría
a ignorar el aviso. `sources.contract` es opcional, así que un packet sin él
—legacy, o de un proyecto sin contrato— nunca se reporta obsoleto por esa vía;
es el mismo patrón que el código ya usa para todo el objeto `sources`.

La sección nueva del packet **no** entra en `PACKET_REQUIRED_SECTIONS`
(`src/tokens/packet.js:23-31`): si entrara, todo packet de un proyecto sin
contrato pasaría a ser inválido por falta de una sección que no le aplica.

## Module impact

| Módulo | Delta | AC |
|---|---|---|
| `skills/sdd-design/canonical.md` | guarda de 3 condiciones; skip declarativo; `playbook.config.yaml` en `## Context` | AC-1, AC-2, AC-3 |
| `skills/sdd-plan/canonical.md` | planificar contra los endpoints del contrato; leer por path, nunca copiar | AC-6, AC-8 |
| `skills/sdd-apply/canonical.md` | leer el contrato como spec; obligación según rol; leer por path | AC-7, AC-8 |
| `schemas/playbook.config.schema.json` | `contract.provided_by`, `contract.consumed_by` (opcionales) | AC-5 |
| `src/cli/validate.js` | canal `notices` (no bloqueante) + cross-check de roles contra `repos:` (bloqueante) | AC-4, AC-5, EC-2 |
| `src/tokens/packet.js` | sección de contrato (no requerida) + `sources.contract` para staleness | AC-9 |
| `schemas/context-packet.schema.json` | `sources.contract` opcional | AC-9 |
| `templates/project/playbook.config.yaml` | quitar `role: impacted`; documentar `provided_by`/`consumed_by` | AC-10, AC-11 |
| `test/skill-contract.test.js` | contenido de los 3 skills | AC-1..AC-3, AC-6..AC-8 |
| `test/tokens.test.js` | packet: sección + staleness por contrato | AC-9 |
| `test/contract-first.test.js` | schema, cross-check, aviso advisory, template | AC-4, AC-5, AC-10, AC-11, EC-1, EC-2 |

Ningún módulo de `src/lifecycle/` se toca: el motor de estado no participa —
esto es config, packet y texto de skills.

## Trade-offs

**Canal `notices` en `validate` vs. no avisar.** Introducir un concepto nuevo en
un comando que hoy es binario tiene costo conceptual. La alternativa (no avisar)
deja abierto el skip silencioso que la guarda de tres condiciones introduce, y
no hay ninguna otra red: `validate` no verifica que el contrato se haya autorado.
Se paga el costo, mitigado por reusar el vocabulario de `doctor` en vez de
inventar uno.

**Aviso advisory vs. bloqueante (AC-4).** Bloqueante rompería este mismo repo,
cuya config (`path_in_loom` + `http: false`) es deliberada y legítima. Advisory
acepta que un consumer pueda ignorarlo; es el precio de no romper una
configuración válida.

**Cross-check de roles bloqueante vs. advisory.** Bloqueante, a diferencia del
anterior, porque no existe caso legítimo de nombrar un repo que no está en
`repos:` — es un typo o una config a medio migrar, y fallar temprano es más
barato que un `sdd-apply` intentando resolver un path de un repo inexistente.

**Hashear solo la porción de contrato vs. todo el config.** Precisión contra
simplicidad. Hashear todo es una línea menos de código y produce falsos
positivos en cada cambio de config no relacionado; la porción exige nombrar los
tres campos pero solo marca obsoleto lo que de verdad quedó obsoleto.

**Roles en `contract:` vs. por repo.** Cerrado en enrich y documentado en el ADR
`contract-roles-read-from-hub`: hoy hay un único `path_in_loom`, así que toda la
información de ese contrato pertenece al mismo bloque. Revisitable si el
proyecto pasa a soportar varios contratos.

**Determinación por change como juicio del agente vs. campo de schema.** Cerrado
en enrich y documentado en el ADR `contract-trigger-scoped-to-http`. El costo
aceptado: no hay validación mecánica de que la determinación sea correcta, solo
que quede declarada bajo sign-off humano.

## Public contracts / interfaces

**Autoría del contrato canónico: SALTEADA, y este es el motivo.**

Este change declara `impact.public_contract: false`, así que el paso 2 de
`sdd-design` no autora ningún endpoint en `contract.path_in_loom`. La
justificación —y conviene registrarla porque es exactamente la ambigüedad que
este change viene a cerrar— es que el contrato público que cambia acá **no es
HTTP**: son el schema de `playbook.config.yaml` (dos campos nuevos y opcionales)
y la superficie de `playbook validate` (una clave nueva en `--json`). Este repo
no expone endpoints HTTP (`capabilities.http: false`) y ningún endpoint se agrega,
modifica ni elimina.

Bajo la regla nueva que este change introduce, este skip sería automático por la
primera condición (`capabilities.http: false`). Bajo la regla vigente hoy lo es
por `public_contract: false`. En los dos casos el resultado es el mismo y queda
declarado acá, que es la conducta que AC-2 codifica.

Las interfaces que **sí** cambian, todas retrocompatibles:

**`playbook.config.yaml` — bloque `contract:`** (campos nuevos, opcionales):

```yaml
contract:
  source_of_truth: loom-first
  path_in_loom: openspec/specs/contracts/openapi.yaml
  provided_by: backend            # nuevo — el repo que expone la API
  consumed_by: [frontend, mobile] # nuevo — los repos que la consumen
```

Ambos nombres deben existir en `repos:`. Ausentes = sin topología declarada, y
el comportamiento es el actual.

**`playbook validate --json`** — clave nueva de primer nivel:

```json
{ "command": "validate", "cwd": "...", "checked": 6, "failed": 0,
  "results": [ ... ],
  "notices": ["playbook.config.yaml declares contract.path_in_loom but capabilities.http is false — contract-first authoring will not trigger"] }
```

`checked`, `failed` y `results` conservan forma y semántica. `notices` está
ausente o vacío cuando no hay avisos. Los exit codes no cambian: `0` sin
artefactos inválidos, `EXIT.VIOLATION` con alguno — un aviso nunca los altera.

**`context-packet.md`** — sección nueva no requerida (solo cuando hay contrato
configurado) y `sources.contract` en el frontmatter para la staleness.

## Data model changes

No hay base de datos. Los cambios de "modelo de datos" son de schema de
artefactos, los dos aditivos y opcionales:

- `schemas/playbook.config.schema.json`: `contract.provided_by` (string),
  `contract.consumed_by` (array de strings). Sin `required`, sin
  `additionalProperties: false` en `contract` (hoy no lo tiene), así que ningún
  config existente se invalida.
- `schemas/context-packet.schema.json`: `sources.contract` (string). `sources`
  hoy exige `proposal` y `tasks`; `contract` se suma **sin** entrar en
  `required`, para que los packets ya generados sigan siendo válidos.

Ninguna migración de artefactos existentes.

## Security controls (+ threat model when required)

Riesgo **standard**, arrastrado de la proposal sin cambios.
`threat_model_required: false`: no hay superficie de red nueva, ni datos
personales, ni autenticación; lo que se agrega son lecturas de filesystem
derivadas de config, que es una superficie ya conocida y ya endurecida en este
repo.

- **SEC-001** (proposal SEC-1) — *Lectura del contrato derivada de config.*
  Leer `contract.path_in_loom` es la superficie que ADR-035 endureció. Todo
  acceso pasa por `resolveContainedPath(cwd, path_in_loom)`, exactamente como ya
  hace `contract-drift` (`src/cli/repos.js:154`); prohibida la concatenación de
  strings. Aplica tanto al código nuevo (`packet.js`, `validate.js`) como al
  texto de los skills, que debe instruir la contención, no solo la lectura.
  Evidencia: test negativo con `..` que escapa, absoluta a otro árbol y escape
  vía symlink, verificando que **no se intenta la lectura** (EC-1).
- **SEC-002** (proposal SEC-2) — *Resolución de paths de repos hermanos.*
  `provided_by`/`consumed_by` resuelven a paths **fuera** del repo por diseño
  (son hermanos), así que la contención-al-repo no aplica y forzarla rompería la
  topología multi-repo existente. El control real es `resolveConfiguredRepoPath`
  (`src/repos/config.js:72`), que valida que el nombre exista en `repos:` y
  tenga `path`. Evidencia: test negativo con un nombre no declarado, que falla
  con error claro **sin tocar el filesystem** (EC-2).
- **SEC-003** (proposal SEC-3) — *Falsa sensación de cobertura por
  `provided_by`.* Declarar `provided_by` no instala el `contract-drift` en el CI
  de ese repo; sigue siendo un paso manual del template. El control es
  documental y verificable por contenido: el texto de `sdd-plan`/`sdd-apply` y la
  spec permanente deben decir que la conformidad la verifica el CI del provider
  **si está instalado**, y que declarar el rol no lo instala. No se agrega
  verificación automática de CI remoto — está fuera del alcance de este repo.

Nota de coherencia con la proposal: los tres `SEC-N` declarados tienen control y
evidencia; no se detectó exposición nueva no declarada, así que el riesgo no se
eleva.

## Testing strategy

TDD en todas las tareas, con el test escrito primero y **fallando contra el
código previo** — exigencia de ADR-032, porque el adapter `cli` está excluido
(`runtime_relevant_capabilities: []`) y la evidencia no es opcional.

| Archivo | Cubre |
|---|---|
| `test/skill-contract.test.js` (extiende) | `sdd-design`: las 3 condiciones enumeradas y el skip declarativo (AC-1, AC-2); `playbook.config.yaml` en `## Context` (AC-3); `sdd-plan` planifica contra el contrato (AC-6); `sdd-apply` distingue provider/consumer (AC-7); ninguno de los dos copia el contrato (AC-8) |
| `test/contract-first.test.js` (extiende) | schema acepta `provided_by`/`consumed_by` y los omite sin error (AC-5); cross-check rechaza un repo ausente de `repos:` nombrándolo (AC-5, EC-2); aviso advisory presente con `path_in_loom` + `http: false`, **con exit code 0 y sin artefactos inválidos** (AC-4); el bloque multi-repo del template descomentado valida (AC-10); el template documenta los campos nuevos (AC-11) |
| `test/tokens.test.js` (extiende) | el packet incluye contrato y roles cuando existen (AC-9); su forma no cambia cuando no existen (AC-9); un cambio de `provided_by`/`consumed_by`/`path_in_loom` marca el packet obsoleto; un cambio de config no relacionado (ej. `github.base_branch`) **no** lo marca; un packet sin `sources.contract` nunca se reporta obsoleto por esa vía |
| `test/fs-safe.test.js` o `test/contract-first.test.js` | test negativo de SEC-001: `path_in_loom` que escapa (`..`, absoluto, symlink) es rechazado sin intentar la lectura (EC-1) |
| `test/contract-first.test.js` | EC-3: `path_in_loom` declarado pero archivo ausente → reportado, sin inventar endpoints. EC-4: `consumed_by` sin `provided_by` no es error |

**Gates de calidad**: `node --check` por archivo tocado, la suite de feature
tests, y regresión con `npm test` + `npm run generate:check` (obligatoria, sin
qualifier — ADR-037).

**Alcanzabilidad (regla de §10 del plan maestro, constraint de la proposal).**
Un test de contenido verifica que el texto **está**, no que sea **alcanzable**.
Para cada uno de los tres skills tocados hay que releer `## Preconditions`,
`## Context` y `## Rules` —las secciones que el agente lee antes de llegar al
wiring— y confirmar que ninguna lo contradice. Riesgo concreto ya identificado
en `sdd-design`: su `## Rules` dice *"Never write a canonical contract when
`contract.path_in_loom` is absent"*, que es compatible con la guarda nueva pero
la enuncia con **una sola** condición; si queda así, contradice por omisión el
paso 2 de tres condiciones. Debe actualizarse en el mismo change.

**Evidencia manual para el `runtime-gate-report.md`** (el adapter `cli` está
excluido, la evidencia no es opcional): `playbook validate` en este repo
mostrando el aviso advisory nuevo con exit code 0; y `playbook validate` sobre
un config temporal con un `provided_by` inexistente, mostrando el error
bloqueante que hoy no existe.
