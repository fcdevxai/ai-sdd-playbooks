---
schema: tasks
schema_version: 1
change_id: unfulfilled-promises-cleanup
status: passed
owner: Bernardo Machuca
created: 2026-07-24
updated: 2026-07-24
---

# Tasks — Cerrar las promesas incumplidas del CLI, la distribución y las specs

TDD en todas las tareas: el test se escribe primero y **debe fallar contra el código
previo** (exigencia de ADR-032, porque el adapter `cli` está excluido). Todos los comandos
se corren desde la raíz del repo. Dependencias entre fases: la 2 depende de la 1 (comparten
`manifest.js` y `installSkills`); la 3, 4 y 5 son independientes entre sí y de las
anteriores.

## Phase 1 — Manifest de instalación

### Task 1.1 — Módulo puro del manifest [x]
- **Files**: `src/install/manifest.js`, `test/install.test.js`
- **Success criterion**: `node --test test/install.test.js` pasa con casos para
  `buildManifest` (digest sha256 por archivo, `schema_version: 1`, `mode: "copy"`),
  `readManifest` (ausente → `null`; JSON inválido → `null`, sin lanzar) y `verifyManifest`
  (entrada `sha256` coincidente → sin hallazgos; alterada → hallazgo que nombra el skill y
  el archivo). Ninguna función llama `process.exit` ni escribe en disco.
- **Linked acceptance criterion**: AC-5, AC-6

### Task 1.2 — `installSkills` escribe el manifest en modo copia [x]
- **Files**: `src/install/skills.js`, `test/install.test.js`
- **Success criterion**: tras `installSkills` sobre un target temporal existe
  `.playbook-manifest.json` con una entrada `sha256` por skill instalada y `mode: "copy"`;
  `.playbook-version` conserva exactamente su formato de una línea con la versión.
- **Linked acceptance criterion**: AC-5

### Task 1.3 — `doctor` verifica el contenido instalado [x]
- **Files**: `src/cli/doctor.js`, `test/doctor.test.js`
- **Success criterion**: con un `SKILL.md` instalado modificado a mano, `doctor` emite un
  **problema** que nombra el skill y sugiere `playbook install`, y `healthy` pasa a
  `false`; con manifest ausente emite una **nota** y `healthy` no cambia; con manifest
  ilegible o `schema_version` desconocida emite una **nota** sin lanzar excepción. La
  función de diagnóstico es pura y read-only sobre el target dir.
- **Linked acceptance criterion**: AC-6

### Task 1.4 — El manifest no llega al lock [x]
- **Files**: `test/sync.test.js`
- **Success criterion**: tras instalar (copia y link), `playbook sync` escribe en
  `playbook.lock.methodology.resolved` únicamente la versión del stamp — sin modo, sin
  ruta fuente, sin digests. Implementa SEC-002; el test negativo es que un `resolved` que
  contenga la ruta fuente o `mode` hace fallar la aserción.
- **Linked acceptance criterion**: AC-9

## Phase 2 — Modo link

### Task 2.1 — `installSkills` soporta `mode: 'link'` [x]
- **Files**: `src/install/skills.js`, `src/install/manifest.js`, `test/install.test.js`
- **Success criterion**: con `mode: 'link'`, cada skill queda como **directorio real** y
  cada archivo instalable como symlink que resuelve al archivo del `sourceRoot`;
  `canonical.md` no aparece en el target; el manifest registra `mode: "link"`, `source` y
  una entrada `link` por archivo. Sin `mode`, el resultado es byte a byte idéntico al
  actual (aserción explícita contra el comportamiento previo).
- **Linked acceptance criterion**: AC-7

### Task 2.2 — Flag `--link` en el comando [x]
- **Files**: `src/cli/install.js`, `test/install.test.js`
- **Success criterion**: `playbook install --link` instala en modo link y el summary (texto
  y `--json`) nombra el modo; sin la flag el modo es `copy` y la salida mantiene su forma
  actual; una flag desconocida sigue comportándose como hoy.
- **Linked acceptance criterion**: AC-7

### Task 2.3 — `doctor` reporta el modo link y detecta el enlace colgado [x]
- **Files**: `src/cli/doctor.js`, `test/doctor.test.js`
- **Success criterion**: en modo link, `doctor` emite una **nota** que nombra la fuente
  enlazada y no compara digests; con el destino del symlink borrado emite un **problema**
  con el remedio de re-correr el comando, sin excepción no manejada (cubre EC-1).
- **Linked acceptance criterion**: AC-8

### Task 2.4 — El modo link no escribe fuera del target [x]
- **Files**: `test/install.test.js`
- **Success criterion**: test negativo de SEC-004 — tras `install --link` sobre un target
  temporal, no existe ningún archivo ni symlink nuevo fuera de ese directorio, y los
  enlaces creados apuntan al `sourceRoot` declarado y a ningún otro árbol.
- **Linked acceptance criterion**: AC-7

## Phase 3 — Señal de post-update

### Task 3.1 — Script `postinstall` message-only [x]
- **Files**: `scripts/postinstall.cjs`, `package.json`, `test/postinstall.test.js`
- **Success criterion**: `node scripts/postinstall.cjs` sale 0, imprime a lo sumo 3 líneas
  y nombra `playbook install`; copiado a un directorio donde su `package.json` no resuelve,
  sale 0 y no imprime nada (cubre EC-4); `package.json` declara exactamente un lifecycle
  script (`postinstall`), sin `prepare` ni `preinstall`, y `scripts/postinstall.cjs` está en
  `files:`.
- **Linked acceptance criterion**: AC-10

### Task 3.2 — Test estructural de la política del script [x]
- **Files**: `test/postinstall.test.js`
- **Success criterion**: test negativo de SEC-001 — el fuente del script no importa nada de
  `src/`, no contiene llamadas de escritura a filesystem (`writeFile`, `mkdir`, `rm`,
  `copyFile`, `appendFile`) ni de red (`fetch`, `http`, `https`, `net`), y su cuerpo está
  envuelto en `try/catch` sin re-lanzar. Agregar una escritura al script hace fallar este
  test.
- **Linked acceptance criterion**: AC-10

### Task 3.3 — Corregir la sección del postinstall en la spec permanente [x]
- **Files**: `openspec/specs/cli/spec.md`
- **Success criterion**: la sección `## Post-update signal (postinstall)` describe la ruta
  real (`scripts/postinstall.cjs`), el comando real (`playbook install`) y el test real
  (`test/postinstall.test.js`); no queda ninguna referencia a `framework/scripts/`,
  `framework/cli/test/` ni a `specloom sync --check --target all` en esa sección ni en la
  lista de cobertura de tests.
- **Linked acceptance criterion**: AC-11

## Phase 4 — Contención de rutas derivadas de configuración

### Task 4.1 — `resolveContainedPath` en `fs-safe` [x]
- **Files**: `src/util/fs-safe.js`, `test/fs-safe.test.js`
- **Success criterion**: `resolveContainedPath(root, candidate)` devuelve la ruta absoluta
  para una relativa contenida y **lanza** con un error que nombra la ruta rechazada para
  `..` que escapa, para una ruta absoluta a otro árbol y para un escape vía symlink
  (test negativo de SEC-003). El docstring del módulo queda reencuadrado: frontera de todo
  acceso derivado de configuración, no sólo de escrituras.
- **Linked acceptance criterion**: AC-12

### Task 4.2 — `contract-drift` resuelve por el helper [x]
- **Files**: `src/cli/repos.js`, `test/repos.test.js`
- **Success criterion**: con `contract.path_in_loom` relativo el comando se comporta igual
  que hoy; con una ruta que escapa del repo falla con error claro y `EXIT.USAGE` **sin
  intentar la lectura** (cubre EC-3); desaparece la concatenación `` `${cwd}/${path}` `` y
  el error de contrato ausente sigue reportando la ruta resuelta.
- **Linked acceptance criterion**: AC-12

### Task 4.3 — Borrar la promesa de la ruta absoluta [x]
- **Files**: `openspec/specs/cli/spec.md`
- **Success criterion**: la sección `## Contract drift` ya no afirma que un
  `path_in_loom` absoluto se use tal cual, y declara el comportamiento real: resolución
  relativa al root del consumer, contenida al repo, con error explícito si escapa.
- **Linked acceptance criterion**: AC-11

## Phase 5 — Higiene y la línea `Regression`

### Task 5.1 — Preservar `openspec/changes/` en git [x]
- **Files**: `openspec/changes/.gitkeep`
- **Success criterion**: el archivo existe, está trackeado por git, y `playbook doctor` no
  reporta `missing openspec/changes/` con el directorio sin changes activos.
- **Linked acceptance criterion**: AC-1

### Task 5.2 — `init` y `doctor --fix` escriben el `.gitkeep` [x]
- **Files**: `src/cli/init.js`, `src/cli/doctor.js`, `test/init.test.js`
- **Success criterion**: `playbook init` sobre un proyecto temporal crea
  `openspec/changes/.gitkeep`; correrlo de nuevo no lo sobrescribe (vía `writeIfMissing`);
  `doctor --fix` produce el mismo resultado por el mismo helper.
- **Linked acceptance criterion**: AC-2

### Task 5.3 — `packet` avisa cuando falta `Regression` [x]
- **Files**: `src/tokens/packet.js`, `test/tokens.test.js`
- **Success criterion**: con un `tasks.md` que declara `Format` y `Feature tests` pero no
  `Regression`, `buildPacket` devuelve un warning que nombra la entrada faltante y el
  contenido del packet no cambia respecto de hoy; el exit code de `playbook packet` y el
  resultado de `playbook validate` quedan intactos; con `tasks.md` sin ninguna entrada de
  comandos, el mensaje no se duplica (cubre EC-6); `COMMAND_LABEL_RE` y la extracción no
  se modifican.
- **Linked acceptance criterion**: AC-3

### Task 5.4 — Quitar el qualifier de `Regression` en `sdd-plan` [x]
- **Files**: `skills/sdd-plan/canonical.md`, `skills/sdd-plan/SKILL.md`,
  `test/skill-contract.test.js`
- **Success criterion**: la entrada de regresión de la plantilla queda declarada sin el
  qualifier `(if required by risk)`; `## Rules` exige esa entrada nombrando que es la que
  `playbook packet` extrae hacia los gates; el test de contenido falla si el qualifier
  vuelve o si la regla desaparece; `npm run generate:check` sin drift. Antes de cerrar la
  tarea, releer `## Preconditions`, `## Context` y `## Rules` del skill y confirmar que
  ninguna sección previa contradice la obligatoriedad (regla de alcanzabilidad de
  `playbooks/spec.md`).
- **Nota de redacción**: no escribir la etiqueta literal de la entrada en la prosa de esta
  tarea — el extractor de `packet` la matchea en cualquier línea del archivo y la
  convertiría en un comando falso. Encontrado en vivo al generar el packet de este mismo
  change.
- **Linked acceptance criterion**: AC-4

## Phase N — Quality gates

- **Format**: (sin formatter configurado todavía)
- **Lint/type-check**: `node --check <archivo.js>` (por archivo tocado)
- **Feature tests**: `node --test test/install.test.js test/doctor.test.js test/postinstall.test.js test/fs-safe.test.js test/repos.test.js test/tokens.test.js test/init.test.js test/sync.test.js test/skill-contract.test.js`
- **Regression**: `npm test` y `npm run generate:check`

Evidencia manual para el `runtime-gate-report.md` (el adapter `cli` está excluido, la
evidencia no es opcional): `playbook doctor` antes y después en este repo, mostrando que la
instalación en modo link pasa de invisible a reportada; y `playbook doctor` con un
`SKILL.md` instalado modificado a mano, mostrando el problema bloqueante que hoy no existe.

## Execution Report

Todas las tareas (1.1–5.4) fueron implementadas siguiendo TDD; el código y los tests
estaban presentes al iniciar este cierre, verificados a continuación.

**ACs verificados:**

| AC | Evidencia |
|----|-----------|
| AC-1 | `test/init.test.js`, `test/doctor.test.js` — `.gitkeep` trackeado, sin reporte de directorio faltante |
| AC-2 | `test/init.test.js` — `init` y `doctor --fix` escriben `.gitkeep` vía `writeIfMissing`, sin sobrescritura |
| AC-3 | `test/tokens.test.js` — `buildPacket` emite warning si falta `Regression`, sin duplicar (EC-6) |
| AC-4 | `test/skill-contract.test.js` — `sdd-plan` exige `Regression` sin qualifier |
| AC-5 | `test/install.test.js` — `.playbook-manifest.json` con digest sha256 por archivo, `mode: "copy"` |
| AC-6 | `test/doctor.test.js` — problema bloqueante ante contenido instalado alterado |
| AC-7 | `test/install.test.js` — `install --link` crea directorios reales + symlinks, sin escritura fuera del target (SEC-004) |
| AC-8 | `test/doctor.test.js` — nota de modo link con fuente, sin comparar digests; enlace colgado → problema (EC-1) |
| AC-9 | `test/sync.test.js` — `playbook.lock` solo contiene la versión, nunca modo/ruta/digests (SEC-002) |
| AC-10 | `test/postinstall.test.js` — script message-only, un solo lifecycle script, silencioso ante error (EC-4, SEC-001) |
| AC-11 | `openspec/specs/cli/spec.md` — secciones de postinstall y contract drift corregidas a la implementación real |
| AC-12 | `test/fs-safe.test.js`, `test/repos.test.js` — `resolveContainedPath` rechaza escapes (`..`, absoluta, symlink); `contract-drift` lo usa y falla con `EXIT.USAGE` sin leer (EC-3, SEC-003) |

**Comandos corridos** (vía `playbook run --change unfulfilled-promises-cleanup --step apply --`):

- `node --check` sobre cada archivo tocado en `src/` y `scripts/postinstall.cjs` → todos OK
- `node --test test/install.test.js test/doctor.test.js test/postinstall.test.js test/fs-safe.test.js test/repos.test.js test/tokens.test.js test/init.test.js test/sync.test.js test/skill-contract.test.js` → ✓ passed (214 líneas), log en `.specloom/runs/1784945504287-713a512d/full.log`
- `npm test` (Regression) → ✓ passed (413 líneas), log en `.specloom/runs/1784945511308-696279d8/full.log`
- `npm run generate:check` (Regression) → ✓ passed (6 líneas), log en `.specloom/runs/1784945516132-b9b7232a/full.log`

**Pendiente fuera de alcance de `sdd-apply`:** la evidencia manual de `playbook doctor`
antes/después (modo link y `SKILL.md` alterado) descrita arriba se recolecta en
`sdd-runtime-gate`, ya que requiere operar sobre instalaciones globales (`~/.claude/skills`)
fuera del alcance de este repo — no se ejecutó acá para no mutar el setup de dogfooding
en modo link activo.

**Resultado:** todos los gates de calidad en verde. Los 4 ADR drafts de decisiones
arquitectónicas (manifest content-based, modo link, `fs-safe` boundary, `Regression`
requerido) ya estaban creados como `status: proposed`, listos para `sdd-code-review` /
`sdd-archive`.

## Addendum — fix post-CI (Task 3.1)

El check `test (18)` de GitHub Actions (Node 18, PR #17) falló: `scripts/postinstall.js`
usaba `import` de nivel superior (ESM) sin depender del `package.json` del propio paquete
al ser copiado fuera de contexto (caso EC-4 del propio test). En Node 18 —sin detección de
sintaxis ESM sin `package.json`— eso revienta con `SyntaxError` **antes** de que el
`try/catch` del script pueda actuar, violando la garantía "sale 0, no imprime nada" de
AC-10/EC-4. El runner de Node 20 del mismo pipeline no lo detectó porque su patch tenía
detección de sintaxis habilitada.

**Fix**: el script se renombró a `scripts/postinstall.cjs` (CommonJS + `require`), que se
interpreta como CommonJS sin importar el `package.json` circundante — funciona igual
dentro del paquete (`type: module` en su `package.json`, ignorado por la extensión `.cjs`)
y copiado sin contexto. Se actualizaron `package.json` (`postinstall`), `test/postinstall.test.js`
(rutas y regex de la aserción SEC-001 a `require`) y las referencias de ruta en
`design.md`, `proposal.md`, `context-packet.md`, `security-report.md`, `runtime-gate-report.md`
y `openspec/specs/cli/spec.md` — mismo comportamiento, mismo AC/SEC cubiertos, solo el
nombre de archivo. Verificado localmente: `node --test test/postinstall.test.js` (4/4),
`npm test`, `npm run generate:check`, todos en verde.
