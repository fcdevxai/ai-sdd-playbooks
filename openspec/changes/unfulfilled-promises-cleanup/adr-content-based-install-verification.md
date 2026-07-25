---
schema: adr
status: proposed
date: '2026-07-24'
ticket: unfulfilled-promises-cleanup
---

# ADR: La instalación global se verifica por contenido, no por número de versión

## Context

`playbook install` copia `skills/<name>/SKILL.md` a los targets globales y estampa
la versión del paquete en `<target>/.playbook-version`. `playbook doctor` compara
ese stamp contra el rango `methodology.compatible` del lock y verifica que los
skills core estén presentes y linteen — pero **nunca compara el contenido** de lo
instalado contra la fuente.

Durante el desarrollo del propio `playbook-ai` esa ceguera costó un día completo de
trabajo. El CLI global era una copia congelada del repo (instalada con `npm i -g .`)
y `installSkills` resuelve `PACKAGE_ROOT` relativo a su propio archivo, así que un
`install` corrido desde cualquier directorio copiaba los `SKILL.md` **de esa copia
vieja**. Ocho de trece skills instaladas divergían de `main`. Ambas capas decían
`0.1.0`, de modo que `doctor` reportaba la instalación como sana mientras el
contenido estaba desactualizado. El síntoma se documentó cinco veces en ciclos
distintos antes de encontrarse la causa.

Las fuerzas en tensión: el stamp de versión es barato y suficiente para gatear
compatibilidad (para eso se diseñó), pero la unidad de trabajo real de este proyecto
es el **texto de un prompt**. Dos revisiones distintas de un `SKILL.md` bajo la misma
versión producen comportamientos distintos del agente, y ese es el modo de falla
normal durante el desarrollo — no el excepcional. Un chequeo de contenido, en cambio,
exige un artefacto nuevo en el directorio target y define qué pasa con las
instalaciones que ya existen y no lo tienen.

## Decision

- `playbook install` escribe, junto al stamp de versión, un manifest
  `<target>/.playbook-manifest.json` con el digest sha256 de cada archivo instalado
  por skill, el modo de instalación y la versión.
- `playbook doctor` compara el contenido instalado contra ese manifest:
  - digest distinto del registrado → **problema bloqueante**, con el nombre del skill
    y la acción sugerida (`playbook install`);
  - manifest ausente → **nota informativa**, nunca un problema. Una instalación hecha
    con una versión previa del CLI no tiene manifest y no puede considerarse enferma
    por eso.
- El manifest es un archivo **separado**. Ni el modo de instalación ni la ruta fuente
  ni los digests entran nunca en `.playbook-version`: `playbook sync` copia ese stamp
  a `playbook.lock.methodology.resolved`, que es un archivo commiteado, y `satisfies()`
  toleraría un sufijo por accidente (`parseInt` corta en el primer carácter no
  numérico), de modo que la contaminación sería silenciosa.
- El stamp de versión conserva su rol actual sin cambios: gatear el rango de
  compatibilidad. Las dos señales son independientes y responden preguntas distintas
  — "¿es una versión compatible?" y "¿es el contenido que esa versión declara?".

## Consequences

### Positive

- La clase de falla que costó un día pasa a ser detectable con un comando, y detectable
  por cualquier consumer, no sólo por quien desarrolla el framework.
- El chequeo no necesita red ni acceso al repo fuente: compara lo instalado contra un
  manifest que viaja con la instalación.
- El stamp de versión queda con una sola responsabilidad, en vez de acumular metadata
  de instalación en un string que otro comando propaga a un archivo versionado.

### Negative

- Un artefacto más que mantener en el directorio target, y un formato más que
  versionar si mañana cambia.
- El chequeo es fiel al momento del install: detecta que lo instalado fue modificado
  o quedó viejo respecto de ese install, no que la fuente haya avanzado desde entonces.
  Para eso hace falta correr `install` de nuevo (o el modo link, ver el ADR hermano).

### Risks

- Un manifest corrupto o editado a mano podría reportar drift falso. Mitigación: el
  remedio sugerido (`playbook install`) reescribe manifest y contenido juntos, así que
  el estado inconsistente no es pegajoso.
- Hacer el mismatch bloqueante podría romper un CI que corriera `doctor`. Verificado
  que hoy ningún workflow lo hace —el CI del proyecto y el template del consumer sólo
  corren `validate --ci`— así que el riesgo es teórico mientras esa propiedad se
  mantenga.

## Alternatives considered

### Extender `.playbook-version` a JSON con los digests adentro

Descartada, y es la alternativa peligrosa: `playbook sync` lee ese archivo como string
de versión y lo escribe en `playbook.lock`, que está commiteado. Cualquier cosa que se
agregue al stamp termina en el repo del consumer, y `satisfies()` no la rechazaría.

### Comparar contra la fuente en vez de contra un manifest

Descartada: el directorio fuente no existe en la máquina del consumer (sólo el paquete
instalado), y en el desarrollo del framework la ruta del repo varía por máquina.
Requeriría configurar una ruta fuente que hoy nadie declara.

### Dejar la detección de staleness al `postinstall`

Complementaria, no alternativa: el `postinstall` avisa en el momento del update pero no
puede saber si el consumer corrió `install` después, y no corre con `--ignore-scripts`.
Ambas señales se implementan en este change y cubren momentos distintos.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: el manifest registra la ruta fuente local en modo link — dato de máquina,
  nunca commiteado y explícitamente fuera del stamp que `sync` propaga al lock
- data: artefacto nuevo `<target>/.playbook-manifest.json` en los directorios de
  instalación global; ningún archivo del repo del consumer
- deployment: `playbook install` escribe un archivo más por target
- testing: cobertura del manifest en install, del mismatch bloqueante en doctor, del
  caso "manifest ausente = nota", y una aserción de que `sync` no propaga el manifest
