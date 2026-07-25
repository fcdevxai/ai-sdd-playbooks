---
schema: adr
status: accepted
date: '2026-07-24'
ticket: unfulfilled-promises-cleanup
---

# ADR: `playbook install --link` es un segundo modo de instalación soportado, opt-in y dev-only

## Context

Quien desarrolla la metodología edita `skills/<name>/canonical.md`, regenera
`SKILL.md` y necesita que el agente use **esa** versión. Pero el agente sólo lee los
directorios globales (`~/.claude/skills`, `~/.agents/skills`), y el único mecanismo
para poblarlos —`playbook install`— **copia**. Cada edición exige recordar correr el
comando; si no, el agente sigue leyendo la copia anterior sin ninguna señal.

Eso ya produjo el peor resultado posible en este proyecto: cuatro ciclos SDD se
ejecutaron con skills previas a sus propios fixes. Cada fix quedó verificado por test
de contenido pero nunca ejercitado, así que el ciclo cerraba en verde sin haber usado
lo que arreglaba. El costo no fue un bug: fue trabajo desperdiciado con sensación de
cierre, que es el modo de falla más difícil de detectar porque no deja rastro.

El workaround que se usó durante el desarrollo fue armar los symlinks a mano. Funciona,
pero no es reproducible (nadie más sabe que existe), no sobrevive a mover el repo de
lugar, y el chequeo de contenido del ADR hermano lo reportaría como "no verificable"
para siempre, porque no hay manifest.

Las fuerzas en tensión: el modo copia es el correcto para un consumer —quiere una
instalación estable, desacoplada del repo del framework— y el modo link es el correcto
para quien desarrolla el framework. Un solo mecanismo no sirve a los dos, y elegir el
del desarrollador por default expondría al consumer a symlinks a rutas que en su
máquina no existen.

## Decision

- `playbook install --link` instala por **symlink** en vez de copia: crea el directorio
  del skill como directorio real y enlaza cada archivo instalable a su origen en el repo.
- El archivo se enlaza; el directorio no. Así el descubrimiento del harness sigue viendo
  un directorio real, y el contrato de instalación se mantiene: sólo viajan los archivos
  instalables, nunca `canonical.md`.
- El manifest registra `mode: "link"` y la ruta fuente. `playbook doctor` en modo link
  reporta el enlace y **no** compara digests: un symlink es, por definición, el contenido
  actual de la fuente.
- Sin la flag, el comportamiento es exactamente el actual: copia byte a byte,
  `mode: "copy"`, digests comparables. El default no cambia.
- El modo es **dev-only** y así se documenta: en una máquina donde el paquete se instaló
  desde npm, `--link` enlazaría al propio directorio del paquete en `node_modules` —
  inocuo pero sin utilidad. La utilidad existe sólo cuando el CLI corre desde un checkout
  del repo.
- Un enlace roto (repo movido o borrado) es un problema que `doctor` reporta, con el
  remedio de volver a correr el comando.

## Consequences

### Positive

- El loop de desarrollo pierde un paso obligatorio y silencioso: editar y regenerar
  alcanza, no hay que acordarse de reinstalar.
- El setup deja de ser un arreglo manual indocumentado y pasa a ser un comando que
  cualquiera puede repetir, y que `doctor` sabe describir.
- El chequeo de contenido del ADR hermano cubre también las máquinas de desarrollo, en
  vez de quedar permanentemente en "no verificable".

### Negative

- Una superficie más en el CLI y un segundo camino en `install` que hay que mantener y
  testear.
- Los symlinks son absolutos: mover el repo los rompe. El remedio es re-correr el
  comando, pero es un modo de falla que la copia no tiene.

### Risks

- Deriva de default: la tentación futura de linkear también para consumers, porque "es
  más cómodo". La política es normativa acá — el default es copia, y `--link` es opt-in.
- Sobrescribir copias existentes en el directorio target. Aceptado con el precedente ya
  vigente: `installSkills` hoy usa `copyFileSync`, que también sobrescribe sin token de
  confirmación. El directorio global de skills ya es territorio que `install` administra;
  este change no amplía ese permiso.
- Las skills se indexan al arrancar la sesión del agente, así que el link elimina el paso
  de copiar pero no el de reiniciar. Documentarlo evita la expectativa equivocada de
  "edito y ya".

## Alternatives considered

### Symlinkear el directorio del skill completo

Descartada: expondría `canonical.md` dentro del directorio instalado, rompiendo el
contrato de "sólo viajan los archivos instalables" y dejando dos copias del mismo
contrato conviviendo. Además dependería de que el descubrimiento del harness siga
symlinks de directorio, propiedad que no está garantizada por ningún contrato público.

### Un hook de sesión que corra `install` antes de cada arranque

Descartada como mecanismo principal: sigue copiando, invade el harness del consumer, y
sólo puede actuar en el arranque. Es una envoltura del problema, no su solución.

### Dejar el setup manual y documentarlo en el README

Descartada: es lo que ya pasó de hecho, y produjo un setup que sólo una persona sabía
que existía, invisible para `doctor`.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: escribe symlinks únicamente dentro del target resuelto; no sigue ni
  reescribe rutas fuera de él. La ruta fuente queda en el manifest local, nunca en un
  archivo commiteado
- data: sin cambios en artefactos del repo; en el target, symlinks en vez de copias
  cuando se pide explícitamente
- deployment: modo de instalación nuevo, opt-in; el default de distribución no cambia
- testing: cobertura del modo link (symlink creado y apuntando a la fuente, manifest con
  `mode: link`), de que el default sigue copiando idéntico, y del reporte de `doctor` en
  modo link
