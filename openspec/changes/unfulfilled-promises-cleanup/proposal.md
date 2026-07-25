---
schema: proposal
schema_version: 1
change_id: unfulfilled-promises-cleanup
status: approved
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
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
  triggers: [critical_dependency, infrastructure]
runtime_relevant_capabilities: []
---

# Cerrar las promesas incumplidas del CLI, la distribución y las specs

## Objective

Hacer que el estado que `playbook-ai` reporta coincida con su estado real, cerrando ocho
afirmaciones falsas concretas que hoy cuestan trabajo silencioso: `doctor` que declara
sana una instalación desactualizada, un packet que pierde el comando de regresión sin
avisar, un `main` que su propio `doctor` marca enfermo, y specs permanentes que prometen
comportamiento que el código no tiene.

## Guiding principle

Cada ítem de este change corrige una **afirmación**, no un bug de runtime. El criterio
que los une: si el proyecto dice o implica algo —en la salida de un comando, en un
archivo de spec, en un ADR aceptado—, eso debe ser verdad o debe dejar de decirse. Donde
haya que elegir entre implementar la promesa o borrarla, se elige según si la propiedad
prometida es deseable, no según cuál es más barata.

Corolario operativo, heredado del punto ciego documentado en `openspec/specs/playbooks/spec.md`:
un test de contenido verifica que una instrucción **está**, no que sea **alcanzable**. Al
insertar el wiring de `sdd-plan` hay que releer las secciones que el agente lee antes
(`Preconditions`, `Context`, `Rules`) y confirmar que ninguna lo contradiga.

## Impacted modules

- `src/install/skills.js` — escribe el manifest de contenido; modo link además de copia.
- `src/cli/install.js` — flag `--link`.
- `src/cli/doctor.js` — verificación por contenido; reporte del modo link; nota cuando no
  hay manifest.
- `src/cli/init.js` — scaffoldea `openspec/changes/.gitkeep`, no sólo el directorio.
- `src/tokens/packet.js` — warning cuando falta la entrada `Regression`.
- `src/util/fs-safe.js` — resolvedor de rutas contenidas (frontera también de lectura).
- `src/cli/repos.js` — `contract-drift` resuelve `contract.path_in_loom` con ese helper.
- `package.json` — un único lifecycle script (`postinstall`) + entrada en `files:`.
- `scripts/postinstall.cjs` — nuevo, message-only.
- `skills/sdd-plan/canonical.md` (+ `SKILL.md` regenerado) — exige la línea `Regression`.
- `openspec/specs/cli/spec.md` — describe el postinstall real; borra la promesa de ruta
  absoluta.
- `openspec/changes/.gitkeep` — nuevo, commiteado.
- `test/` — cobertura por ítem (ver criterios de aceptación).

## Impacted repos

<!-- Single-repo change: no cross-repo gate. -->

## Files touched

<!-- Single-repo change: not applicable. -->

## Expected behavior

### Happy path (Given/When/Then)

- **Dado** un checkout limpio de la rama base sin changes activos, **cuando** se corre
  `playbook doctor`, **entonces** no reporta `missing openspec/changes/`.
- **Dado** un proyecto nuevo, **cuando** se corre `playbook init`, **entonces**
  `openspec/changes/.gitkeep` existe, de modo que git preserve el directorio.
- **Dado** un `tasks.md` con comandos de `Format` y `Feature tests` pero sin entrada
  `Regression`, **cuando** se corre `playbook packet <change>`, **entonces** el packet se
  genera y la salida incluye un warning que nombra la entrada faltante, con el mismo exit
  code que hoy.
- **Dado** un plan siendo granularizado, **cuando** corre `sdd-plan`, **entonces** el
  skill instruye declarar la entrada `Regression` en `tasks.md`.
- **Dado** `playbook install` recién corrido, **cuando** se inspecciona el target,
  **entonces** existe `.playbook-manifest.json` con el digest sha256 de cada archivo
  instalado y `mode: "copy"`.
- **Dado** un target instalado cuyo `SKILL.md` fue modificado después del install,
  **cuando** se corre `playbook doctor`, **entonces** reporta un problema bloqueante que
  nombra el skill y sugiere `playbook install`.
- **Dado** un checkout del repo, **cuando** se corre `playbook install --link`,
  **entonces** cada skill queda como directorio real con su archivo instalable
  enlazado a la fuente, el manifest registra `mode: "link"` y la ruta fuente, y
  `playbook doctor` reporta el enlace sin comparar digests.
- **Dado** un consumer que instala o actualiza el paquete, **cuando** npm ejecuta el
  `postinstall`, **entonces** se imprimen a lo sumo tres líneas con la versión instalada
  y el recordatorio de correr `playbook install`, sin escribir nada ni leer el repo del
  consumer.
- **Dado** un `contract.path_in_loom` relativo válido, **cuando** se corre
  `playbook contract-drift <generado>`, **entonces** se comporta igual que hoy.

### Edge cases

- Manifest ausente (instalación hecha con una versión previa del CLI): `doctor` emite una
  nota informativa y **no** falla.
- Manifest presente pero ilegible o corrupto: se trata como ausente — nota, nunca crash.
- Modo link con el repo movido o borrado (symlink colgado): `doctor` lo reporta con el
  remedio, y el lint de skills existente ya tolera symlinks colgados sin romperse.
- `install --link` sobre un target que hoy tiene copias reales: las reemplaza por
  enlaces, mismo permiso que el `install` actual ya ejerce al sobrescribir copias.
- `install --link` en una máquina donde el paquete vino de npm: enlaza al propio
  directorio del paquete — inocuo y documentado como sin utilidad.
- Consumer que instala con `--ignore-scripts`: no hay señal de postinstall; el flujo
  manual documentado es la fuente de verdad.
- `tasks.md` con la etiqueta escrita en castellano (`Regresión`): sigue sin extraerse, y
  ahora el warning lo hace visible.

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
apuntando a `scripts/postinstall.cjs`, incluido en `files:`; el script imprime a lo sumo
tres líneas nombrando `playbook install`, no escribe en disco, no lee el repo del
consumer, no hace red y sale 0 incluso ante un error interno. `prepare` y `preinstall`
siguen ausentes.

**AC-11:** `openspec/specs/cli/spec.md` describe el postinstall real de `playbook-ai`
(su ruta, su comando y su test) y ya no promete que un `contract.path_in_loom` absoluto se
use tal cual.

**AC-12:** `playbook contract-drift` rechaza con un error claro y exit code de error un
`contract.path_in_loom` que resuelva fuera del repo, y sigue funcionando con la ruta
relativa configurada hoy.

## Error cases

**EC-1:** Symlink colgado en modo link (repo movido o borrado) → `doctor` lo reporta como
problema con el remedio de re-correr el comando; ningún comando lanza excepción no
manejada.

**EC-2:** Manifest ilegible, truncado o con JSON inválido → se trata como ausente: nota
informativa, sin crash y sin falso positivo de drift.

**EC-3:** `contract.path_in_loom` que escapa del repo (`../..`, o absoluto a otro árbol) →
error explícito nombrando la ruta rechazada, sin intentar la lectura.

**EC-4:** Falla interna del `postinstall` (por ejemplo `package.json` ilegible) → no
imprime nada y sale 0; un `npm install` nunca falla por este paquete.

**EC-5:** Target de instalación no escribible al correr `install --link` → error claro del
comando; no deja el target a medias entre copias y enlaces.

**EC-6:** `tasks.md` sin ninguna entrada de comandos reconocible → se mantiene el warning
actual de lista vacía, ahora acompañado del que nombra `Regression`, sin duplicar el
mismo mensaje.

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

## Open technical decisions

Dos puntos para que el revisor humano confirme o corrija en la aprobación:

1. **`impact.public_contract: false` pese a que el change agrega una flag nueva al CLI.**
   Un change previo declaró `true` justamente por agregar un comando, pero el trigger de
   authoring del contrato canónico asume endpoints HTTP: declarar `true` pediría autorar un
   `openapi.yaml` para una flag de CLI, en un proyecto sin superficie HTTP
   (`capabilities.http: false`). Se usa el encuadre del último ciclo —`public_contract:
   false` + `architecture_boundary: true`— que mantiene `sdd-design` activo sin pedir
   endpoints inexistentes. La ambigüedad de fondo queda fuera de alcance y sin resolver.

2. **`security.risk: standard` en un change que introduce un lifecycle script.** Hay caso
   defendible para `elevated`: es superficie de supply-chain nueva para todo consumer. Se
   propone `standard` porque el contenido es un `console.log` gateado por test estructural
   y el change no toca autenticación, datos personales ni secretos —y porque el gate de
   seguridad puede subir el riesgo, nunca bajarlo, así que el conservadurismo tiene dónde
   aplicarse después. Si el revisor prefiere `elevated` de entrada, cambia sólo este campo.
