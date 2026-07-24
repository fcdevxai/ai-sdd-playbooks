---
schema: security-report
schema_version: 1
change_id: delivery-state-branch-independence
status: passed
risk: standard
threat_model_required: false
updated: 2026-07-24
---
# Security Report — Delivery independiente de la branch actual

> This gate is an automated pre-check and does not replace a penetration test
> or a human security audit.

**Applicability**: **Revisión completa, superficie angosta.** No hay autenticación,
autorización, roles, datos de usuario/tenant, dependencias nuevas ni integraciones
nuevas. Pero **sí hay input handling real**: un valor pasa a ser el nombre de una
branch y después un **elemento de `argv` de `gh`**. Eso se revisó a fondo y produjo un
hallazgo remediado dentro del gate (SEC-F1), de una clase distinta a la que el proposal
había previsto.

Contexto leído: `context-packet.md` (coherente con las fuentes vivas), `design.md`
(`controls: [SEC-001, SEC-002]`), `openspec/specs/system.md`,
`docs/security-checklist.md`, y `playbook changed-files --diff`. Se ejerció el derecho
a full-read sobre toda la superficie que toca el input: `src/github/index.js`,
`src/github/pull-request.js`, `src/github/checks.js`, `src/repos/delivery.js`,
`src/cli/status.js`, `src/config/artifacts.js`.

## Checklist

- [n-a] **Authorization and access control** — no hay endpoint, acción ni control de acceso. `capabilities.http: false`.
- [n-a] **Ownership boundaries (IDOR)** — sin IDs de objetos, sin scoping por usuario/tenant, sin base de datos.
- [pass] **Input handling** — es la superficie de este change y donde salió SEC-F1. Verificado en la fuente, no asumido: **no hay `shell:` en ningún runner** — `execFileSync('gh', args, {...})` con array (`src/github/index.js:35`), así que **no hay inyección de comandos**; eso ya era cierto antes del change. El slug llega a `gh` por exactamente **dos** vías, ambas como elemento discreto de argv: `['pr','view',branch,'--json',…]` (`pull-request.js:7`) y `['pr','checks',branch]` (`checks.js:8`). Lo que faltaba era rechazar un guion inicial — ver SEC-F1.
- [pass] **Data exposure** — sin respuestas, logs ni errores nuevos que porten datos. El único texto nuevo es la constante `INVALID_CHANGE_SLUG`. Los estados que se devuelven no cambian de forma.
- [pass] **Secrets and credentials** — nada hardcodeado ni commiteado; sin valores de config nuevos; `gh` sigue usando su propia auth (`gh auth status`), que este change no toca.
- [n-a] **Dependencies and integrations** — `package.json` sin tocar, cero dependencias nuevas, cero integraciones nuevas.

## Risk rationale

`reconciled = max(declared: standard, detected: standard) = **standard**`. **No se
sube:** SEC-F1 es de severidad baja, quedó remediado dentro del gate, y no hay
exposición de datos, escalación ni ejecución de código en ninguna variante.
**No se baja** — este gate nunca baja un riesgo aprobado.
`threat_model_required: false`: no hay actor nuevo, activo nuevo ni superficie de red
nueva; el change cambia **qué branch** se consulta, no qué se consulta ni quién puede.

No se afirma que el change sea "seguro": se afirma que los tres controles declarados
tienen evidencia y que el hallazgo del gate quedó cerrado con test.

### Precisión sobre el alcance real de la validación (corrige la lectura del proposal)

El `sdd-code-review` señaló esto y lo confirmé leyendo la fuente: el **único caller
productivo** es `src/cli/status.js:41` con `slug: change.changeId`, y `changeId` es
`path.basename(changeDir)` (`src/config/artifacts.js:58`). O sea, por el camino
productivo el slug **siempre** es un string no vacío que por construcción no contiene
`/` ni `\`.

Pero **no es cierto que el guard sea inalcanzable**, que era la conclusión tentativa
del code review. `findChangeDirs` (`src/config/artifacts.js:62`) filtra únicamente por
"es un directorio" — **sin validar el nombre**. Un directorio llamado `-R` o `--web`
bajo `openspec/changes/` se toma como change, y su basename llega a argv. `playbook
validate` lo detectaría (el schema de `change_id` exige `^[a-z0-9][a-z0-9._-]*$`, y
`validate.js:72` cruza frontmatter contra nombre de carpeta), **pero `playbook status`
no depende de que `validate` haya pasado**. Así que el guard sí es alcanzable — y por
eso SEC-F1 importa en vez de ser puro celo.

## Control checklist (control → evidencia)

| Control | Declarado en | Evidencia | Estado |
|---|---|---|---|
| **SEC-001** — el slug se valida antes de ser argumento de `gh` | proposal SEC-1, design `controls` | `isSafeBranchSlug` + guard como **primera sentencia** de `resolveDelivery`, antes de instanciar runners. Test `an invalid slug fails closed to unknown without invoking gh (AC-6, EC-1)` sobre **9** slugs inválidos, con **contador de invocaciones de `gh` en 0** en cada uno. Verificado aislado: `--test-name-pattern="invalid slug fails closed"` → 1 pass / 0 fail | ✅ con evidencia |
| **SEC-002** — nada se persiste | proposal SEC-2, design `controls` | El `slug` es parámetro de entrada; `git diff` no toca `playbook.lock` ni ningún schema. El delivery se sigue derivando en cada llamada. El change **refuerza** la restricción de `system.md`: la alternativa descartada (registrada en el ADR) era guardar la referencia al PR | ✅ con evidencia |
| **SEC-F1** (nuevo, de este gate) — un slug con guion inicial no llega a argv | este reporte | `!slug.startsWith('-')` en `isSafeBranchSlug`, con `-R`, `--web` y `-` agregados al test | ✅ con evidencia |

## Threat model (when required)

No requerido (`risk: standard`, `threat_model_required: false`). Se deja anotado el
límite de confianza que quedó explícito al revisar SEC-F1: el atacante tendría que
poder **crear un directorio** bajo `openspec/changes/` del repo del usuario. Quien
puede hacer eso ya puede editar el código del repo, así que no es un canal de
escalación nuevo. El caso realista no es un ataque sino un **accidente**: una carpeta
mal nombrada produciendo un `gh` con flags inesperadas.

## Findings

| id | severity | blocking | location | remediation |
|---|---|---|---|---|
| SEC-F1 | low | no | `src/github/index.js` (`isSafeBranchSlug`) | **Remediado en este gate.** La validación que este change agrega rechazaba `/`, `\`, `.`, `..` y vacío, pero **no un guion inicial** — y el valor termina siendo un elemento de argv de `gh`, donde `-R` o `--web` se parsean como **opción**, no como nombre de branch. Es *argument injection*, una clase distinta de la inyección de shell que el proposal (SEC-1) descartó correctamente: no hay shell, pero sí un parser de flags. Impacto realista acotado: `gh` erraría y el `catch` devolvería `null` → `committed` (estado equivocado), y en el peor caso una flag con efecto colateral como `--web` abriría un navegador desde un comando de sólo lectura. Fix: `!slug.startsWith('-')`, más `-R`, `--web` y `-` en el test (9 casos inválidos en total). Re-verificado: `npm test` 357/357, test de SEC-001 aislado en verde. |

**Por qué `low` y no blocking:** requiere crear un directorio con un nombre hostil en
el repo del propio usuario; no hay exposición de datos, ni acceso cross-tenant, ni
input sin sanitizar llegando a una query/comando/template (no hay shell), ni secreto
commiteado. Ninguna de las condiciones de blocking del gate aplica.

**Nota deliberada para el Ciclo G:** esto **no** es un bug en `isSafeSlug` de
`src/tokens/packet.js`. Ahí el slug se usa como segmento de path, donde un guion
inicial es inocuo. Si el Ciclo G unifica las dos validaciones, la versión unificada
debe conservar la condición del guion **sin** asumir que packet.js la necesitaba —
copiar en la dirección inversa sería endurecer sin razón y podría rechazar slugs hoy
válidos.

## Observaciones fuera de scope

1. **`findChangeDirs` no valida nombres de directorio**, y `playbook status` no depende
   de `validate`. SEC-F1 cierra la consecuencia en la superficie de este change, pero
   la causa de fondo —cualquier subdirectorio de `openspec/changes/` se toma como
   change— sigue ahí y podría morder en otro consumidor del basename. Candidato a
   sumarse al **Ciclo G** de la §11 del plan (path/slug handling), que ya iba a tocar
   este tema.
2. **La duplicación de validación ahora tiene reacciones y criterios distintos**: una
   lanza y no mira el guion (`packet.js`), la otra falla cerrada y sí lo mira
   (`github/index.js`). Es correcto por contexto, pero es exactamente el tipo de
   divergencia que hace valioso el Ciclo G — con la advertencia de la nota de arriba.
3. **`docs/security-checklist.md`**: este change agrega un riesgo aceptado (el hueco de
   EC-3, árbol sucio + PR mergeado) que corresponde registrar en el archive, junto con
   los dos que aporta el ADR del adapter `cli`.
