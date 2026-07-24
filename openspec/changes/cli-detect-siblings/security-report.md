---
schema: security-report
schema_version: 1
change_id: cli-detect-siblings
status: not_applicable
risk: standard
threat_model_required: false
updated: 2026-07-24
---
# Security Report — Comando CLI `playbook detect-siblings`

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: not_applicable — per SEC-1 (proposal) / SEC-001 (design).
Este change agrega `detectSiblingsCommand` (`src/cli/repos.js`) — un wrapper
read-only sobre `detectSiblingRepos` (sin modificar), registrado en
`src/cli/dispatch.js`, y una edición de instrucción de skill
(`skills/sdd-bootstrap-project/canonical.md`).

Ninguno de los triggers de aplicabilidad aplica:
- **Auth/autorización/roles** — no tocado; el comando no tiene concepto de
  usuario/rol, es una utilidad de inspección local.
- **Datos de usuario/tenant** — no tocado; lee solo nombres de subdirectorio del
  directorio padre y presencia de `.git/` (misma superficie que
  `detectSiblingRepos` ya tenía antes de este change).
- **Input externo** — `--cwd` es un flag ya existente en todos los comandos CLI
  del proyecto (mismo patrón que `repo-plan`/`commit-plan`/`changed-files`); no
  se introduce un vector nuevo de input no confiable.
- **Secretos/tokens/credenciales** — no tocado; el comando no lee ni escribe
  configuración sensible.
- **Dependencia/integración nueva** — ninguna agregada.

El comando es **read-only** — nunca escribe. El contrato diff-then-approve de
`sdd-bootstrap-project` (el humano aprueba antes de escribir
`playbook.config.yaml`) no cambia: este change solo cambia el mecanismo de
*invocación* del paso 3 (comando CLI en vez de función JS), no qué se lee ni qué
se escribe ni quién aprueba.

## Rules

- Never lower an approved risk level automatically; you may raise it with justification.
- Any blocking finding → `status: blocked` (the change moves to the blocked view).
- Always include the non-replacement disclaimer in the report and CLI output.
- Do not claim the change is "secure" — claim only that the declared controls
  have (or lack) evidence.
- Missing/client-side-only/broader-than-specified authorization, cross-tenant
  data access, unsanitized input reaching a query/command/template, sensitive
  data exposed in a response/log/error, or a committed secret → always blocking.
- Do not propose scope expansion beyond the approved feature.

## Risk model

`proposal.md` declara `security.risk: standard`, `security.triggers: []`.
`design.md` fija `threat_model_required: false` y `controls: [SEC-001]`
("read-only, misma superficie que `detectSiblingRepos` ya tenía"). Reconciliado:
se mantiene `standard` — el diff (handler de ~20 líneas sin lógica nueva de
lectura, más registro en dispatch) no introduce ninguna señal omitida.

## Checklist

- [n-a] Authorization and access control — sin endpoint/acción con permisos.
- [n-a] Ownership boundaries (IDOR) — no hay IDs de recursos de usuario en juego.
- [n-a] Input handling — `--cwd`/`--json` son flags ya usados por comandos existentes; sin input externo nuevo.
- [n-a] Data exposure — la salida (nombres de directorio, stack guess) es la misma que `detectSiblingRepos` ya devolvía; nada nuevo se expone.
- [n-a] Secrets and credentials — ninguno tocado.
- [n-a] Dependencies and integrations — ninguna dependencia nueva.

## Risk rationale

Wrapper de CLI de solo lectura sobre una función ya existente y auditada
(`test/detect-siblings.test.js`, sin cambios). El diff de este change (handler +
registro + una instrucción de skill) no crea superficie de escritura ni de
input no confiable nueva.

## Control checklist (control → evidence)

| Control | Evidencia |
|---|---|
| SEC-001 (read-only, misma superficie) | `src/cli/repos.js::detectSiblingsCommand` no tiene ninguna rama de escritura (`fs.write*`, `fs.mkdir*`, etc. ausentes — revisado en el diff); solo llama `detectSiblingRepos({cwd})` y formatea su retorno con `io.out`/`io.err`. |

## Threat model (when required)

Not applicable — `threat_model_required: false`.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| — | — | — | — | No findings. |
