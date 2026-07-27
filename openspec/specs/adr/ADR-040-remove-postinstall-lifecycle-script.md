---
schema: adr
status: accepted
date: '2026-07-27'
ticket: remove-postinstall-lifecycle-script
supersedes: ADR-006
---

# ADR: El paquete no declara ningún lifecycle script de npm — el postinstall se elimina

## Context

ADR-006 (heredado verbatim de `specloom` vía ADR-026) decidió que `playbook-ai`
declare un `postinstall` "message-only": nunca escribe, nunca lee el repo del
consumer, nunca hace red, y — la propiedad central — **"nunca falla: exit 0
incondicional, incluso ante errores internos (`try/catch` global). Un `npm
install` jamás se rompe por specloom."**

Esa garantía se probó falsa empíricamente. Instalando el paquete como consumer
real (`npm install -g github:lablab-outplacement/lablab-playbook-ai-v2#semver:^0.9.0`),
el `postinstall` hizo fallar el install completo con:

```
npm error command /usr/bin/sh -c node scripts/postinstall.cjs
Error: ENOENT: process.cwd failed with error no such file or directory,
the current working directory was likely removed without changing the
working directory, uv_cwd
    at resolveMainPath (node:internal/modules/run_main:35:36)
```

El crash ocurre en el **bootstrap de Node**, resolviendo la ruta relativa del
script (`scripts/postinstall.cjs`) contra `process.cwd()`, **antes** de que el
`try/catch` de nuestro propio script exista en memoria. Ningún manejo de
errores en JS puede protegerse de un crash que pasa antes de que el JS cargue.

Aislamiento de la causa (reproducido en un entorno limpio, sin symlinks de
dogfooding, sin estado previo):

- Un paquete de prueba mínimo, sin ninguna relación con `playbook-ai` (un
  `postinstall` de una sola línea, `console.log`), instalado como dependencia
  git (`git+file://...#semver:^1.0.0`), **falló idéntico** — mismo `ENOENT`,
  mismo `uv_cwd`. Esto descarta que sea un bug de nuestro código.
- El mismo paquete instalado como **tarball plano** (sin git) no crasheó.
- Un script con un marker file (`fs.appendFileSync`) confirmó que, cuando el
  install tiene éxito, el `cwd` real del proceso hijo es un directorio
  temporal de la caché de npm (`~/.npm/_cacache/tmp/git-clone*`) — no la
  ubicación final en `node_modules/`. Ese directorio es efímero: npm lo
  limpia/mueve internamente en una ventana de tiempo muy angosta alrededor del
  momento en que lanza el proceso hijo del lifecycle script.
- Reproducido de forma consistente: **8/8 intentos fallaron** sin mitigación,
  en npm 11.16.0 / Node v24.18.0 / WSL2 — no es una race rara, es
  prácticamente determinística en esta combinación real de herramientas que
  el equipo usa hoy.

La causa es un bug de npm en su manejo de dependencias git + lifecycle
scripts (o una interacción de ese manejo con este filesystem/WSL), fuera del
control de este repo. Pero el efecto — que cualquier consumer, en cualquier
`npm install`/`npm update` futuro de este paquete bajo una combinación de
herramientas similar, puede ver el install completo fallar — sí es
responsabilidad de este repo, porque es este repo el que decide declarar (o
no) un `postinstall`.

Se evaluó un wrapper de shell (`node scripts/postinstall.cjs || exit 0`), que
efectivamente convierte cualquier fallo interno (incluido este crash de
bootstrap) en un exit 0 a nivel de npm — verificado empíricamente (6/6 éxitos
con el wrapper vs. 8/8 fallos sin él). Se descartó como solución final: cierra
*este* síntoma puntual, pero dejar declarado un lifecycle script en un
paquete de distribución git-privada mantiene la superficie de riesgo abierta
a la próxima falla no anticipada que un `|| exit 0` no cubra (por ejemplo, un
timeout, una señal del SO, o un fallo del propio intérprete de shell). La
única forma de cerrar el riesgo de raíz — en vez de parchear el síntoma más
reciente — es no tener lifecycle script.

Verificado además: el mensaje que el `postinstall` imprime **ya no es visible**
para un consumer en el flujo normal de instalación en npm 11.x — `npm install`
sin `--foreground-scripts` (el modo default) oculta el stdout de cualquier
lifecycle script. El valor original del mecanismo (que el consumer se entere,
en el momento del install, de que debe correr `playbook install`) ya estaba
roto en la práctica, independientemente de este bug.

## Decision

`playbook-ai` no declara ningún lifecycle script de npm (`postinstall`,
`preinstall`, `prepare`, etc.). La señal que ADR-006 buscaba dar se reemplaza
por dos canales que no dependen de que npm ejecute código del paquete:

1. **README** documenta el flujo completo de instalación explícitamente: el
   comando real `npm install -g github:lablab-outplacement/lablab-playbook-ai-v2#semver:^X.Y.Z`
   (ausente hasta ahora) seguido de `playbook install`, más una nota de que el
   repo es privado y requiere acceso git (SSH/PAT) configurado.
2. **El propio CLI** (`playbook`/`sdd`) detecta, en cada invocación excepto
   cuando el comando es `install`, si los skills globales no están instalados
   — reusando la misma lógica de detección que ya usa `doctor` — e imprime un
   aviso corto de una línea. Es autoextinguible: en cuanto el consumer corre
   `playbook install`, la condición pasa a falsa y el aviso deja de aparecer,
   sin necesidad de ningún marker file ni estado persistido nuevo.

Esta decisión **supersede ADR-006** en su totalidad — no la enmienda, la
reemplaza: ADR-006 asumía que un lifecycle script "nunca falla" es alcanzable
con disciplina de código (`try/catch` global); esta ADR documenta que esa
garantía es inalcanzable desde dentro del script cuando el fallo ocurre en el
bootstrap del intérprete, antes de que el script exista.

## Consequences

### Positive

- Cero superficie de lifecycle script: nada que npm pueda ejecutar
  automáticamente en la máquina o CI de un consumer, ni siquiera un mensaje
  inocuo. Auditoría de supply-chain aún más simple que la que ADR-006 ya
  buscaba.
- El riesgo de raíz (el crash reproducido) desaparece por completo, no solo
  el síntoma puntual — un futuro modo de fallo no anticipado del mismo bug de
  npm no tiene ninguna superficie para manifestarse.
- El aviso del CLI es, en la práctica, **más confiable** que el mensaje
  original: se muestra siempre que hace falta (la condición se reevalúa en
  cada invocación) en vez de una sola vez en un momento donde npm ya lo oculta
  por default.

### Negative

- El consumer que instala y nunca vuelve a invocar `playbook`/`sdd` (por
  ejemplo, si otro proceso automatizado ya corre `playbook install` por él)
  no ve ningún aviso — igual que hoy, dado que el mensaje del postinstall ya
  era invisible en el modo default de npm.
- Un test estructural nuevo debe impedir que un futuro cambio reintroduzca un
  `postinstall` sin pasar por una ADR que supersedee a esta.

### Risks

- Si en el futuro se necesita ejecutar código real al momento del install
  (no solo un mensaje), esta decisión bloquea esa vía por completo — haría
  falta otra ADR que la supersedeara, con el mismo peso de decisión que tuvo
  originalmente ADR-006.

## Alternatives considered

### Wrapper `node scripts/postinstall.cjs || exit 0`

Verificado empíricamente que funciona (6/6 éxitos). Descartado como solución
final: resuelve el síntoma reproducido, pero mantiene declarado un lifecycle
script cuya causa de fallo real está fuera de nuestro control (un bug de npm),
dejando abierta la puerta a un futuro modo de fallo que un `exit 0`
incondicional no cubra de la misma forma (por ejemplo, un fallo que impida
siquiera lanzar el shell).

### Mantener el postinstall, agregar reintentos

Descartado: reintentar no soluciona una race que depende del timing interno
de npm, y agrega complejidad y latencia al install sin garantía real de
evitar la causa.

### Reportar el bug a npm y esperar un fix upstream

No descartado como acción futura, pero no es una solución que este repo pueda
controlar ni tiene ETA — no resuelve el problema para el equipo hoy.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: reduce la superficie de supply-chain — el paquete deja de tener
  ningún lifecycle script ejecutable automáticamente en la máquina/CI de un
  consumer
- data: sin impacto
- deployment: cambia el mecanismo de señal post-install (ver Decision); no
  cambia el modelo de distribución (ADR-002 sigue vigente sin cambios)
- testing: test estructural que impide reintroducir un `postinstall` sin ADR
  que supersedee a esta; test de contenido sobre el aviso del CLI
