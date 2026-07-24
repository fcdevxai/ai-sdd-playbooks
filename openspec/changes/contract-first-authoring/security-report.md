---
schema: security-report
schema_version: 1
change_id: contract-first-authoring
status: passed
risk: standard
threat_model_required: false
updated: 2026-07-24
---
# Security Report — Authoring del contrato canónico en `sdd-design`

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: **Revisión completa, superficie angosta.** El change no toca
autenticación, autorización, roles, datos de usuario/tenant, input externo,
dependencias nuevas ni integraciones — no hay código de runtime: cero cambios en
`src/`. Deliberadamente **no** se marca `not_applicable`, porque sí existe una
superficie real que revisar: la instrucción nueva autoriza al agente a **crear y
escribir** un archivo en una ruta que sale de `playbook.config.yaml`. Eso se
revisó a fondo y produjo un hallazgo remediado dentro de este gate (Finding
SEC-F1).

Contexto leído: `context-packet.md` (verificado coherente con las fuentes vivas),
`design.md` (`controls: [SEC-001, SEC-002]`), `openspec/specs/system.md`,
`docs/security-checklist.md`, y `playbook changed-files --diff`. Se ejerció el
derecho a full-read sobre la superficie sensible: `src/cli/repos.js`,
`src/repos/contract-drift.js` y `src/util/fs-safe.js`.

## Checklist

- [n-a] **Authorization and access control** — no hay endpoint, acción ni control de acceso en el change. `playbook-ai` no tiene superficie HTTP (`capabilities.http: false`) y no se agregó ninguna.
- [n-a] **Ownership boundaries (IDOR)** — no hay referencias a objetos, IDs ni scoping por usuario/tenant. El proyecto no tiene base de datos ni modelo multi-tenant.
- [pass] **Input handling** — la única entrada que la instrucción nueva consume es `contract.path_in_loom`, una clave del `playbook.config.yaml` commiteado del propio proyecto (no input de runtime, no argumento de comando, no dato remoto). Se agregó una restricción de contención explícita — ver SEC-F1. Nada llega a un shell, `eval` ni template.
- [pass] **Data exposure** — no hay respuestas, logs ni errores nuevos. Al contrario: el change *reduce* exposición potencial al prohibir normativamente secretos/tokens/PII en un artefacto que se comparte con el historial de git de todos los repos consumidores (SEC-001).
- [pass] **Secrets and credentials** — nada hardcodeado ni commiteado. Verificado con la mitad **negativa** del test de SEC-001: el propio texto del skill no contiene literales con forma de `Bearer <token>`, `api_key=…` ni bloque `PRIVATE KEY`. Sin valores de config nuevos.
- [n-a] **Dependencies and integrations** — cero dependencias nuevas (`package.json` sin tocar), cero integraciones nuevas.

## Risk rationale

`reconciled = max(declared: standard, detected: standard) = **standard**`. **No se
sube.** El único hallazgo (SEC-F1) quedó remediado dentro de este gate, y la
exposición preexistente que salió a la luz (Observación 1) no la introduce este
change. `threat_model_required: false` se sostiene: no hay actor, activo ni
superficie de ataque nueva más allá de una escritura en el árbol del propio
proyecto. Tampoco se baja el riesgo — este gate nunca baja un riesgo aprobado.

No se afirma que el change sea "seguro"; se afirma que **los dos controles
declarados tienen evidencia**, y que la escritura nueva quedó acotada.

## Control checklist (control → evidencia)

| Control | Declarado en | Evidencia | Estado |
|---|---|---|---|
| **SEC-001** — sin secretos/tokens/PII en el contrato canónico | proposal SEC-1, design `controls` | Prohibición normativa *dentro* de la instrucción (`skills/sdd-design/SKILL.md`, paso 2), no sólo en el proposal. Test `sdd-design forbids secrets and PII in the canonical contract (SEC-001, AC-4)`: mitad **negativa primero** (sin literales de credencial en el propio texto) + mitad positiva (la prohibición nombra `example`/`description`/`servers`). | ✅ con evidencia |
| **SEC-002** — superficie del change: cero cambios en `src/` | proposal SEC-2, design `controls` | `git diff --stat`: `README.md`, `skills/sdd-design/{canonical,SKILL}.md`, `test/skill-contract.test.js`. `src/repos/contract-drift.js` sin tocar — sigue read-only y CI-only. | ✅ con evidencia |
| **SEC-F1** (nuevo, agregado por este gate) — la ruta de escritura queda contenida al repo | este reporte | Instrucción: "The resolved path must stay **inside the repo** — if it escapes the project root, stop and report it instead of writing". Asertado en el test de AC-2 (`must stay **inside the repo**`). | ✅ con evidencia |

## Threat model (when required)

No requerido (`risk: standard`, `threat_model_required: false`). Se deja anotado
el límite de confianza que quedó explícito al revisar SEC-F1: la instrucción
confía en `playbook.config.yaml` **commiteado en el proyecto**. Quien puede
editar ese archivo ya controla el repo donde el agente trabaja, así que no es un
canal de escalada nuevo. La contención agregada cubre el caso realista que sí
importa en una herramienta agéntica: correr las skills dentro de un repo que no
escribiste vos.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| SEC-F1 | low | no | `skills/sdd-design/canonical.md` (paso 2 de `## Behavior`) | **Remediado en este gate.** La instrucción autorizaba crear/escribir un archivo en la ruta de `contract.path_in_loom` sin decir nada sobre contención, mientras el `design.md` afirmaba que "no introduce un vector de path traversal" — afirmación cierta sólo por el límite de confianza, no por ningún chequeo. Se agregó la restricción de que la ruta resuelta debe quedar dentro del repo, y si se escapa el paso se detiene y lo reporta. Regenerado (`npm run generate`), asertado en el test de AC-2, `npm test` = 345 pass / 0 fail, `generate:check` sin drift. |

**Por qué `low` y no blocking:** el vector requiere un `playbook.config.yaml`
hostil, y quien lo controla ya controla el repo. No hay input de runtime ni
remoto involucrado. Ninguna de las reglas de blocking del gate aplica (no hay
autorización ausente, ni acceso cross-tenant, ni input sin sanitizar llegando a
una query/comando/template, ni dato sensible expuesto, ni secreto commiteado).

## Observaciones fuera de scope (para el archive / plan maestro)

1. **Exposición de lectura preexistente en `contractDriftCommand`.**
   `src/cli/repos.js:152` resuelve `` `${cwd}/${canonicalPath}` `` y lo pasa a
   `checkContractDrift` → `loadSpec` → `fs.readFileSync` **sin chequeo de
   contención**: un `path_in_loom: ../../../algo` se lee hoy mismo. Severidad
   baja por el mismo límite de confianza de SEC-F1, y **no la introduce este
   change** (`src/` es no-goal explícito del proposal), así que no bloquea. Vale
   como candidato a un ciclo futuro: `src/util/fs-safe.js` ya existe y centraliza
   escrituras, pero **nadie lo usa para lecturas** y sólo lo importan
   `src/cli/init.js` y `src/cli/doctor.js` — `contract-drift` no pasa por ahí.
2. **`docs/security-checklist.md` sigue siendo el template sin llenar** (las tres
   tablas están en `TODO` con ejemplos entre corchetes). Para este change no
   cambia nada —no hay superficie sensible que registrar— pero significa que el
   gate no tiene superficies conocidas del proyecto contra las que cruzar, y
   redescubre desde cero cada vez. Es exactamente lo que ese archivo dice que hay
   que evitar. No es de este change.
