---
schema: design
schema_version: 1
change_id: remove-postinstall-lifecycle-script
status: approved
security:
  risk: standard
  threat_model_required: false
  controls: [SEC-001, SEC-002]
updated: 2026-07-27
---
# Technical design — Eliminar el postinstall que puede romper `npm install` de consumers

## Approach

Dos cambios independientes, ambos sin tocar el modelo de distribución
(ADR-002):

1. **Eliminar el lifecycle script.** `package.json` deja de declarar
   `scripts.postinstall`; se borra `scripts/postinstall.cjs`. Sin lifecycle
   script, no hay nada que npm pueda ejecutar automáticamente al instalar o
   actualizar — el riesgo de raíz (documentado en
   `adr-remove-postinstall-lifecycle-script.md`) desaparece por completo, no
   solo el síntoma puntual reproducido.

2. **Reemplazar la señal por dos canales fuera de npm:**
   - **README**: la sección `## Install (global, once)` gana, como primer
     paso, el comando real `npm install -g
     github:lablab-outplacement/lablab-playbook-ai-v2#semver:^X.Y.Z` (hoy
     ausente — la sección asume que el binario ya existe en el PATH), más una
     nota corta: el repo es privado y requiere acceso git (SSH key o PAT)
     configurado, porque sin eso el fallback automático de npm
     (`codeload` 404 → `git clone`) confunde al consumer nuevo.
   - **CLI**: `run()` en `src/cli/dispatch.js` — el único punto por el que
     pasa toda invocación de `playbook`/`sdd` antes de despachar al handler
     del comando — chequea si al menos un target de skills globales está
     instalado, y si no, imprime un aviso de una línea antes de correr el
     comando. La condición se reevalúa en cada invocación: no hace falta
     ningún marker file ni estado persistido nuevo, porque en cuanto el
     consumer corre `playbook install`, el stamp `.playbook-version` existe y
     la condición pasa a falsa por sí sola.

## Module impact

- `package.json` — quita `scripts.postinstall`.
- `scripts/postinstall.cjs` — se borra.
- `test/postinstall.test.js` — se reemplaza por un test estructural que
  falla si `scripts.postinstall` reaparece en `package.json` (fuerza a que
  cualquier reintroducción futura pase conscientemente por una ADR que
  supersedee a `adr-remove-postinstall-lifecycle-script.md`, en vez de
  colarse sin discusión).
- `src/install/targets.js` — gana una función pequeña y pura,
  `anyTargetInstalled(env, home)`, que resuelve los targets con
  `resolveTargets()` ya existente y chequea si `.playbook-version` existe en
  al menos uno. Vive acá (no en `doctor.js`) porque `dispatch.js` no debe
  importar de `doctor.js` — `doctor` es un comando más, no una capa de la que
  otros comandos dependan; `targets.js` ya es la capa compartida de
  resolución de targets que ambos usan.
- `src/cli/dispatch.js` — en `run()`, inmediatamente antes de `return
  handler(parsed, io)`: si `parsed.command !== 'install'`, `!parsed.flags.json`,
  y `!anyTargetInstalled()`, imprime un aviso de una línea vía `io.out` (versión
  + recordatorio de `playbook install`) y continúa al handler normalmente — el
  aviso nunca reemplaza ni bloquea la ejecución del comando pedido.
- `README.md` (`## Install (global, once)`) — agrega el comando de
  adquisición + nota de acceso privado.
- `docs/security-checklist.md` — la fila de `postinstall` se actualiza para
  reflejar que el script ya no existe.

## Trade-offs

Evaluado y descartado en la ADR de este change: un wrapper de shell
(`node scripts/postinstall.cjs || exit 0`) que cierra el síntoma reproducido
sin eliminar el script. Se prefiere eliminar el lifecycle script por completo
porque la causa de fondo (un bug de npm en su manejo de dependencias git,
fuera de nuestro control) puede manifestarse de formas no anticipadas que un
`exit 0` incondicional no necesariamente cubre — eliminar el script cierra
toda la clase de riesgo, no un síntoma puntual.

Alternativa de ubicación para `anyTargetInstalled`: podría vivir en
`doctor.js` y ser exportada desde ahí. Se descarta porque `dispatch.js` no
importa comandos entre sí — cada comando es una hoja, no una dependencia de
otro. `targets.js` ya es la capa de la que `doctor.js` importa
`resolveTargets`; agregar la función ahí mantiene esa misma dirección de
dependencia (`dispatch.js` y `doctor.js` importan de `targets.js`, nunca uno
del otro).

## Public contracts / interfaces

Skip declarado: `impact.public_contract: false` en `proposal.md` — este
change no toca ningún endpoint HTTP ni contrato público. No aplica autoría de
contrato canónico (ninguna de las tres condiciones del paso 2 de `sdd-design`
es siquiera evaluable sin `public_contract: true`).

## Data model changes

Ninguno. No hay schema de artefacto ni modelo de datos persistido nuevo — el
aviso del CLI se decide en cada invocación a partir de un dato que ya existe
(`.playbook-version` en los directorios de targets), sin escribir ningún
estado nuevo.

## Security controls (+ threat model when required)

`risk: standard`, `threat_model_required: false` — el change reduce
superficie (SEC-001) y el dato que lee el nuevo control (SEC-002) es
puramente local y ya expuesto por `doctor` hoy; no hay vector nuevo que
amerite modelo de amenazas.

- **SEC-001**: Eliminar el `postinstall` remueve el único lifecycle script
  del paquete — no queda código que npm pueda ejecutar automáticamente en la
  máquina o CI de un consumer al instalar o actualizar. Verificado por el
  test estructural de `test/postinstall.test.js` (AC-3).
- **SEC-002**: El aviso de `dispatch.js` (`anyTargetInstalled`) solo
  chequea existencia de un archivo (`.playbook-version`) bajo los
  directorios de targets ya resueltos por `resolveTargets()` — el mismo dato
  que `doctor` ya expone. No lee el repo del consumer, no hace red, no
  escribe ningún archivo. Se omite explícitamente en modo `--json` para no
  contaminar salida machine-readable con una línea de texto libre.

## Testing strategy

- **Estructural** (`test/postinstall.test.js`, reescrito): asegura que
  `package.json` no declara `scripts.postinstall`; falla si reaparece —
  fuerza que una reintroducción futura pase por una ADR nueva.
- **Unitario** (`src/install/targets.js`): `anyTargetInstalled` con ambos
  targets ausentes → `false`; con al menos un `.playbook-version` presente →
  `true`; usa `env`/`home` inyectables (mismo patrón que `resolveTargets`) —
  sin tocar el home real en tests.
- **Dispatch** (`src/cli/dispatch.js`): `run()` con ambos targets ausentes y
  comando `status` (por ejemplo) → el aviso aparece en `io.out` antes de la
  salida del comando; con comando `install` → no aparece aunque los targets
  estén ausentes; con `--json` → no aparece; con al menos un target presente
  → no aparece.
- **Contenido** (`README.md`): test que confirma la presencia del comando
  `npm install -g github:.../lablab-playbook-ai-v2#semver:` y de una mención
  de acceso privado/SSH/PAT en la sección de instalación.
- **Regresión**: `npm test && npm run generate:check` completo, sin drift.
