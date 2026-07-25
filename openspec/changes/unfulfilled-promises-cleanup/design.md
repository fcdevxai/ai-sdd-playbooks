---
schema: design
schema_version: 1
change_id: unfulfilled-promises-cleanup
status: approved
owner: Bernardo Machuca
created: '2026-07-24'
updated: '2026-07-24'
security:
  risk: standard
  threat_model_required: false
  controls: [SEC-001, SEC-002, SEC-003, SEC-004]
---

# Technical design — Cerrar las promesas incumplidas del CLI, la distribución y las specs

## Approach

Ocho correcciones, cuatro subsistemas, un criterio: cada una hace verdadera una
afirmación que hoy es falsa. El diseño las agrupa por el mecanismo que introducen, no
por el archivo que tocan, porque tres de ellas comparten un artefacto nuevo (el manifest)
y dos comparten un helper nuevo (la resolución contenida).

**1. Verificación de la instalación por contenido (AC-5, AC-6, AC-7, AC-8, AC-9).**
`installSkills` gana un artefacto hermano del stamp de versión:
`<target>/.playbook-manifest.json`. El stamp conserva su única responsabilidad actual
—gatear el rango de compatibilidad vía `satisfies()`— y el manifest responde la pregunta
que hoy nadie hace: *¿el contenido instalado es el que esa versión declara?*

Formato, con `schema_version` propio para que un cambio futuro de formato sea detectable
en vez de sorpresivo:

```json
{
  "schema_version": 1,
  "version": "0.1.0",
  "mode": "copy",
  "skills": {
    "sdd-apply": { "SKILL.md": { "sha256": "<hex>" } }
  }
}
```

En modo link la entrada por archivo cambia de forma, porque un digest ahí no significa
nada (siempre coincidiría con la fuente por definición):

```json
{
  "schema_version": 1,
  "version": "0.1.0",
  "mode": "link",
  "source": "/ruta/absoluta/al/repo",
  "skills": {
    "sdd-apply": { "SKILL.md": { "link": "/ruta/absoluta/al/repo/skills/sdd-apply/SKILL.md" } }
  }
}
```

`doctor` deriva su chequeo de la forma de cada entrada, no de una bandera global: entrada
con `sha256` → compara el digest del archivo instalado; entrada con `link` → verifica que
el symlink exista y resuelva al destino registrado. Eso le da al modo link una
verificación **real** (el enlace no está colgado) en vez de una exención, que es más
fuerte que lo que el ADR prometía como mínimo.

Canales de `doctor`, respetando los cuatro que ya existen (`problems` afectan `healthy` y
el exit code; `warnings` y `notes` no):

| Situación | Canal | Por qué |
|---|---|---|
| Digest distinto del registrado | `problems` | La instalación no es lo que dice ser: el agente está leyendo otro prompt |
| Enlace colgado en modo link | `problems` | Instalación rota, mismo peso que un skill core ausente |
| Manifest ausente | `notes` | Instalación previa a este change: desconocida, no enferma |
| Manifest ilegible, o `schema_version` desconocida | `notes` | Se degrada a "no verificable", nunca a crash ni a falso positivo |
| Modo link activo | `notes` | Dato de contexto: nombra la fuente enlazada |

La función que lo calcula es pura y read-only sobre el target dir, en el molde de
`specIndexAdvisory`/`workflowStaleness`, y se compone dentro de
`installedTargetDiagnostics` para que el `--json` de `doctor` la exponga sin cambiar la
forma de la salida.

**2. Modo link (AC-7, AC-8).** `installSkills` toma `mode: 'copy' | 'link'`, con `copy`
por default. En `link`, el directorio del skill se crea real y cada archivo instalable se
enlaza a su ruta absoluta en el `sourceRoot`. El enlace es por **archivo**, no por
directorio: el descubrimiento del harness sigue viendo un directorio real, y el contrato
"sólo viajan los archivos instalables" (`INSTALLABLE_FILES`) se mantiene sin que
`canonical.md` aparezca en el target. `--link` se parsea en `parseInstallArgs` junto a las
flags actuales y no altera ninguna otra rama del comando.

**3. Señal de post-update (AC-10, AC-11).** `scripts/postinstall.cjs`, autocontenido: no
importa nada de `src/` —una regresión en un módulo del CLI no puede romper el `npm
install` de un consumer—, resuelve su propio `package.json` relativo a su ubicación,
imprime tres líneas y envuelve todo en un `try/catch` que no re-lanza. El comando que
recomienda es `playbook install`, no `playbook sync`: acá `sync` reconcilia
`methodology.resolved` en el lock y no toca las skills instaladas, así que portar el
texto original habría mandado al consumer a correr el comando equivocado.

**4. Resolución contenida (AC-12).** `fs-safe` gana `resolveContainedPath(root, candidate)`
y su docstring se reencuadra: el módulo pasa a ser la frontera de todo acceso a
filesystem **derivado de configuración**, no sólo de las escrituras destructivas. La regla
es el origen de la ruta, no la operación. `contract-drift` es el primer llamador y
reemplaza su concatenación (`` `${cwd}/${canonicalPath}` ``) por el helper.

**5. Higiene (AC-1, AC-2).** `openspec/changes/.gitkeep` commiteado, y `init` (y
`doctor --fix`, que comparte el helper) lo escribe con `writeIfMissing` — nunca sobrescribe.

**6. La línea `Regression` (AC-3, AC-4).** Acá el diseño cambió al leer el código: la
instrucción **no falta**. `skills/sdd-plan/canonical.md:66` ya dice
`- **Regression**: \`<command>\` (if required by risk)`. El qualifier es el defecto: hace
la línea opcional a criterio del agente, y cuando se omite el packet pierde el comando en
silencio. Es el punto ciego de `playbooks/spec.md` en una variante nueva — el texto está
presente y **se anula a sí mismo en la misma línea**, sin que ninguna otra sección tenga
que contradecirlo.

Verificación de alcanzabilidad hecha, no asumida: `## Preconditions`, `## Context` y
`## Rules` de `sdd-plan` no contienen nada que contradiga una línea `Regression`
obligatoria. La única contradicción es el qualifier inline.

Fix: quitar `(if required by risk)`, y agregar a `## Rules` que la entrada `Regression` es
obligatoria porque es la que `playbook packet` extrae hacia los gates. Del lado del CLI,
`packet` gana un `REGRESSION_LABEL_RE` y avisa cuando no matchea, **sin tocar**
`COMMAND_LABEL_RE` ni la extracción: cero cambio de comportamiento en los packets
existentes, sólo un warning nuevo.

## Module impact

| Módulo | Delta | AC |
|---|---|---|
| `src/install/manifest.js` (nuevo) | `buildManifest`/`writeManifest`/`readManifest`/`verifyManifest`: puras, sin `process.exit`, digests con `node:crypto` | AC-5, AC-6 |
| `src/install/skills.js` | `installSkills({..., mode})`; `linkSkillArtifacts`; escribe el manifest junto al stamp | AC-5, AC-7 |
| `src/cli/install.js` | `--link` en `parseInstallArgs`; el modo viaja al summary y al `--json` | AC-7 |
| `src/cli/doctor.js` | `installedContentDiagnostics(targetDir)` compuesta en `installedTargetDiagnostics`; ruteo a `problems`/`notes` | AC-6, AC-8 |
| `src/cli/init.js` | el plan de `openspec/changes` también escribe `.gitkeep` | AC-2 |
| `src/tokens/packet.js` | `REGRESSION_LABEL_RE` + warning; extracción intacta | AC-3 |
| `src/util/fs-safe.js` | `resolveContainedPath`; docstring reencuadrado a lecturas derivadas de config | AC-12 |
| `src/cli/repos.js` | `contractDriftCommand` resuelve por el helper; error claro y `EXIT.USAGE` cuando escapa | AC-12 |
| `package.json` | un único lifecycle script `postinstall`; `scripts/postinstall.cjs` en `files:` | AC-10 |
| `scripts/postinstall.cjs` (nuevo) | message-only, autocontenido | AC-10 |
| `skills/sdd-plan/canonical.md` + `SKILL.md` | `Regression` sin qualifier + regla explícita; regenerado | AC-4 |
| `openspec/specs/cli/spec.md` | corrige el postinstall y borra la promesa de ruta absoluta | AC-11 |
| `openspec/changes/.gitkeep` (nuevo) | preserva el directorio en git | AC-1 |

Capas respetadas: la lógica nueva es pura y vive en `src/install/` y `src/util/`; `src/cli/`
sólo parsea, compone y formatea. Ningún módulo llama `process.exit`.

**Reparto de las specs permanentes.** Este change corrige en `cli/spec.md` únicamente lo
que vuelve falso —la sección del postinstall y la línea de la ruta absoluta— porque esa
falsedad *es* el defecto (AC-11). La documentación de lo que el change **agrega**
(manifest, modo link, convención `Regression`) la integra `sdd-archive` en el flujo normal,
con este checklist: sección nueva de verificación de contenido instalado en `cli/spec.md`,
el warning en la sección de generación del packet, y la convención de `tasks.md` en
`playbooks/spec.md`.

## Trade-offs

- **Manifest separado vs. stamp extendido.** Separado, aunque cueste un archivo más.
  Extender el stamp lo propagaría a `playbook.lock.methodology.resolved`, que está
  commiteado, y `satisfies()` toleraría el sufijo por accidente: contaminación silenciosa
  de un archivo que el consumer hereda.
- **Mismatch bloqueante vs. advisory.** Bloqueante. Verificado que ningún CI corre
  `doctor` —el del repo y el template del consumer sólo corren `validate --ci`—, así que
  no hay riesgo de romper pipelines, y una instalación que no es lo que dice ser no es
  "un aviso": es la falla que costó un día.
- **Manifest ausente como nota vs. problema.** Nota. Tratarla como problema pondría en
  rojo a todo consumer que actualice el CLI sin reinstalar skills, castigándolo por un
  artefacto que su instalación previa no podía conocer.
- **Enlace por archivo vs. por directorio.** Por archivo, aunque sean N symlinks en vez
  de uno: el directorio real no depende de que el descubrimiento del harness siga
  symlinks de directorio (propiedad que ningún contrato público garantiza) y mantiene
  `canonical.md` fuera del target.
- **Quitar el qualifier vs. ampliar las etiquetas que `packet` extrae.** Quitar el
  qualifier. Aceptar `Regresión` multiplicaría el vocabulario a machear y es una decisión
  sobre el formato de `tasks.md` que merece su propia discusión; el warning nuevo hace
  visible ese caso sin cambiar el contrato.
- **`resolveContainedPath` en `fs-safe` vs. en el call site.** En `fs-safe`, aunque
  amplíe el alcance de un módulo cuyo nombre hoy sugiere sólo escrituras. En el call site
  arregla el bug y deja la decisión sin domicilio, que es exactamente cómo se llegó a que
  `packet` valide su entrada y `contract-drift` no.
- **Costo aceptado del change ancho.** Ocho ítems en una pasada vuelven más superficial
  la revisión que ocho pasadas. Se mitiga con un AC y un test por ítem, y con módulos
  disjuntos: ninguno puede pasar por arrastre de otro.

## Public contracts / interfaces

**No se autora contrato canónico.** La proposal declara `impact.public_contract: false` y
el proyecto tiene `capabilities.http: false`: no hay superficie HTTP ni endpoints que
describir, así que el paso de authoring de `openapi.yaml` se omite deliberadamente. La
razón del `false` pese a que el change agrega una flag está registrada en
`## Open technical decisions` de la proposal.

La superficie pública que sí cambia es la del CLI, y es aditiva:

- `playbook install [--link]` — flag nueva, opt-in. Sin ella, salida y efecto idénticos a
  hoy.
- `playbook install` — escribe además `<target>/.playbook-manifest.json`.
- `playbook doctor` — `problems`/`notes` nuevos; la forma del `--json` no cambia (los
  mensajes viajan por los arrays que ya existen).
- `playbook packet` — un warning más en el array `warnings` que ya devuelve; exit code
  intacto.
- `playbook contract-drift` — error nuevo para una ruta que escapa del repo; el camino
  relativo se comporta igual.
- `npm install` de un consumer — imprime tres líneas nuevas.

## Data model changes

Ninguno en los artefactos por change (`schemas/*.schema.json` sin cambios). El artefacto
nuevo vive **fuera** del repo del consumer, en los directorios de instalación global:
`<target>/.playbook-manifest.json`, con `schema_version: 1` propio. `.playbook-version`
mantiene su formato exacto (una línea con la versión) para no alterar lo que `sync` lee y
`satisfies()` compara.

En el repo se agrega un único archivo vacío versionado: `openspec/changes/.gitkeep`.

## Security controls (+ threat model when required)

Riesgo **standard**, arrastrado de la proposal sin cambios; `threat_model_required: false`.
El diseño no descubrió exposición nueva que justifique subirlo: nada acá toca
autenticación, autorización, datos personales, secretos ni límites de tenant, y el
control central del ítem de mayor superficie (el lifecycle script) es una política de
contenido, no un mecanismo de permisos. Se deja constancia de que el gate de seguridad
puede subirlo y nunca bajarlo.

- **SEC-001** (proposal SEC-1) — *Superficie de supply-chain del `postinstall`.* Código de
  este paquete corriendo automáticamente en cada máquina y CI de cada consumer. Controles:
  script autocontenido sin imports de `src/`; sin escrituras; sin lecturas del repo del
  consumer; sin red; `try/catch` global con exit 0 incondicional; `prepare`/`preinstall`
  ausentes. Asegurado por test estructural, no por revisión visual. Limitación aceptada:
  con `--ignore-scripts` no hay señal, y el flujo manual documentado es la fuente de verdad.
- **SEC-002** (proposal SEC-2) — *Fuga del path local vía el lock.* El manifest guarda
  digests y, en modo link, una ruta absoluta de la máquina. Control: el manifest es un
  archivo separado y `.playbook-version` conserva su formato de una línea, de modo que
  `sync` no tiene por dónde propagarlo a `playbook.lock`, que está commiteado. Fijado por
  un test que corre `install --link` y verifica que `sync` sigue escribiendo sólo la
  versión.
- **SEC-003** (proposal SEC-3) — *Contención de la ruta del contrato.* Control real y
  nuevo: `resolveContainedPath` rechaza `..`, rutas absolutas a otro árbol y escapes por
  symlink, y `contract-drift` falla con error claro sin intentar la lectura. Cierra la
  exigencia que `docs/security-checklist.md` ya declaraba para esa superficie y que ningún
  código verificaba. Aplica a las dos direcciones, porque desde el authoring del contrato
  esa misma ruta además se escribe.
- **SEC-004** (proposal SEC-4) — *Escritura de symlinks en el home.* `install --link`
  escribe únicamente dentro del target resuelto por `resolveTargets`, un enlace por
  archivo instalable, y no sigue ni reescribe rutas fuera de él. Sobrescribir copias
  existentes en el target es el permiso que `install` ya ejerce hoy con `copyFileSync`:
  este change no lo amplía. Test: el modo link no escribe fuera del target.

Riesgo residual aceptado, para que el gate no lo redescubra: un manifest editado a mano
puede reportar drift falso. El remedio sugerido (`playbook install`) reescribe manifest y
contenido juntos, así que el estado inconsistente no es pegajoso.

## Testing strategy

Un test por AC, y por ADR-032 **cada uno debe fallar contra el código previo** — el
adapter `cli` sigue excluido (`runtime_relevant_capabilities: []`), así que los unitarios
cargan la corrección y el `runtime-gate-report.md` debe registrar la invocación real antes
y después. Sin dependencias nuevas: `node --test` y `node:crypto`.

| Archivo | Cubre |
|---|---|
| `test/install.test.js` (extiende) | manifest en modo copy con digests (AC-5); `--link` crea directorio real + symlink al origen y manifest `mode: link` (AC-7); sin la flag el resultado es idéntico al actual (AC-7); el modo link no escribe fuera del target (SEC-004) |
| `test/doctor.test.js` (extiende) | digest alterado → problema bloqueante que nombra el skill (AC-6); manifest ausente → nota, `healthy` intacto (AC-6); manifest ilegible o `schema_version` desconocida → nota, sin crash (EC-2); modo link reportado y enlace colgado → problema (AC-8, EC-1) |
| `test/sync.test.js` (extiende) | tras `install --link`, `sync` sigue escribiendo sólo la versión en `methodology.resolved` (AC-9, SEC-002) |
| `test/init.test.js` (extiende) | `init` crea `openspec/changes/.gitkeep` y no lo sobrescribe si existe (AC-2) |
| `test/tokens.test.js` (extiende) | warning cuando falta `Regression` habiendo otros comandos (AC-3); exit code y `validate` intactos (AC-3); sin comandos, no se duplica el mensaje (EC-6) |
| `test/fs-safe.test.js` (extiende) | `resolveContainedPath`: relativa válida, `..` que escapa, absoluta a otro árbol, escape por symlink (AC-12, SEC-003) |
| `test/repos.test.js` (extiende) | `contract-drift` rechaza la ruta que escapa con error claro (AC-12, EC-3); la ruta relativa configurada sigue funcionando |
| `test/postinstall.test.js` (nuevo) | `package.json` declara exactamente un lifecycle script y es `postinstall`, con `prepare`/`preinstall` ausentes, y el script está en `files:` (AC-10); ejecutarlo sale 0, imprime ≤3 líneas y nombra `playbook install` (AC-10); sin imports de `src/` ni llamadas de escritura/red (SEC-001); copiado a un directorio sin `package.json` resoluble, sale 0 y no imprime nada (EC-4) |
| `test/skill-contract.test.js` (extiende) | `sdd-plan` declara `Regression` **sin** el qualifier `if required by risk` y su `## Rules` la exige (AC-4) |

Verificación manual que ningún test cubre y va al `runtime-gate-report.md`: `playbook
doctor` en este mismo repo antes y después, mostrando que la instalación en modo link
—hoy invisible— pasa a estar reportada; y `playbook doctor` con un `SKILL.md` instalado
modificado a mano, mostrando el problema bloqueante que hoy no existe.

`npm test` completo (357 tests hoy) y `npm run generate:check` sin drift son puerta de
salida, no evidencia opcional. AC-1 se verifica sobre un checkout limpio de la rama base
después del merge, porque su condición es que el directorio sobreviva en git.
