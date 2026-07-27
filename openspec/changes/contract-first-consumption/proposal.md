---
schema: proposal
schema_version: 1
change_id: contract-first-consumption
status: approved
owner: Bernardo Machuca
created: 2026-07-27
updated: 2026-07-27
impact:
  public_contract: false
  data_model: false
  architecture_boundary: true
  external_integration: false
  cross_repository: false
  authentication: false
  authorization: false
  infrastructure: false
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: [infrastructure]
runtime_relevant_capabilities: []
---

# Cerrar el circuito de contract-first: autoría → consumo → multi-repo

## Objective

Que el contrato canónico (`openapi.yaml`) sea la fuente de verdad **efectiva**
durante la implementación —en el hub y en cada repo impactado— en vez de un
artefacto que se escribe y nadie vuelve a leer. Y que el paso de autoría deje de
dispararse sobre superficies que no son HTTP.

## Guiding principle

Una capacidad que produce un artefacto sin consumidores no está terminada. El
contrato canónico existe para ser compartido entre repos: si ningún repo lo lee
al implementar, es un documento por tenerlo.

## Impacted modules

- `skills/sdd-design/canonical.md` — guarda de tres condiciones, skip declarado,
  y `playbook.config.yaml` agregado al `## Context`.
- `skills/sdd-plan/canonical.md` — planifica las tasks contra los endpoints del
  contrato cuando aplica.
- `skills/sdd-apply/canonical.md` — lee el contrato como spec al implementar,
  con la obligación que corresponde al rol del repo.
- `src/tokens/packet.js` — el packet transporta path del contrato y roles.
- `schemas/playbook.config.schema.json` — `contract.provided_by` y
  `contract.consumed_by`.
- `schemas/context-packet.schema.json` — `sources.contract`, para que un cambio de
  topología del contrato marque el packet obsoleto. Agregado durante `sdd-design`:
  el schema es permisivo y el campo validaría sin declararlo, pero un campo que el
  código escribe y lee debe estar en su propio schema. No altera ningún `AC-N`.
- `src/cli/validate.js` — aviso advisory ante `path_in_loom` + `http: false`.
- `templates/project/playbook.config.yaml` — corregir `role: impacted` (que el
  schema rechaza) y documentar los campos nuevos.

## Impacted repos

<!-- Single-repo change: no cross-repo gate. Este change *define* semántica
multi-repo, pero se ejecuta enteramente en el hub — este repo no declara `repos:`. -->

## Files touched

<!-- Single-repo change: intencionalmente vacío. Los archivos están en `## Impacted modules`. -->

## Expected behavior

### Happy path (Given/When/Then)

**Autoría acotada a HTTP.**
Given un proyecto con `capabilities.http: false` y `contract.path_in_loom`
configurado, When un change declara `impact.public_contract: true` y corre
`sdd-design`, Then el paso de autoría de OpenAPI se saltea y el motivo queda
declarado en `## Public contracts / interfaces` de `design.md`.

Given un proyecto con `capabilities.http: true`, When el change altera endpoints
HTTP, Then `sdd-design` autora esos endpoints en `contract.path_in_loom` (el
comportamiento actual, sin cambios).

Given un proyecto con `capabilities.http: true`, When el contrato público que
cambia es de CLI o librería y no toca endpoints HTTP, Then el paso se saltea y
el motivo queda declarado en `design.md`.

**Consumo del contrato.**
Given un proyecto con `contract.path_in_loom` y `contract.provided_by: backend`,
When corre `sdd-plan` para un change que toca la API, Then las tasks se
planifican contra los endpoints declarados en el contrato.

Given ese mismo proyecto, When corre `sdd-apply` sobre el repo `backend`, Then
el contrato se lee como **la spec que la implementación debe cumplir**; When
corre sobre un repo listado en `consumed_by`, Then se lee como **la spec de lo
disponible para llamar**, incluidos los códigos de error a manejar.

**Multi-repo declarado.**
Given un consumer que descomenta el bloque multi-repo del template tal como está
documentado, When corre `playbook validate`, Then valida sin errores.

### Edge cases

- `contract.path_in_loom` configurado pero `capabilities.http: false`:
  `validate` emite un aviso advisory; el exit code no cambia y ningún artefacto
  queda inválido (este mismo repo es esa configuración, y es legítima).
- `provided_by` o `consumed_by` nombran un repo ausente de `repos:`: error claro
  que nombra el repo desconocido.
- Ambos campos ausentes: no es error — es la señal de que no hay topología de
  contrato declarada. Los skills se comportan como hoy.
- `contract.path_in_loom` apunta fuera del repo: rechazado antes de leer.
- Proyecto sin `contract.path_in_loom`: `sdd-plan`/`sdd-apply` no mencionan el
  contrato y el flujo es idéntico al actual.
- Un repo listado en `consumed_by` que no está en el `## Impacted repos` del
  change: no se lee el contrato para él (el change no lo toca).

## Acceptance criteria

**AC-1:** `sdd-design` autora el contrato solo cuando `impact.public_contract:
true` **y** `contract.path_in_loom` **y** `capabilities.http: true`; el texto del
skill enumera las tres condiciones explícitamente.

**AC-2:** Con `capabilities.http: false`, o con `http: true` pero un contrato
público no-HTTP, `sdd-design` saltea la autoría y declara el motivo en
`## Public contracts / interfaces` de `design.md`. Un skip sin declaración es un
defecto.

**AC-3:** `playbook.config.yaml` figura entre los archivos que el `## Context` de
`sdd-design` manda leer.

**AC-4:** `playbook validate` emite un aviso cuando `contract.path_in_loom` está
configurado y `capabilities.http: false`. El aviso es advisory: no altera el exit
code ni invalida ningún artefacto.

**AC-5:** El schema acepta `contract.provided_by` (string) y
`contract.consumed_by` (array de strings), ambos opcionales, y rechaza un nombre
que no exista en `repos:` con un error que lo nombra.

**AC-6:** `sdd-plan` instruye planificar las tasks contra los endpoints del
contrato cuando `contract.path_in_loom` está declarado y el change toca la API.

**AC-7:** `sdd-apply` instruye leer el contrato al implementar, distinguiendo la
obligación del provider (la spec a cumplir) de la del consumer (lo disponible
para llamar, incluidos los códigos de error).

**AC-8:** Ni `sdd-plan` ni `sdd-apply` copian el contrato: lo leen por path
desde el hub. El texto de los skills lo dice explícitamente.

**AC-9:** `context-packet.md` incluye el path del contrato y los roles
declarados cuando existen, y no cambia su forma cuando no existen.

**AC-10:** El bloque multi-repo del template descomentado tal como está
documentado pasa `playbook validate` — `role: impacted` ya no aparece, y el
template explica que "impacted" se lee del `## Impacted repos` de la proposal.

**AC-11:** El template documenta `provided_by`/`consumed_by` con un ejemplo
coherente con `repos:`.

## Error cases

**EC-1:** `contract.path_in_loom` que escapa del repo → rechazado con error que
nombra la ruta, **sin intentar la lectura**.

**EC-2:** `provided_by`/`consumed_by` con un repo ausente de `repos:` → error
claro que nombra el repo desconocido, vía `resolveConfiguredRepoPath`.

**EC-3:** `contract.path_in_loom` declarado pero el archivo no existe cuando
`sdd-plan`/`sdd-apply` intentan leerlo → el skill lo reporta y sigue sin
inventar endpoints (el contrato lo crea `sdd-design`, nadie más).

**EC-4:** `consumed_by` declarado pero `provided_by` ausente → no es error; el
contrato se lee igual para los consumers. `provided_by` solo determina quién
tiene obligación de conformidad.

## Security considerations

**SEC-1:** Leer el contrato desde `contract.path_in_loom` es una **lectura
derivada de configuración**, exactamente la superficie que ADR-035 endureció.
Debe pasar por `resolveContainedPath`, como ya hace `contract-drift`
(`src/cli/repos.js:154`); nunca por concatenación de strings. Test negativo
obligatorio: un `path_in_loom` que escapa del repo (`..`, absoluto a otro árbol,
o escape vía symlink) es rechazado **antes** de leer.

**SEC-2:** `provided_by`/`consumed_by` resuelven nombres de repo a paths de
filesystem que, por diseño, están **fuera** del repo (son hermanos). La
contención-al-repo **no** aplica ahí y forzarla rompería la topología multi-repo
existente. Lo que sí aplica es la validación de `resolveConfiguredRepoPath`: el
nombre debe existir en `repos:` y tener `path`. Test negativo: un nombre no
declarado falla con error claro, sin tocar el filesystem.

**SEC-3:** Declarar `provided_by` **no** instala el `contract-drift` en el CI de
ese repo — sigue siendo un paso manual del template. Riesgo de falsa sensación de
cobertura: un `provided_by` declarado puede leerse como "la conformidad está
verificada" cuando el CI no está instalado. Mitigación: dejarlo explícito en el
texto del skill y en la spec permanente al archivar. No se agrega verificación
automática de que el CI exista (está fuera del alcance de este repo).

## Constraints and non-goals

**Constraints**

- Las skills se regeneran, no se editan a mano: la edición va en `canonical.md`
  y `npm run generate:check` no debe reportar drift.
- El aviso de `validate` (AC-4) es advisory: no puede alterar exit codes ni
  invalidar artefactos existentes.
- Sin dependencias nuevas.
- No se rehace resolución de paths: se reusan `resolveContainedPath` y
  `resolveConfiguredRepoPath`.
- Los campos nuevos son opcionales; un proyecto single-repo sin contrato no
  cambia en nada su comportamiento actual.
- **Alcanzabilidad (regla de §10 del plan maestro):** tras insertar cada wiring,
  releer `## Preconditions`, `## Context` y `## Rules` del skill tocado y
  confirmar que ninguna sección previa lo contradice. Un test de contenido
  verifica que el texto está, no que sea alcanzable.
- Por la exclusión documentada del adapter `cli` (ADR-032), este change modifica
  comportamiento observable del CLI (`validate`), así que debe traer al menos un
  test que **falle contra el código previo** y registrar en
  `runtime-gate-report.md` la invocación real antes y después.

**Non-goals**

- Drift-check para el consumer (frontend): asimetría aceptada y documentada — no
  hay forma sensata de derivar un OpenAPI de llamadas HTTP.
- Copiar o sincronizar el contrato entre repos: se lee por path.
- Soporte de múltiples contratos por proyecto (`path_in_loom` sigue siendo uno).
- Campo nuevo en el schema de `proposal.md` (por ejemplo `impact.contract_kind`):
  descartado por costo; la determinación vive en `design.md` bajo sign-off.
- El gap análogo de `sdd-runtime-gate`, cuyo `## Context` tampoco manda leer
  `capabilities` aunque su `## Adapter selection` dependa de ellas: mismo
  patrón, change aparte.
- Retocar retroactivamente changes ya archivados (el Ciclo B declaró
  `public_contract: true` por un comando de CLI).
- Verificar automáticamente que el `contract-drift` esté instalado en el CI del
  provider.
- Implementar el harness del adapter `cli` del runtime gate.

## Open technical decisions

<!-- Ninguna: las decisiones de fondo se cerraron en enrich (guarda de tres
condiciones + determinación por change registrada en design.md; roles en el
bloque `contract:`; el contrato se lee, no se copia; el consumer sin chequeo
mecánico). Los dos ADR drafts las documentan. -->
