---
sources:
  proposal: 81b5c602b2b8cdddb9dcb9d7f75b4482d2ad9e86a223606866d3e9fc5d07102e
  tasks: 9912e3a7ef3655159870e4de20f2578167b7c7cac7c7696249e6e1ba10f8a751
---
# Context Packet — Cerrar las promesas incumplidas del CLI, la distribución y las specs

## Ticket

unfulfilled-promises-cleanup

## Acceptance criteria

**AC-1:** `openspec/changes/.gitkeep` está commiteado y `playbook doctor` no reporta
`missing openspec/changes/` en un checkout limpio de la rama base sin changes activos.

**AC-2:** `playbook init` scaffoldea `openspec/changes/.gitkeep`, no solamente el
directorio, verificable sobre un proyecto temporal.

**AC-3:** `playbook packet` emite un warning cuando `tasks.md` no declara la entrada
`Regression`, incluso habiendo extraído otros comandos; el warning no altera el exit code
ni hace fallar `playbook validate`.

**AC-4:** `sdd-plan` instruye declarar la entrada `Regression` en `tasks.md`, con un test
de contenido que fija la instrucción, y la instrucción es alcanzable (ninguna sección
previa del mismo skill la contradice).

**AC-5:** `playbook install` escribe `<target>/.playbook-manifest.json` con el digest
sha256 de cada archivo instalado por skill, la versión y `mode: "copy"`.

**AC-6:** `playbook doctor` reporta un problema bloqueante cuando el contenido instalado
difiere del digest registrado, nombrando el skill; con manifest ausente o ilegible reporta
una nota informativa y no falla.

**AC-7:** `playbook install --link` crea el directorio del skill como directorio real con
su archivo instalable enlazado a la fuente y registra `mode: "link"` con la ruta fuente;
sin la flag, la instalación sigue copiando con resultado byte a byte idéntico al actual.

**AC-8:** `playbook doctor` en modo link reporta el enlace y su fuente, y no compara
digests.

**AC-9:** El manifest nunca llega al lock: `playbook sync` sigue escribiendo únicamente el
stamp de versión en `methodology.resolved`, fijado por test.

**AC-10:** `package.json` declara exactamente un lifecycle script, `postinstall`,
apuntando a `scripts/postinstall.js`, incluido en `files:`; el script imprime a lo sumo
tres líneas nombrando `playbook install`, no escribe en disco, no lee el repo del
consumer, no hace red y sale 0 incluso ante un error interno. `prepare` y `preinstall`
siguen ausentes.

**AC-11:** `openspec/specs/cli/spec.md` describe el postinstall real de `playbook-ai`
(su ruta, su comando y su test) y ya no promete que un `contract.path_in_loom` absoluto se
use tal cual.

**AC-12:** `playbook contract-drift` rechaza con un error claro y exit code de error un
`contract.path_in_loom` que resuelva fuera del repo, y sigue funcionando con la ruta
relativa configurada hoy.

## Constraints and non-goals

**Constraints**

- El comportamiento por defecto de `playbook install` (copia) no cambia: `--link` es
  opt-in y el resultado sin la flag debe ser byte a byte el actual.
- El warning del packet es advisory: no puede alterar exit codes ni invalidar packets ya
  generados.
- El chequeo de contenido no puede poner en rojo instalaciones previas sin manifest.
- Sin dependencias nuevas; `node:crypto` de la stdlib para los digests.
- Las skills se regeneran, no se editan a mano: la edición va en `canonical.md` y
  `npm run generate:check` no debe reportar drift.
- Por la exclusión documentada del adapter `cli` (`runtime_relevant_capabilities: []`),
  este change modifica comportamiento observable del CLI, así que debe traer al menos un
  test que **falle contra el código previo** y registrar en `runtime-gate-report.md` la
  invocación real antes y después. La exclusión no exime de evidencia.

**Non-goals**

- Cortar el tag `v0.1.0` ni definir el flujo de release: es un acto hacia afuera, va en su
  propio change con confirmación humana explícita.
- Podar el texto heredado de specloom en las specs permanentes (61 líneas en
  `cli/spec.md`, 24 en `playbooks/spec.md`): sólo se corrigen las referencias que este
  change vuelve falsas.
- Resolver la ambigüedad de "contrato público" entre API HTTP y superficie de CLI.
- Implementar soporte de rutas absolutas para el contrato: se decidió borrar la promesa.
- Implementar el harness del adapter `cli` del runtime gate.
- Ampliar el vocabulario de etiquetas que `packet` extrae (por ejemplo aceptar
  `Regresión`).

## Security considerations

**SEC-1:** El `postinstall` es superficie nueva de supply-chain: código de este paquete
ejecutándose automáticamente en cada máquina y cada CI de cada consumer. Queda acotado por
la política message-only ya decidida (nunca escribe, nunca lee el repo del consumer, nunca
hace red, nunca falla) y por un test estructural que la asegura, según AC-10. La política
no se relaja en este change, así que no requiere superseder la decisión que la fijó.
Limitación aceptada y documentada: con `--ignore-scripts` no hay señal.

**SEC-2:** El manifest guarda digests y, en modo link, una ruta local del desarrollador.
Nunca se commitea y nunca entra en `.playbook-version`, porque `playbook sync` copia ese
stamp a `playbook.lock.methodology.resolved` —archivo versionado que el consumer hereda— y
`satisfies()` toleraría un sufijo por accidente, de modo que la contaminación sería
silenciosa. AC-9 lo fija por test.

**SEC-3:** La contención al resolver `contract.path_in_loom` (AC-12) es un control nuevo y
real, no una declaración: cierra la exigencia que `docs/security-checklist.md` ya declara
para esa superficie ("debe quedar contenida al repo") y que ningún código verificaba.
Severidad base baja —la config está commiteada, y quien la controla ya controla el repo—
pero esa misma ruta hoy además se **escribe** durante el authoring del contrato, así que el
control aplica a las dos direcciones.

**SEC-4:** `install --link` escribe symlinks únicamente dentro del target resuelto y no
sigue ni reescribe rutas fuera de él. Sobrescribir copias existentes en el target es el
permiso que `install` ya ejerce hoy con `copyFileSync`; este change no lo amplía.

## Files touched

- `src/install/manifest.js`
- `test/install.test.js`
- `src/install/skills.js`
- `src/cli/doctor.js`
- `test/doctor.test.js`
- `test/sync.test.js`
- `src/cli/install.js`
- `scripts/postinstall.js`
- `package.json`
- `test/postinstall.test.js`
- `openspec/specs/cli/spec.md`
- `src/util/fs-safe.js`
- `test/fs-safe.test.js`
- `src/cli/repos.js`
- `test/repos.test.js`
- `openspec/changes/.gitkeep`
- `src/cli/init.js`
- `test/init.test.js`
- `src/tokens/packet.js`
- `test/tokens.test.js`
- `skills/sdd-plan/canonical.md`
- `skills/sdd-plan/SKILL.md`

## Verification commands

- `(sin formatter configurado todavía)`
- `node --check <archivo.js>`
- `node --test test/install.test.js test/doctor.test.js test/postinstall.test.js test/fs-safe.test.js test/repos.test.js test/tokens.test.js test/init.test.js test/sync.test.js test/skill-contract.test.js`
- `npm test`
- `npm run generate:check`

## Full sources

- openspec/changes/unfulfilled-promises-cleanup/proposal.md
- openspec/changes/unfulfilled-promises-cleanup/tasks.md
