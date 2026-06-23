# Guía de Desarrollo SDD con IA

[Inicio](../README.md) | Flujo de Trabajo SDD

Guía práctica para desarrollar nuevos requerimientos usando la metodología Spec-Driven Development (SDD) asistida por IA. El flujo funciona desde dos entornos complementarios: **Claude Code** (ciclo completo) y **GitHub Copilot** (touchpoints de ideación y PR).

---

## ¿Qué es este flujo?

Antes de escribir una línea de código, el flujo SDD produce tres artefactos en orden dentro de una carpeta por feature:

```
openspec/changes/{slug}/
  proposal.md    ←  qué construir y por qué  (AC, restricciones, errores)
  design.md      ←  cómo construirlo          (contrato técnico aprobado)
  tasks.md       ←  plan ejecutable paso a paso
```

Cada artefacto debe ser aprobado antes de avanzar al siguiente. El agente implementador solo lee `tasks.md` — los otros dos son para revisión humana y trazabilidad.

**{slug}** = descripción kebab-case de la feature, coincide con el nombre de la rama git.  
Ejemplo: feature `Marcar ofertas como favoritas` → slug `marcar-ofertas-favoritas` → rama `marcar-ofertas-favoritas`.

---

## Entornos de trabajo

El SDD se apoya en dos entornos que se complementan. No son redundantes: cada uno cubre los momentos en que es más efectivo.

| | Claude Code | GitHub Copilot |
|---|---|---|
| **Dónde** | Chat de Claude Code (VS Code o terminal) | Copilot Chat en VS Code |
| **Rol en el ciclo** | Motor principal — planificación, implementación, cierre | Touchpoints de ideación y PR |
| **Activa cómo** | Comandos explícitos `/nombre [ticket]` | Skills automáticos por contexto |
| **Cuándo usarlo** | Para todo el ciclo de desarrollo | Al explorar un requisito inicial o redactar un PR |

### Comandos Claude Code

| Comando | Fase | Qué produce |
|---|---|---|
| `/sdd-enrich-us [ticket]` | Ideación | `proposal.md` draft (preguntas de cierre) |
| `/sdd-new [ticket] [desc]` | Inicio | Carpeta `openspec/changes/[ticket]/` + artefactos iniciales |
| `/sdd-ff [ticket]` | Planificación | `tasks.md` granularizado desde proposal aprobada |
| `/sdd-apply [ticket]` | Implementación | Código en TDD, checkboxes completados, Execution Report |
| `/sdd-code-review [ticket]` | Revisión | `code-review-report.md` con veredicto spec-compliance |
| `/sdd-ux-gate` | Revisión | `ux-gate-report.md` con veredicto UX/UI (`READY FOR PR UX` / `REQUIRES UX FIXES`) |
| `/sdd-commit [ticket]` | Cierre | Commit Conventional Commits + descripción de rama |
| `/sdd-verify [ticket]` | Cierre | Confirmación de que todos los ACs tienen tests pasando |
| `/sdd-archive [ticket]` | Cierre | `openspec/specs/{domain}/spec.md` actualizado |

### Skills de GitHub Copilot

| Skill | Fase | Qué produce |
|---|---|---|
| `sdd-enrich-us` | Ideación | Preguntas de cierre + borrador de `proposal.md` |
| `sdd-new` | Inicio | Carpeta `openspec/changes/[ticket]/` + artefactos iniciales |
| `sdd-ff` | Planificación | `tasks.md` granularizado desde proposal aprobada |
| `sdd-apply` | Implementación | Código en TDD, checkboxes completados, `testing-report.md` |
| `sdd-code-review` | Revisión | `code-review-report.md` con veredicto spec-compliance |
| `sdd-ux-gate` | Revisión | `ux-gate-report.md` con veredicto UX/UI (`READY FOR PR UX` / `REQUIRES UX FIXES`) |
| `sdd-commit` | Cierre | Commit Conventional Commits + PR abierto (descripción inline) |
| `sdd-verify` | Cierre | `verification-report.md` — todos los ACs tienen tests pasando |
| `sdd-archive` | Cierre | `openspec/specs/{domain}/spec.md` actualizado |

---

## Ciclo completo

Ambos entornos cubren el ciclo completo. Claude Code usa comandos `/`; Copilot usa skills activados por contexto. Son intercambiables — elige según el entorno en que estés trabajando.

```
[Idea / tarea en Asana]
         │
         ├── Claude Code ──────► /sdd-enrich-us
         └── GitHub Copilot ──► sdd-enrich-us / sdd-new
                         │
                         ▼
              proposal.md (status: draft)
                         │
                         ▼ [revisión humana → status: pending]
                         │
         ├── Claude Code ──────► /sdd-ff
         └── GitHub Copilot ──► sdd-ff
                         │
                         ▼
                      tasks.md
                         │
         ├── Claude Code ──────► /sdd-apply
         └── GitHub Copilot ──► sdd-apply
                         │
                         ▼
              implementación TDD + testing-report.md
                         │
         ├── Claude Code ──────► /sdd-code-review
         └── GitHub Copilot ──► sdd-code-review
                         │
                         ▼
              code-review-report.md (READY FOR PR / REQUIRES FIXES)
                         │
         └── GitHub Copilot ──► sdd-ux-gate
                         │
                         ▼
              ux-gate-report.md (READY FOR PR UX / REQUIRES UX FIXES)
                         │
         ├── Claude Code ──────► /sdd-commit
         └── GitHub Copilot ──► sdd-commit  (descripción generada inline)
                         │
                         ▼
                      PR abierto
                         │
                         ▼ [code review humano + merge]
                         │
         ├── Claude Code ──────► /sdd-verify → /sdd-archive
         └── GitHub Copilot ──► sdd-verify → sdd-archive
                         │
                         ▼
         openspec/specs/{domain}/spec.md actualizado
```

---

## Flujo en Claude Code (ciclo completo)

### Paso 1 — Abrir nueva sesión

Inicia una nueva conversación en Claude Code (VS Code o terminal). El archivo `CLAUDE.md` y `openspec/specs/system.md` se cargan como contexto: la IA ya conoce el stack, la arquitectura y las decisiones globales sin que tengas que explicarlas.

---

### Paso 2 — Describir el requerimiento (sin estructura)

Escribe libremente lo que quieres construir. No necesitas formatearlo.

**Ejemplo:**
> "Quiero agregar una funcionalidad para que los candidatos puedan marcar ofertas de trabajo como favoritas y verlas en una sección dedicada."

---

### Paso 3 — Invocar `/sdd-enrich-us`

```
/sdd-enrich-us [ticket-slug]
```

La IA leerá `openspec/specs/system.md` y el spec del dominio afectado. Luego te hará preguntas de cierre sobre:

- Forma de la solución (nuevo endpoint vs. extender comportamiento existente)
- Resultado esperado (qué retorna y en qué formato)
- Comportamiento en casos normales, borde y fallo
- Actor y contexto de uso
- Qué está dentro y fuera del alcance
- Criterios de éxito (criterios de aceptación en formato AC-01/AC-02)

Responde las preguntas. Si una pregunta tiene una opción sugerida que te parece correcta, basta con confirmarla.

> **Tip:** No te preocupes por ser exhaustivo en tu descripción inicial. El comando está diseñado para extraer lo que falta mediante preguntas.

---

### Paso 4 — Confirmar el borrador del proposal

Cuando la IA haya cerrado todas las decisiones, te preguntará si quiere generar el borrador final. Responde **sí**. La IA refinará el `proposal.md`. Luego invoca `/sdd-new` para crear la carpeta con los artefactos:

```
/sdd-new [ticket-slug] [descripción corta]
```

Esto genera:

```
openspec/changes/{slug}/proposal.md   ← spec completa (qué, AC, restricciones, errores)
openspec/changes/{slug}/OWNER.md      ← developer responsable + link Asana
```

**Revisa el documento.** Verifica que tenga:
- `## Criterios de aceptación` con ACs numerados (AC-01, AC-02...)
- `## Restricciones` (qué NO debe tocar la feature)
- `## Casos de error` (comportamiento ante fallos)

---

### Paso 4b — Revisión humana y aprobación del proposal

Este paso es **obligatorio antes de continuar**.

1. Lee `openspec/changes/{slug}/proposal.md`
2. Valida con el PM o negocio que los criterios de aceptación son correctos
3. Si hay cambios, edita el proposal directamente
4. Cuando esté listo, cambia `status: draft` → `status: pending` en el frontmatter

> **Regla de inmutabilidad**: una vez en `status: pending`, la spec no se edita.
> Si el requisito cambia, se detiene `/sdd-ff`, se actualiza el proposal y se vuelve a `status: draft`, y se re-aprueba.

---

### Paso 5 — Invocar `/sdd-ff`

```
/sdd-ff [ticket-slug]
```

La IA leerá `openspec/changes/{slug}/proposal.md` (debe estar en estado `pending`, es decir aprobada) junto con el código existente y producirá un **plan ejecutable granularizado** que incluye:

- Objetivo y alcance (in/out of scope)
- Impacto en contratos públicos (endpoints, response shapes, variables Twig)
- Delta arquitectónico: qué capas se tocan, qué clases se crean o modifican
- Ownership por capa (qué vive en qué Bundle y directorio)
- Estrategia de validación

---

### Paso 6 — Revisar el plan

Lee el `tasks.md` generado. Verifica especialmente:

- **Scope**: ¿los archivos a crear/modificar respetan `## Restricciones` del proposal?
- **Pasos atómicos**: cada tarea `T<fase>.<índice>` debe tener criterio de éxito verificable
- **Tests requeridos**: cada tarea debe listar qué tests la cubren

Si algo no está bien, indícalo. La IA corregirá el plan.

---

### Paso 7 — Implementar

Con el plan en `openspec/changes/{slug}/tasks.md`, invoca `/sdd-apply`:

```
/sdd-apply [ticket-slug]
```

El agente ejecutará los pasos en orden TDD, marcará los checkboxes conforme avanza, y completará el `Execution Report` al final. El plan contiene:
- Fases de implementación con pasos en formato checkbox (`T1.1`, `T1.2`...)
- Comandos de validación con resultado esperado
- Lista de archivos a crear/modificar por tarea
- Tests requeridos por tarea

---

### Paso 8 — Revisión automática con `/sdd-code-review`

```
/sdd-code-review [ticket-slug]
```

La IA revisará el código generado contra `proposal.md` y verificará:
- Cada AC tiene al menos un test que lo cubre
- El código no toca archivos fuera de `## Restricciones`
- Todos los casos de error tienen manejo explícito
- Naming sigue `openspec/specs/system.md`

Output: `openspec/changes/{slug}/code-review-report.md` con veredicto `LISTO PARA PR HUMANO` o `REQUIERE CORRECCIONES`.

Si hay correcciones → corrige → vuelve a ejecutar `/sdd-code-review`.

---

### Paso 9 — Validación UX con `/sdd-ux-gate`

```
/sdd-ux-gate [ticket-slug]
```

La IA validará el comportamiento desde la perspectiva del usuario final:
- Recorrido principal (happy path) funciona end-to-end
- Estados de UI (loading, empty, error) manejados correctamente
- Responsive behavior en dispositivos móviles/tablet/desktop
- Accesibilidad básica (navegación por teclado, labels, contraste)
- Regresiones: flujos existentes no afectados

Output: `openspec/changes/{slug}/ux-gate-report.md` con veredicto `READY FOR PR UX` o `REQUIRES UX FIXES`.

Si hay correcciones → corrige → vuelve a ejecutar `/sdd-ux-gate`.

> **Para features backend puras**: El UX Gate valida que no hay cambios visibles para el usuario y que la transparencia se mantiene.

---

### Paso 10 — Commit y PR

```
/sdd-commit [ticket-slug]
```

La IA generará un commit estructurado (Conventional Commits) con referencia a la spec. Para la descripción del PR, genera la descripción del PR inline.

---

### Paso 11 — Verificación final y archivo

Tras el merge del PR:

```
/sdd-verify [ticket-slug]
/sdd-archive [ticket-slug]
```

`/sdd-verify` comprueba que todos los ACs tienen tests pasando.  
`/sdd-archive` extrae las decisiones arquitectónicas de `design.md` y las integra en `openspec/specs/{domain}/spec.md`, actualizando la fuente de verdad permanente del dominio.

---

## Flujo en GitHub Copilot

Copilot cubre el ciclo SDD completo desde VS Code usando skills. Cada skill se activa explícitamente en Copilot Chat escribiendo su nombre o describiendo la fase.

### Paso 1 — Enriquecer el requerimiento

Describe la idea en **Copilot Chat**. El skill `sdd-enrich-us` se activa, hace las preguntas de cierre y produce el borrador de `proposal.md`.

### Paso 2 — Crear artefactos iniciales

Escribe `sdd-new [ticket-slug]`. El skill crea `openspec/changes/[ticket]/` con `OWNER.md`, `proposal.md` finalizado y `tasks.md` placeholder.

### Paso 3 — Revisión humana

Revisa `proposal.md`, valida los ACs con el negocio, y cambia `status: draft` → `status: pending` manualmente.

### Paso 4 — Granularizar tareas

Escribe `sdd-ff [ticket-slug]`. El skill genera `tasks.md` con fases atómicas y criterios de éxito verificables.

### Paso 5 — Implementar

Escribe `sdd-apply [ticket-slug]`. El skill ejecuta los tasks en orden TDD, corre los tests PHPUnit (ver `docs/doc_verification_guide.md`) y produce `testing-report.md`.

> Requiere **Copilot agent mode** (acceso a terminal).

### Paso 6 — Revisión automática

Escribe `sdd-code-review [ticket-slug]`. El skill revisa el código contra `proposal.md` y genera `code-review-report.md` con veredicto `READY FOR PR` o `REQUIRES FIXES`.

### Paso 7 — UX Gate

Escribe `sdd-ux-gate [ticket-slug]`. El skill valida el flujo UX/UI implementado (recorrido principal, estados loading/empty/error, responsive, accesibilidad básica) y genera `ux-gate-report.md` con veredicto `READY FOR PR UX` o `REQUIRES UX FIXES`.

### Paso 8 — Commit y PR

Escribe `sdd-commit [ticket-slug]`. El skill valida el veredicto, hace commit con Conventional Commits, pushea la rama, y abre el PR generando la descripción del PR inline.

> Requiere **Copilot agent mode** + GitHub CLI autenticado.

### Paso 9 — Verificación post-merge

Tras el merge, escribe `sdd-verify [ticket-slug]`. El skill corre la suite de tests y genera `verification-report.md`.

### Paso 10 — Archivar

Escribe `sdd-archive [ticket-slug]`. El skill integra las decisiones en `openspec/specs/{domain}/spec.md`, actualiza `system.md` si la arquitectura cambió, y elimina `openspec/changes/[ticket]/` tras confirmación.

> **Cuándo preferir Copilot**: cuando estás revisando código en VS Code y quieres ejecutar el ciclo sin cambiar de contexto.  
> **Cuándo preferir Claude Code**: para sesiones largas de implementación, specs técnicas complejas, o cuando ya tienes Claude Code abierto.

---

## Artefactos generados

```
openspec/changes/{slug}/
  OWNER.md              ← developer responsable + link Asana      (Paso 2 — sdd-new)
  proposal.md           ← qué se construye, AC, errores           (Paso 1/2 — sdd-enrich-us + sdd-new)
  tasks.md              ← plan ejecutable paso a paso             (Paso 4 — sdd-ff)
  code-review-report.md ← resultado de sdd-code-review            (Paso 6 — sdd-code-review)
  ux-gate-report.md     ← resultado de sdd-ux-gate                (Paso 7 — sdd-ux-gate)
```

---

## Specs permanentes (flywheel)

Cada feature archivada enriquece las specs permanentes del dominio:

```
openspec/specs/
  system.md              ← decisiones globales de arquitectura (Tech Lead)
  {domain}/spec.md       ← spec permanente del dominio (una por feature archivada)
```

Esto convierte el SDD en un flywheel: cada feature completada hace el contexto más preciso para la siguiente. La IA no necesita re-descubrir lo que ya se decidió.

---

## Flujo abreviado

Si el requerimiento ya está claro y documentado en Asana, puedes crear `proposal.md` manualmente (siguiendo la plantilla), marcarlo como `pending` (aprobada), y saltar al Paso 5.

```
Crear proposal.md manual (status: pending) → /sdd-ff [ticket] → /sdd-apply [ticket]
```

---

## Preguntas frecuentes

**¿Debo crear los directorios `openspec/changes/{slug}/` manualmente?**
No. `/sdd-new [ticket-slug] [descripción]` crea la carpeta y los artefactos iniciales automáticamente.

**¿Puedo cambiar el proposal después del Paso 4b?**
Solo si aún está en estado `draft`. Una vez en estado `pending` (aprobada), cualquier cambio requiere volver al inicio del ciclo: detener `/sdd-ff`, editar el proposal, re-aprobar.

**¿El `design.md` se puede compartir con el equipo?**
Sí. Es el contrato técnico pensado para revisión por tech lead o arquitecto.

**¿Qué pasa si el plan ejecutable queda incompleto o bloqueado?**
El agente debe marcar los pasos bloqueados con `[BLOCKED]` y razón en el `Execution Report`. No debe marcar como completado algo que no ejecutó.

**¿Puedo usar `/sdd-ff` sin haber usado `/sdd-enrich-us` antes?**
Sí, si ya tienes un `proposal.md` en estado `pending` creado manualmente.

**¿El `/sdd-code-review` reemplaza el code review humano?**
No. El `/sdd-code-review` automático valida la spec — detecta si el código implementa lo acordado. El revisor humano valida si los criterios de aceptación eran los correctos desde el principio. Ambos son necesarios.

**¿Qué pasa con el `openspec/changes/{slug}/` después del merge?**
La carpeta permanece en el repositorio como historial hasta que se ejecute `/sdd-archive [ticket-slug]`. Después del archive, la carpeta puede eliminarse — las decisiones relevantes habrán migrado a `openspec/specs/{domain}/spec.md`.

**¿Qué diferencia hay entre los comandos Claude Code y los skills de GitHub Copilot?**
Los comandos Claude Code (`~/.claude/commands/`) se invocan en el chat de Claude Code con `/nombre`. Los skills de GitHub Copilot (`.github/skills/`) se activan automáticamente en Copilot Chat al detectar el contexto. Ambos coexisten en el mismo repositorio y se complementan.
