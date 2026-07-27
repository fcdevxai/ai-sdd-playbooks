---
sources:
  proposal: c2a64df5fbaf3b46ff50a8837e115b1d8241741dc4f8be9b2341182aa5644ba8
  tasks: 40c70fbc656a92d2bb4dbc440f19b5347c9ebb86487a8a4054a708ffa4fdc855
  contract: 2260109d99574a48c6b6a511d5963f4425e30b430daa082a75e3a115f9aaf70c
---
# Context Packet — Eliminar el postinstall que puede romper `npm install` de consumers

## Ticket

remove-postinstall-lifecycle-script

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

## Files touched

- `test/postinstall.test.js`
- `package.json`
- `scripts/postinstall.cjs`
- `src/install/targets.js`
- `test/install.test.js`
- `src/cli/dispatch.js`
- `test/dispatch.test.js`
- `README.md`
- `test/readme.test.js`
- `docs/security-checklist.md`

## Verification commands

- `docs/doc_verification_guide.md`
- `node --check package.json`
- `node --test test/postinstall.test.js test/install.test.js test/dispatch.test.js test/readme.test.js`
- `npm test && npm run generate:check`

## Contract

- Path: `openspec/specs/contracts/openapi.yaml`

## Full sources

- openspec/changes/remove-postinstall-lifecycle-script/proposal.md
- openspec/changes/remove-postinstall-lifecycle-script/tasks.md
