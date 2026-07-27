---
schema: adr
status: proposed
date: '2026-07-27'
ticket: contract-first-consumption
---

# ADR: El contrato canónico declara sus roles provider/consumer y se lee desde el hub, nunca se copia

## Context

ADR-030 dejó operativo el **authoring** del contrato canónico: `sdd-design` lo
escribe en `contract.path_in_loom`. Lo que quedó sin cablear es el **consumo**.
Verificado sobre `main`: de los 13 skills, solo `sdd-design` menciona el contrato
(9 ocurrencias). `sdd-plan` y `sdd-apply` tienen **cero** — la única aparición de
"contracts" en `sdd-apply` es la lista de triggers de ADR, sin relación. El
`context-packet.md`, que es lo que leen los gates, no transporta nada del
contrato.

El resultado es que hoy contract-first autora la fuente de verdad y después la
implementación se escribe sin consultarla: `sdd-design` escribe el contrato →
`sdd-plan`/`sdd-apply` implementan de memoria → si el repo implementador instaló
el template de CI, `contract-drift` reporta la divergencia *después*. El
drift-check no previene la divergencia, la detecta tarde. Para un consumer
multi-repo —el caso para el que el contrato existe, siendo "a versioned artifact
shared with every consumer repo" en palabras de ADR-030— eso deja el contrato
como documento por tenerlo.

**La asimetría provider/consumer es real y tiene razón técnica.** El template de
CI (`templates/project/github/workflows/contract-drift-check.yml`) lo dice
explícitamente: se instala en el repo del **backend**, genera el OpenAPI real de
ese backend y lo compara contra el canónico del hub, "so the API drifting from
what the hub declared fails the PR instead of silently reaching a frontend". O
sea:

- El **provider** tiene una relación de **conformidad**: lo que expone debe
  coincidir con el contrato, y eso es mecánicamente verificable porque de las
  rutas del backend se puede *generar* un OpenAPI y diffearlo.
- El **consumer** tiene una relación de **dependencia**: lee el contrato para
  saber qué llamar y qué respuestas manejar. No existe chequeo equivalente
  posible: de las llamadas HTTP de un frontend no se deriva un OpenAPI.

Hoy el config no distingue ninguno de los dos. `repos.<name>` acepta `role`, pero
su enum es únicamente `sdd` — "impacted" no es un rol de config, se lee del
`## Impacted repos` de la proposal (`readImpactedRepos`, `src/repos/plan.js:130`).
Nada dice qué repo provee la API ni cuáles la consumen.

Sobre **cómo llega** el contrato al repo que lo necesita: no hace falta
transportarlo. `repos.<name>.path` da la ruta de cada repo, son hermanos en
disco, y `resolveConfiguredRepoPath` (`src/repos/config.js:72`) ya resuelve y
valida esos paths. `contract-drift` ya opera con ese mismo modelo —lee el
canónico del hub y lo compara contra el generado local— y su propio template de
CI resuelve el caso remoto con un `actions/checkout` del hub. Copiar el contrato
a cada repo introduciría N copias que pueden divergir del original, que es
precisamente el problema que un contrato canónico único existe para evitar.

## Decision

El contrato canónico declara explícitamente quién lo provee y quiénes lo
consumen, y los repos lo leen desde el hub. Reglas normativas:

1. **Roles en el bloque `contract:`.** `contract.provided_by: <repo>` nombra el
   repo que expone la API; `contract.consumed_by: [<repo>, ...]` nombra los que
   la consumen. Van en `contract:` —no dispersos en `repos:`— porque hoy hay un
   único `path_in_loom` por proyecto y toda la información de ese contrato
   pertenece al mismo bloque.
2. **Validados contra `repos:`.** Todo nombre en `provided_by`/`consumed_by`
   debe existir en `playbook.config.yaml`'s `repos:`. La resolución a path va
   por `resolveConfiguredRepoPath`, que ya valida existencia del nombre y del
   `path`; no se rehace resolución de paths.
3. **Ambos campos son opcionales.** Un proyecto single-repo, o uno que no usa
   contract-first, los omite. Su ausencia nunca es un error: es la señal de que
   no hay topología de contrato declarada.
4. **El contrato se lee, nunca se copia.** Un repo impactado accede al contrato
   canónico por path desde el hub. No se copia, ni se sincroniza, ni se genera
   una réplica por repo. El path del hub se resuelve con
   `resolveContainedPath` sobre `contract.path_in_loom`, igual que ya hace
   `contract-drift` (`src/cli/repos.js:154`).
5. **Obligaciones distintas por rol al implementar.** `sdd-plan` y `sdd-apply`
   leen el contrato cuando aplica: el provider lo lee como **la spec que debe
   cumplir**; el consumer, como **la spec de lo que tiene disponible para
   llamar**, incluidos los códigos de error que debe manejar.
6. **El consumer no tiene chequeo mecánico de conformidad.** Limitación aceptada
   y documentada: no hay forma sensata de derivar un OpenAPI de las llamadas
   HTTP de un frontend. El consumer queda cubierto por lectura + revisión
   humana, no por un detector.
7. **`contract-drift` sigue siendo detector, nunca mecanismo de authoring ni de
   distribución.** Corre en el CI del provider y no cambia con esta decisión.

## Consequences

### Positive
- El contrato pasa de artefacto escrito-y-olvidado a fuente de verdad efectiva
  durante la implementación, que es la propiedad por la que contract-first se
  adoptó.
- Una sola copia del contrato: imposible que las réplicas por repo divergan.
- La asimetría provider/consumer queda declarada en vez de implícita, así que
  `sdd-plan`/`sdd-apply` saben qué obligación aplica a cada repo sin inferirla.
- Reusa `resolveConfiguredRepoPath` y `resolveContainedPath` en vez de agregar
  una tercera forma de resolver paths.

### Negative
- Dos campos de config nuevos que un consumer multi-repo tiene que mantener
  alineados con `repos:`. Mitigado por la validación de la regla 2.
- El consumer queda con menos garantía que el provider. Se acepta como
  asimetría inherente, no como deuda a cerrar pronto.
- Leer el contrato del hub por path asume que los repos son alcanzables en el
  filesystem. Es la asunción que la topología `repos:` ya hace hoy
  (`repo-plan`, `gate-check`, `prepare-repos` todos resuelven paths hermanos),
  así que no agrega una restricción nueva — pero el caso remoto/CI se resuelve
  con checkout del hub, no con este mecanismo.

### Risks
- Un `consumed_by` desactualizado (un repo que dejó de consumir la API pero
  sigue listado) haría que `sdd-apply` lea el contrato para un repo donde ya no
  aplica. Costo: contexto de más, no resultado incorrecto.
- Declarar `provided_by` no instala el `contract-drift` en el CI de ese repo —
  eso sigue siendo un paso manual del template. Un `provided_by` declarado puede
  dar la falsa impresión de que la conformidad está siendo verificada cuando el
  CI no está instalado. Debe quedar dicho en la spec permanente al archivar.

## Alternatives considered

### Un campo por repo: `repos.<name>.contract: provides | consumes`
Descartada por ahora: dispersa la información de un contrato único en N lugares
del config. Sería la opción correcta si el proyecto pasara a soportar varios
contratos simultáneos, momento en el que `path_in_loom` (hoy uno solo) también
tendría que volverse una lista — conviene revisitarla junto con eso, no antes.

### Derivar los roles del `stack` de cada repo y del `## Impacted repos`
Descartada: ambigua con varios repos impactados y deja la decisión al criterio
del agente en cada corrida, que es la clase de gap que este trabajo elimina.

### Solo declarar el provider y asumir consumer para todo otro repo impactado
Descartada: un repo impactado que no toca la API (por ejemplo uno de
infraestructura o de documentación) quedaría marcado como consumer sin serlo, y
`sdd-apply` leería el contrato para él sin motivo.

### Copiar/sincronizar el contrato a cada repo impactado
Descartada de plano: N copias que pueden divergir del canónico, que es
exactamente el problema que un contrato canónico único existe para evitar.

### Un drift-check para el consumer
Descartada en este change (regla 6): exigiría inspeccionar las llamadas HTTP del
frontend para derivar qué endpoints usa, es dependiente del stack y de un orden
de magnitud más de trabajo. Queda como posible ciclo futuro si la divergencia
del lado consumer se manifiesta en la práctica.

## Impact

- backend: define que el repo provider lee el contrato como la spec a cumplir;
  no cambia código de ningún backend
- frontend: define que el repo consumer lee el contrato como la spec de lo
  disponible para llamar; no cambia código de ningún frontend
- security: campos de config nuevos que resuelven a paths de filesystem — la
  resolución va por los helpers ya endurecidos (`resolveConfiguredRepoPath`,
  `resolveContainedPath` de ADR-035), nunca por concatenación
- data: no impact
- deployment: no impact — el caso remoto/CI sigue resolviéndose con checkout del
  hub, como ya hace el template de `contract-drift`
- testing: tests de schema (nombres validados contra `repos:`), tests de
  contenido en `sdd-plan`/`sdd-apply`, y test negativo de contención sobre la
  lectura del contrato
