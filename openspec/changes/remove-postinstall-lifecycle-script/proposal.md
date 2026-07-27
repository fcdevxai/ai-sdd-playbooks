---
schema: proposal
schema_version: 1
change_id: remove-postinstall-lifecycle-script
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
  infrastructure: true
  concurrency: false
  migration: false
security:
  risk: standard
  triggers: []
runtime_relevant_capabilities: []
---

# Eliminar el postinstall que puede romper `npm install` de consumers

## Objective

Que instalar o actualizar `playbook-ai` vía `npm install -g
github:.../lablab-playbook-ai-v2#semver:^X.Y.Z` nunca falle por causas ajenas
al consumer. Hoy puede fallar: reproducido de forma determinística (8/8
intentos), el `postinstall` del paquete dispara un crash de bootstrap de Node
(`ENOENT: process.cwd failed`, `uv_cwd`) **antes** de que el `try/catch` del
propio script exista en memoria — la garantía "nunca falla" de ADR-006 es
inalcanzable desde dentro del script cuando el fallo ocurre en un punto que el
script todavía no controla.

## Guiding principle

Un lifecycle script de npm solo puede garantizar "nunca falla" mientras la
causa del fallo esté dentro del código que ese script controla. Cuando la
causa está en cómo npm mismo maneja dependencias git (fuera de nuestro
control, confirmado con un paquete de prueba ajeno a este repo), la única
forma de cerrar el riesgo de raíz — no solo el síntoma más reciente — es no
tener lifecycle script.

## Impacted modules

- `package.json` — se quita el campo `scripts.postinstall`.
- `scripts/postinstall.cjs` — se elimina.
- `test/postinstall.test.js` — se reemplaza: ya no hay política de
  postinstall que asegurar; en su lugar, un test que impide que
  `scripts.postinstall` reaparezca en `package.json` sin una ADR que
  supersedee a `adr-remove-postinstall-lifecycle-script.md`.
- `README.md` (`## Install (global, once)`) — agrega el comando real `npm
  install -g github:lablab-outplacement/lablab-playbook-ai-v2#semver:^X.Y.Z`
  (ausente hoy) y una nota sobre el requisito de acceso git privado.
- `src/cli/dispatch.js` (o el punto de entrada compartido equivalente) —
  chequea, en cada invocación excepto `install`, si los skills globales están
  instalados (reusando la detección de `src/cli/doctor.js`) e imprime un
  aviso corto si no lo están.
- `docs/security-checklist.md` — se actualiza la fila de `postinstall`: el
  script ya no existe, la superficie que describía desaparece.

## Impacted repos

<!-- Single-repo change: no cross-repo gate. -->

## Files touched

<!-- Single-repo change: sin ## Impacted repos, esta sección queda vacía. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Given** un consumer nuevo sin `playbook-ai` instalado, **when** corre `npm
  install -g github:lablab-outplacement/lablab-playbook-ai-v2#semver:^X.Y.Z`,
  **then** el install nunca puede fallar por un lifecycle script de este
  paquete, porque no declara ninguno.
- **Given** un consumer que acaba de instalar el paquete pero no corrió
  `playbook install` todavía, **when** invoca `playbook` o `sdd` (cualquier
  comando salvo `install`), **then** ve un aviso corto de una línea
  recordándole correr `playbook install`.
- **Given** un consumer que ya corrió `playbook install`, **when** invoca
  `playbook`/`sdd` de nuevo, **then** no ve ningún aviso — la condición ya es
  falsa, sin necesidad de ningún marker persistido.

### Edge cases

- Un consumer corre con `--ignore-scripts`: sin cambio de comportamiento
  relevante, porque ya no hay ningún script que ignorar.
- Un consumer tiene los skills instalados solo para un target (por ejemplo
  Claude Code, pero no GitHub Copilot/Codex): el aviso del CLI sigue la misma
  lógica de detección por-target que ya usa `doctor` hoy — no introduce un
  criterio nuevo de "instalado" distinto al ya existente.
- `npm update` a una versión futura de `playbook-ai`: mismo camino sin
  lifecycle script, mismo comportamiento sin riesgo de romperse por esta
  causa.

## Acceptance criteria

**AC-1:** `package.json` no declara `scripts.postinstall`.

**AC-2:** `scripts/postinstall.cjs` no existe en el árbol del repo.

**AC-3:** Un test estructural falla si `package.json` vuelve a declarar
`scripts.postinstall` sin que exista una ADR `accepted`/`promoted` que
supersedee a `adr-remove-postinstall-lifecycle-script.md` (o su ADR-NNN
promovido).

**AC-4:** El README documenta el comando real de instalación `npm install -g
github:lablab-outplacement/lablab-playbook-ai-v2#semver:^X.Y.Z` en la sección
`## Install (global, once)`, antes de los comandos `playbook install`
existentes.

**AC-5:** El README documenta, en la misma sección o inmediatamente después,
que el repo es privado y requiere acceso git (SSH key o PAT) configurado.

**AC-6:** Invocar `playbook`/`sdd` con cualquier subcomando **excepto
`install`**, cuando los skills globales no están instalados para ningún
target, muestra un aviso de una línea con la versión instalada y el
recordatorio de correr `playbook install`.

**AC-7:** El mismo aviso **no** aparece cuando el subcomando invocado es
`install`.

**AC-8:** El aviso deja de aparecer, en cualquier invocación posterior, en
cuanto los skills quedan instalados para al menos un target — sin depender de
ningún archivo de estado/marker persistido nuevo.

**AC-9:** `docs/security-checklist.md` ya no lista un `postinstall` con
superficie de supply-chain activa — la fila existente se actualiza para
reflejar que el script fue eliminado.

**AC-10:** Existe `adr-remove-postinstall-lifecycle-script.md` con `status:
proposed` y `supersedes: ADR-006`, documentando la evidencia empírica de la
reproducción.

## Error cases

**EC-1:** Un consumer corre `npm install -g ... --ignore-scripts`: el install
se comporta igual que sin la flag, porque no hay ningún script que la flag
pudiera ignorar.

**EC-2:** Los skills están instalados para un target pero no para otro (por
ejemplo Claude Code sí, GitHub Copilot/Codex no): el aviso sigue el mismo
criterio de "instalado" que ya usa `doctor` — no se define un criterio nuevo
ni más estricto en este change.

**EC-3:** Un futuro cambio intenta reintroducir `scripts.postinstall` en
`package.json` sin pasar por una ADR que supersedee a
`adr-remove-postinstall-lifecycle-script.md`: el test estructural de AC-3 lo
detecta y falla.

## Security considerations

**SEC-1:** Eliminar el `postinstall` **reduce** la superficie de
supply-chain del paquete: no queda ningún lifecycle script que npm pueda
ejecutar automáticamente en la máquina o CI de un consumer al instalar o
actualizar. Documentado en `adr-remove-postinstall-lifecycle-script.md` y
reflejado en `docs/security-checklist.md` (AC-9).

**SEC-2:** El aviso del CLI (AC-6) solo lee del filesystem local del propio
consumer si los directorios de skills globales existen — el mismo dato que
`doctor` ya expone hoy. No lee el repo del consumer, no hace red, no escribe
ningún archivo nuevo.

## Constraints and non-goals

**Constraints**

- Ningún dato del consumer se lee para decidir mostrar el aviso, más allá de
  la existencia de los directorios de skills globales ya chequeada por
  `doctor`.
- El fix no reintroduce ningún mecanismo de estado persistido nuevo
  (marker file, timestamp, etc.) para determinar "primer uso".
- El resultado final de este ciclo se publica bajo la misma versión `0.9.0`
  ya taggeada — el tag `v0.9.0` se mueve al commit final de este change
  recién después de `sdd-archive`, no antes. Nadie consumió aún el contenido
  roto del tag actual, por eso es defendible moverlo en este caso puntual; no
  es una práctica a repetir para releases futuros.

**Non-goals**

- No se arregla el bug de npm en sí (está en `@npmcli/arborist`/`pacote`,
  fuera de este repo y de nuestro control).
- No se toca el repo `specloom` (predecesor, proyecto separado con el mismo
  patrón heredado).
- No se cambia el modelo de distribución (ADR-002 sigue vigente: dependencia
  git privada, tags `#semver:`).
- No se agrega tooling de `allow-scripts`/lavamoat propio — es una feature
  del entorno npm del consumer, no algo que este proyecto deba configurar.

## Open technical decisions

<!-- Ninguna: las decisiones de fondo (eliminar el postinstall, reemplazo por
README + aviso del CLI autoextinguible, manejo del tag v0.9.0 después del
archive) se cerraron en enrich. -->
