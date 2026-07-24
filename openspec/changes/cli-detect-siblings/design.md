---
schema: design
schema_version: 1
change_id: cli-detect-siblings
status: approved
security:
  risk: standard
  threat_model_required: false
  controls: [SEC-001]
updated: 2026-07-24
---
# Technical design — Comando CLI `playbook detect-siblings`

## Approach

Agregar `playbook detect-siblings` como un **wrapper fino y read-only** sobre
`detectSiblingRepos({ cwd })` (`src/config/detect-siblings.js`), siguiendo
exactamente el patrón de los comandos read-only existentes en `src/cli/repos.js`
(`repo-plan`, `commit-plan`, `changed-files`): resolver `cwd` de `parsed.flags`,
llamar a la función de dominio, imprimir JSON con `--json` o texto legible por
default, devolver un `EXIT` code. No se agrega lógica de detección nueva — la
heurística ya existe y está testeada (`test/detect-siblings.test.js`).

El handler vive en `src/cli/repos.js` (no un módulo nuevo) porque
`detectSiblingRepos` es sobre topología de repos, el mismo dominio que los otros
comandos de ese archivo. Registro en `src/cli/dispatch.js`.

## Module impact

- **`src/cli/repos.js`** — nuevo export `detectSiblingsCommand(parsed, io)`:
  - `const cwd = parsed.flags.cwd || process.cwd();`
  - `const result = detectSiblingRepos({ cwd });`
  - `if (parsed.flags.json) io.out(JSON.stringify(result, null, 2));` else texto.
  - `return EXIT.OK;` (envuelto en try/catch → `EXIT.VIOLATION` en error, igual
    que `repoPlanCommand`).
  - import nuevo: `import { detectSiblingRepos } from '../config/detect-siblings.js';`
- **`src/cli/dispatch.js`** — 4 puntos de registro:
  1. agregar `detectSiblingsCommand` al import de `./repos.js` (líneas 27-29).
  2. agregar `'detect-siblings'` a `COMMAND_NAMES` (junto a la familia de repos,
     tras `changed-files`).
  3. agregar su línea en `COMMAND_SUMMARIES`.
  4. agregar `'detect-siblings': detectSiblingsCommand` a `HANDLERS`.
- **`skills/sdd-bootstrap-project/canonical.md`** — paso 3: reemplazar la
  instrucción de "correr `detectSiblingRepos` en `src/config/detect-siblings.js`"
  por "correr `playbook detect-siblings` (`--json` para consumo programático)".
  `detectSiblingRepos` puede quedar mencionado como **contexto explicativo** (la
  heurística que el comando aplica), nunca como la cosa a ejecutar. Se conserva
  la instrucción de re-run de ADR-028.
- **`skills/sdd-bootstrap-project/SKILL.md`** — regenerado (`npm run generate`).
- **`test/`** — test del comando + aserción en `test/skill-contract.test.js`.

## Trade-offs

- **Handler en `repos.js` vs módulo nuevo**: se elige `repos.js` — mismo dominio
  (topología de repos), evita un archivo de una función, y hereda el patrón
  `io`/`EXIT`/`--json` ya probado. Costo: `repos.js` crece un handler más.
- **`detect-siblings.js` intacto**: el comando no reimplementa ni ajusta la
  heurística; si en el futuro cambia, el comando la hereda sin tocar nada.
- **Ubicación en `COMMAND_NAMES`**: junto a los comandos de repos (no al final)
  para agrupar por dominio en el `--help`; decisión cosmética, sin efecto funcional.

## Public contracts / interfaces

Nuevo comando en la superficie pública del CLI:

```
playbook detect-siblings [--cwd <path>] [--json]
```

- **`--json`**: imprime `JSON.stringify(result, null, 2)`, donde `result` es el
  retorno literal de `detectSiblingRepos`:
  ```
  { ownName: string,
    parentDir: string,
    candidates: [ { name, path, capabilities, signals, summary,
                    sharedTokensWithOwn, cluster } ] }
  ```
- **default (texto)**: encabezado + una línea por candidato, estilo `repo-plan`:
  ```
  Sibling repos for <ownName> (parent: <parentDir>):
    <name> [<summary>] shared=<sharedTokensWithOwn.join(',') || '-'> cluster=<cluster.length>
  ```
  Con `candidates` vacío: una línea "No git-repo siblings found in <parentDir>."
- **Exit codes**: `EXIT.OK` (0) en éxito, incluido el caso de lista vacía;
  `EXIT.VIOLATION` solo si `detectSiblingRepos` lanza (I/O inesperado).
- **Read-only**: el comando nunca escribe archivos. No consume stdin.

Este contrato es **aditivo**: no cambia ningún comando existente.

## Data model changes

Ninguna. No hay persistencia; el comando solo lee el directorio padre (nombres
de subdirectorio y presencia de `.git/`) vía la función ya existente.

## Security controls (+ threat model when required)

`risk: standard`, `threat_model_required: false` (no hay superficie sensible que
amerite modelo de amenazas).

- **SEC-001** (cubre el SEC-1 del proposal): el comando es **read-only** y su
  superficie de lectura es idéntica a la que `detectSiblingRepos` ya tenía —
  nombres de subdirectorio del padre y existencia de `.git/`. No lee contenido de
  archivos, no toca secretos/credenciales/PII, no escribe nada, no hace llamadas
  de red ni ejecuta comandos. La ruta de escritura de `sdd-bootstrap-project`
  (`playbook.config.yaml`, con aprobación humana) no cambia. **No hay test
  negativo de seguridad aplicable** porque no se agrega superficie sensible;
  la evidencia es que el comando no tiene rama de escritura (revisable en código).

## Testing strategy

- **Test del comando** (nuevo archivo o dentro de `test/repos.test.js`), con `io`
  inyectado y `--cwd` a un directorio temporal:
  - happy path texto: con siblings git en el padre → una línea por candidato.
  - `--json`: parsea la salida y valida la forma `{ ownName, parentDir, candidates }`.
  - edge: padre sin siblings git → `candidates` vacío, `EXIT.OK`, línea "No ... found".
- **`test/skill-contract.test.js`**: aserción de contenido — el `SKILL.md` de
  `sdd-bootstrap-project` referencia `playbook detect-siblings` (AC-7); protege
  contra que un merge futuro desconecte el wiring (EC-1).
- **`npm run generate:check`**: sin drift canonical.md ↔ SKILL.md (AC-6).
- **`npm test`**: suite completa verde (regresión).
