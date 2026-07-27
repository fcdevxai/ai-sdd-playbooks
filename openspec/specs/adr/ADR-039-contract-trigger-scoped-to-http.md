---
schema: adr
status: accepted
date: '2026-07-27'
ticket: contract-first-consumption
---

# ADR: El authoring del contrato canónico se dispara solo sobre superficie HTTP, y la determinación queda registrada por change

## Context

ADR-030 fijó que `sdd-design` autora el contrato canónico cuando la proposal
declara `impact.public_contract: true` **y** el proyecto declara
`contract.path_in_loom`. Esa guarda de dos condiciones asume que "contrato
público" significa **endpoints HTTP**, porque el artefacto que manda escribir es
un `openapi.yaml`.

En `playbook-ai` esa asunción no se sostiene. El producto **es** un CLI
(`capabilities.http: false`, `cli: true`), y el CLI es su superficie pública: el
Ciclo B (`cli-detect-siblings`) declaró `public_contract: true` **por agregar un
comando**. Este repo además tiene `contract.path_in_loom` configurado
deliberadamente (`playbook.config.yaml:35-37`, para que la suite de tests tenga
una config real que ejercitar). Las dos condiciones de ADR-030 se cumplen, así
que hoy un change puramente de CLI dispara el paso de autoría de OpenAPI: el
skill le pide al agente escribir endpoints para una superficie que no tiene
ninguno. No falla —el agente ve que no aplica y sigue— pero el criterio queda a
interpretación en cada corrida, que es exactamente la clase de ambigüedad que la
metodología viene eliminando.

Gatear solo por `capabilities.http` no alcanza, y esto es lo que hace falta
registrar: en un proyecto con **CLI y HTTP a la vez** (el caso más común en un
consumer real), `http: true` deja pasar la guarda y un change puramente de CLI
vuelve a disparar el authoring. El discriminador correcto no es del *proyecto*
sino del *change*: la pregunta es "¿este change altera endpoints HTTP?", no
"¿este proyecto tiene HTTP?".

La fuerza en tensión es dónde poner esa determinación. Un campo nuevo en el
bloque `impact` (por ejemplo `contract_kind: http | cli | none`) la haría
mecánica, pero exige cambiar el schema de `proposal.md`, migrar proposals
existentes y enterar a todos los gates que leen `impact` — caro para un
proyecto cuya única superficie pública hoy es el CLI. La alternativa es que el
skill determine y **registre** la decisión en `design.md`, que ya tiene una
sección `## Public contracts / interfaces` y —a diferencia de `tasks.md`— exige
que un humano mueva su `status` a `approved`. Ese es el mismo patrón que ya usan
`sdd-runtime-gate` (selección de adapters con `reason_code`) y
`sdd-security-gate` (reconciliación de riesgo): el agente decide, lo escribe en
el artefacto, y el humano lo revisa en el sign-off.

Hay un modo de falla adicional que la guarda nueva introduce si no se cubre. El
template del consumer trae `capabilities.http: false` por defecto y el bloque
`contract:` **comentado**, y el comentario de `capabilities` dice que sirve para
"activa sdd-runtime-gate" — no menciona autoría de contratos. Un consumer que
descomenta y configura `path_in_loom` (señal inequívoca de intención) pero deja
`http: false` recibiría silencio total. Y no hay red: `playbook validate` no
tiene **ningún** chequeo de que el contrato haya sido autorado (`grep
public_contract|openapi|path_in_loom` en `src/cli/validate.js` y `src/schema/`
= 0). El único detector, `contract-drift`, corre en el CI del repo implementador
y compara contra el canónico: si nunca se autoró, compara contra `paths: {}`.

## Decision

El paso de authoring del contrato canónico en `sdd-design` se acota a superficie
HTTP, y la determinación por change queda registrada. Reglas normativas:

1. **Guarda de tres condiciones.** El paso autora el contrato solo cuando
   `impact.public_contract: true` **y** `contract.path_in_loom` está declarado
   **y** `capabilities.http: true`. Con `capabilities.http: false` el paso se
   saltea: sin superficie HTTP, ningún change puede alterar endpoints HTTP.
2. **Determinación por change.** Con `capabilities.http: true`, `sdd-design`
   determina si *este* change altera endpoints HTTP. Si el contrato público que
   cambió es de CLI, librería u otra superficie no-HTTP, saltea el authoring de
   OpenAPI.
3. **El skip siempre es explícito, nunca silencioso.** En los dos casos
   anteriores el skill declara el motivo en `design.md`, en la sección
   `## Public contracts / interfaces`, de modo que la decisión entra al sign-off
   humano en vez de resolverse en silencio. Un skip sin declaración es un
   defecto de diseño.
4. **`playbook validate` avisa ante la inconsistencia de config.** Cuando
   `contract.path_in_loom` está configurado pero `capabilities.http: false`,
   `validate` emite un aviso. Es **advisory**: no altera el exit code ni
   invalida artefactos, porque un hub CLI-only con `path_in_loom` configurado
   para fixtures de test es una configuración legítima (este mismo repo).
5. **No se agrega campo al schema de `proposal.md`.** La determinación vive en
   `design.md` bajo sign-off humano, no en un campo nuevo de `impact`.
6. **ADR-030 sigue vigente.** Esta decisión **complementa** su guarda; no
   cambia la propiedad de fondo (el authoring pertenece a la etapa de diseño,
   bajo una sola firma humana), así que no la supersede.

## Consequences

### Positive
- Un change de CLI deja de recibir una instrucción de autorar OpenAPI que no
  aplica, sin depender del criterio del agente en cada corrida.
- Cubre el caso CLI-only **y** el de doble superficie (CLI + HTTP), que un gate
  por `capabilities` solo no cubría.
- El aviso de `validate` cierra el skip silencioso que la condición nueva
  habría introducido para un consumer mal configurado.
- Cero cambios de schema en `proposal.md`: ninguna proposal existente migra.

### Negative
- La determinación por change es un juicio del agente, no un campo validable.
  Se acepta porque queda escrita en `design.md` y pasa por sign-off humano —
  pero un humano que aprueba sin leer esa sección no tiene red mecánica.
- Tres condiciones son más difíciles de tener en la cabeza que dos; el texto
  del skill debe enumerarlas explícitamente para que ninguna se pierda en un
  merge futuro (lo fija un test de contenido).

### Risks
- Un proyecto con doble superficie cuyo change toca **ambas** (un endpoint nuevo
  *y* un comando nuevo) depende de que el agente autore el contrato para la
  parte HTTP y no descarte el paso por la de CLI. Mitigación: la regla 2 habla
  de "altera endpoints HTTP", no de "es un change de HTTP" — alcanza con que los
  altere en parte.
- El aviso advisory de la regla 4 puede normalizarse como ruido en un repo
  CLI-only que lo ve en cada corrida. Aceptado: la alternativa (hacerlo
  bloqueante) rompería este mismo repo, cuya config es legítima.

## Alternatives considered

### Campo nuevo `impact.contract_kind: http | cli | none`
Descartada por costo desproporcionado hoy: cambia el schema de `proposal.md`,
exige migrar proposals existentes y enterar a los gates que leen `impact`, para
un proyecto cuya única superficie pública es el CLI. Es la opción más correcta
a largo plazo y conviene reevaluarla si aparece un consumer real con ambas
superficies y changes frecuentes que las mezclen.

### Gatear solo por `capabilities.http`, sin determinación por change
Descartada porque no resuelve el caso de doble superficie: con `http: true` un
change puramente de CLI vuelve a disparar el authoring. Arregla el síntoma en
este repo y deja el problema general intacto.

### Documentar en prosa que el paso se omite cuando no es HTTP, sin guarda
Descartada: es el anti-patrón que la metodología viene erradicando — una
instrucción que depende de que el agente la interprete bien cada vez, sin test
que la proteja de desaparecer en un merge.

## Impact

- backend: no impact
- frontend: no impact
- security: no impact — no cambia qué se lee ni qué se escribe; solo cuándo
- data: no impact
- deployment: no impact
- testing: tests de contenido sobre `sdd-design` (las tres condiciones y el skip
  declarado) + test del aviso advisory de `playbook validate`
