---
schema: security-report
schema_version: 1
change_id: convention-drift-verify-commit
status: passed
risk: standard
threat_model_required: false
updated: 2026-07-24
---
# Security Report — Restaurar `pwd` en `sdd-verify` y el retry cap en `sdd-commit`

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: **Revisión completa, superficie angosta.** El change no toca
autenticación, autorización, roles, datos de usuario/tenant, input externo,
dependencias nuevas ni integraciones — cero cambios en `src/`. Deliberadamente
**no** se marca `not_applicable`, porque hay una superficie real: el change hace
que `sdd-commit` **escriba** durante su etapa (regenerar `context-packet.md`)
donde antes sólo leía y se detenía, y toda la seguridad de eso descansa en una
restricción en prosa. Eso se revisó a fondo y produjo un hallazgo remediado dentro
de este gate (SEC-F1).

Contexto leído: `context-packet.md` (coherente con las fuentes vivas), `design.md`
(`controls: [SEC-001, SEC-002]`), `openspec/specs/system.md`,
`docs/security-checklist.md` (que desde el Ciclo C ya tiene una superficie real y
2 riesgos aceptados), y `playbook changed-files --diff`. Se ejerció el derecho a
full-read sobre la superficie sensible: `src/tokens/packet.js` (el único
generador que el loop puede invocar) y ambos `canonical.md` completos.

## Checklist

- [n-a] **Authorization and access control** — no hay endpoint, acción ni control de acceso. `playbook-ai` no tiene superficie HTTP (`capabilities.http: false`).
- [n-a] **Ownership boundaries (IDOR)** — sin referencias a objetos, IDs ni scoping por usuario/tenant. No hay base de datos ni modelo multi-tenant.
- [pass] **Input handling** — el único input que la instrucción nueva consume es el `<change-id>` que se pasa a `playbook packet`. **Verificado en código, no asumido:** `isSafeSlug` (`src/tokens/packet.js:33`) rechaza `.`, `..`, `/` y `\`, y se aplica en los **4** call sites del módulo (líneas 57, 71, 137, 146) — un `change-id` con forma de traversal lanza `Invalid change slug`. La escritura que el loop habilita está contenida por el código, no sólo por la prosa. Nada llega a un shell, `eval` ni template.
- [pass] **Data exposure** — no hay respuestas, logs ni errores nuevos. El único output nuevo es el stop/report, que por diseño imprime **la salida textual de `playbook validate`** — datos del propio repo, sin secretos ni rutas internas más allá de las que `validate` ya muestra.
- [pass] **Secrets and credentials** — nada hardcodeado ni commiteado. Verificado por la mitad **negativa** del test de SEC-001, más `grep -ci` directo sobre el `SKILL.md` nuevo: 0 matches de instrucciones de escribir/flipear un status de reporte, 0 de `status: passed`. Sin valores de config nuevos.
- [n-a] **Dependencies and integrations** — cero dependencias nuevas (`package.json` sin tocar), cero integraciones.

## Risk rationale

`reconciled = max(declared: standard, detected: standard) = **standard**`. **No se
sube.** El único hallazgo (SEC-F1) es de precisión y quedó remediado dentro del
gate; el guard del input está en código y ya existía. **No se baja** — este gate
nunca baja un riesgo aprobado. `threat_model_required: false` se sostiene: no hay
actor, activo ni superficie de ataque nueva; la escritura habilitada es una
regeneración determinista sobre el árbol del propio proyecto, con slug validado.

Se hace notar que el change **agrega** dos controles al sistema en vez de sólo
declararlos: el chequeo de `pwd` (defensivo, contra ejecución en el directorio
equivocado) y la subordinación explícita del presupuesto de reintentos a las
reglas de seguridad. No se afirma que el change sea "seguro": se afirma que los
tres controles declarados tienen evidencia.

## Control checklist (control → evidencia)

| Control | Declarado en | Evidencia | Estado |
|---|---|---|---|
| **SEC-001** — el loop nunca hace pasar `validate` debilitando el status de un gate | proposal SEC-1, design `controls` | Regla explícita en `## Rules` de `sdd-commit` ("never overrides a security rule") + prohibición inline en el paso 1. Test `sdd-commit never makes validate pass by weakening a gate status (SEC-001)`: mitad **negativa primero** (0 matches de verbo+reporte y de `status: passed` contra el body nuevo, re-verificado tras cada edición) + positiva, que además custodia que `Do not commit around a blocking finding` siga presente (pasó de 1 a 2 apariciones). | ✅ con evidencia |
| **SEC-002** — superficie: cero cambios en `src/` | proposal SEC-2, design `controls` | `git diff --stat -- src/ schemas/ templates/` → **0 líneas**. Los 5 archivos tocados son `skills/sdd-{verify,commit}/{canonical,SKILL}.md` y `test/skill-contract.test.js`. | ✅ con evidencia |
| **SEC-F1** (nuevo, agregado por este gate) — los drafts de ADR también son intocables por el loop | este reporte | La instrucción ahora los nombra en la lista de artefactos firmados, con su razón ("a `status: proposed` draft is unreviewed, not unprotected"). Asertado en el test de AC-5. | ✅ con evidencia |

## Threat model (when required)

No requerido (`risk: standard`, `threat_model_required: false`). Se deja anotado el
límite de confianza que quedó explícito al revisar SEC-F1: la protección de los
artefactos firmados es **una regla en un prompt**, no un permiso de filesystem. Un
agente que ignore la instrucción puede editarlos igual. Lo que la mitiga es que el
resultado queda en el diff y en el PR, bajo revisión humana, antes de mergear — la
misma razón por la que el nivel de enforcement de esta clase se cerró como wiring +
test de contenido y no como hook (§3 del plan de wiring-gaps).

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| SEC-F1 | low | no | `skills/sdd-commit/canonical.md` (paso 1 de `## Behavior`) | **Remediado en este gate.** La lista de artefactos firmados no nombraba los `adr-*.md`, y la justificación de la regla ("los primeros dos llevan un `status: approved` humano y los reportes llevan el veredicto de un gate") **no daba ningún motivo para protegerlos** — un draft de ADR está en `status: proposed`, o sea explícitamente *no* firmado. Un agente que aplicara el razonamiento en vez de la lista literal podría concluir que es editable, y `playbook validate` **sí** valida los drafts de ADR (confirmado: el output los lista, y `src/adr/validate.js` les corre validación estructural), así que es un candidato realista a ser lo que falle en el commit. El resultado habría sido editar el registro del *por qué* de una decisión para satisfacer a un validador, antes de que un humano lo acepte o rechace. Se agregaron a la lista con su razón explícita, más una aserción en el test de AC-5. Re-verificado: `npm test` 352/352, `generate:check` sin drift, mitad negativa de SEC-001 sigue en 0 matches. |

**Por qué `low` y no blocking:** la cláusula de default estricto ("anything not
named regenerable counts as signed") ya cubría el caso, así que el hueco era de
*precisión del razonamiento*, no de ausencia de regla; y ninguna de las condiciones
de blocking del gate aplica (no hay autorización ausente, ni acceso cross-tenant,
ni input sin sanitizar llegando a una query/comando/template, ni dato sensible
expuesto, ni secreto commiteado).

## Observaciones fuera de scope (para el archive / plan maestro)

1. **Contraste útil con el Ciclo C.** Ahí el hallazgo fue que `contract-drift` lee
   una ruta de config **sin contención** (`src/cli/repos.js:152`). Acá el generador
   que el loop invoca **sí** valida su entrada (`isSafeSlug`, 4 call sites). O sea:
   la validación de rutas/slugs en este repo es **inconsistente entre comandos**, no
   ausente. Refuerza el candidato de ciclo futuro ya anotado en la §9 del plan
   (path handling de `contract.path_in_loom`), ahora con un ejemplo de cómo se hace
   bien en el mismo codebase.
2. **La protección de artefactos firmados es una regla en prosa, no un permiso.**
   Registrado en el ADR draft como riesgo residual. Si en el futuro se quisiera
   enforcement real, la vía natural sería un chequeo en `playbook validate` que
   detecte que un artefacto con `status: approved` cambió sin que cambie su
   `updated`/status — pero eso es un change aparte y la §3 del plan ya descartó
   subir el nivel de enforcement para esta clase.
3. **`docs/security-checklist.md` sigue con las 3 tablas de ejemplo sin llenar** más
   allá de la fila real que agregó el Ciclo C. No es de este change: este no
   introduce superficie sensible nueva que registrar.
