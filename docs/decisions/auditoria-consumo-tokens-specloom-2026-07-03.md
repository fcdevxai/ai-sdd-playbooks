# Auditoría de consumo de tokens — SpecLoom

**Fecha**: 2026-07-03
**Alcance**: workspace `specloom-main` (el repo del framework, que se auto-mejora usando sus propios playbooks desde Claude Code y Codex)
**Método**: análisis estático de evidencia + medición de tamaños + simulación razonada de flujo end-to-end. Sin modificar archivos del repo. Cada afirmación está marcada como **evidencia observada**, **estimación** o **simulación razonada**.

---

## 1. Diagnóstico principal

El problema de consumo de SpecLoom **no** está donde suele buscarse (un CLAUDE.md largo). Está en cuatro propiedades estructurales de los playbooks, todas verificadas con evidencia:

1. **Re-lectura completa de los mismos artefactos en cada fase**: `proposal.md` entra al contexto en 8 de 10 playbooks, `system.md` en 7 de 10, y la superficie de implementación completa se re-lee 4 veces después de codificar (code-review, security-gate, ux-gate, y el `git diff main...` completo en commit).
2. **Cero límites numéricos de reintentos o iteraciones** en todo el framework — todos los bucles (TDD, `loom validate`, gates fallidos, Q&A de enrich-us) son "repite hasta que pase". Verificado por grep exhaustivo.
3. **Ninguna compactación de outputs de comandos** — ni en los playbooks (ninguno instruye limitar/resumir salida) ni en el código del framework (cero `slice()`, cero truncado, cero persistencia de logs).
4. **Catálogo de skills duplicado en cada turno de Claude Code** (~1.9k tokens): `sync --target all` genera `.claude/commands/` y `.claude/skills/` con los mismos 10 flujos, y ambos se registran en el catálogo por turno.

**El punto brillante**: el CLI `loom` ya es compacto por diseño (`loom status` ≈ 15 líneas fijas, `loom validate` = 1 línea por issue, éxito = 1 línea). Es la base natural para el wrapper compactador que falta.

**Advertencia que condiciona todo el informe**: este repo tiene specs/docs mayormente placeholder. Los tamaños medidos son la *cota inferior*; el dolor real ocurre en repos consumidores donde `system.md`, las specs de dominio y el código crecen. La arquitectura de lecturas ("Read completely" × N fases) es la que convierte ese crecimiento en costo multiplicado.

---

## 2. Contexto del repo: auto-mejora (dogfooding)

Consideración clave que reencuadra varios hallazgos: **el repo de SpecLoom se usa para mejorarse a sí mismo con sus propios playbooks, desde Claude Code Y Codex a la vez**. Por eso coexisten en la raíz:

- `CLAUDE.md` (contexto base para sesiones de Claude Code)
- `AGENTS.md` (contexto base para sesiones de Codex)
- `.claude/skills/` + `.claude/commands/` (artefactos generados para Claude Code)
- `.agents/skills/` (artefactos generados para Codex)

Consecuencias para la auditoría:

1. **AGENTS.md en la raíz NO debe eliminarse** — es contexto de trabajo real para las sesiones de Codex del dogfooding. Pero el hallazgo de fondo se vuelve *más* relevante: está **sin llenar** (`# AGENTS.md — [YOUR_PROJECT_NAME]`, todos los TODOs intactos), igual que 5 secciones de CLAUDE.md. Las sesiones de dogfooding de ambos harnesses pagan ~1.5k tokens/turno cada una por contexto que es mayormente placeholder. El arreglo correcto es **llenar ambos como kernel**, no borrar.
2. **Las 4 copias por playbook quedan explicadas** (canonical + commands + .claude/skills + .agents/skills = resultado natural de `sync --target all` para dogfoodear ambos harnesses). No es un error. Lo que sigue siendo desperdicio real e independiente: en cada sesión de Claude Code los 10 flujos se registran **dos veces** en el catálogo (~0.9k tok/turno). Codex no sufre esto (ignora `.claude/commands/`).
3. **Riesgo nuevo que el dogfooding introduce**: CLAUDE.md y AGENTS.md se mantienen a mano y en paralelo, y **ya divergieron** (la tabla de comandos usa `/slug` en uno y `slug` en el otro; AGENTS.md tiene un blockquote extra sobre Agent Skills). Como ambos se editan durante el propio ciclo SDD, el drift crecerá. Conviene que `sync` o `loom validate`/spec-lint los genere o verifique desde una fuente única — mismo patrón que ya usan para playbooks→skills con `sync --check`.
4. **El dogfooding es el banco de pruebas gratis del plan de optimización**: cada mejora (Fases 1–4 del plan) se valida primero aquí, en el ciclo de auto-mejora, con la telemetría de la Fase 1 midiendo antes/después en ambos harnesses sobre el mismo repo. Si el fix de sync (render skills-only para Claude) no rompe el triggering aquí, no lo rompe en ningún consumidor.

---

## 3. Contexto fijo enviado al modelo

### 3.1 Contexto fijo real observado (sesión de Claude Code)

| Bloque | Tamaño | Tokens aprox. | Evidencia |
|---|---:|---:|---|
| `CLAUDE.md` (raíz) | 5,978 B | ~1,500 | **Observado**: inyectado completo en el system-reminder de la sesión de auditoría |
| Catálogo de skills (10 descripciones de `SKILL.md`) | 6,826 B de descripciones | ~1,710 | **Observado**: las 10 descripciones completas aparecen en cada turno |
| Catálogo de comandos (10 entradas de `.claude/commands/`) | — | ~150–200 | **Observado**: cada `sdd-*` aparece **dos veces** — una con la descripción larga del skill y otra como `/sdd-apply — SDD Apply - Implement the Spec` |
| **Total fijo controlado por SpecLoom (Claude Code)** | | **~3,400/turno** | |

- `AGENTS.md` (6,122 B ≈ 1,530 tok): **NO se inyectó en la sesión de Claude Code observada** (evidencia por ausencia). En sesiones de Codex es el contexto base inyectado (equivalente al costo de CLAUDE.md). Es ~80% idéntico a CLAUDE.md (58 de 72 líneas únicas compartidas) y byte-idéntico a `framework/templates/codex/AGENTS.md`.
- `MEMORY.md`: no existe en el repo. La memoria del harness es por usuario, no del framework. No es fuente de consumo de SpecLoom.
- `config.yaml`, `README.md`, `docs/`, `openspec/specs/`: **no se cargan automáticamente** (verificado: no hay `@imports` en CLAUDE.md; solo referencias en prosa).

### 3.2 Redundancia en el bloque fijo (~40–55% de CLAUDE.md es recortable)

Verificado línea a línea:

- **5 secciones de CLAUDE.md son placeholders TODO sin llenar** ("Qué es specloom", "Stack", "Arquitectura de capas", "Módulos del sistema", bullet final de convenciones) — ~450 tokens de cero información. El contenido real de "Qué es specloom" existe en el primer párrafo del README. Lo mismo aplica a AGENTS.md completo (template crudo).
- La tabla **"Comandos del ciclo SDD"** (~350 tok) duplica fila por fila lo que el catálogo de skills ya inyecta en cada turno, y exige mantenimiento manual ("se actualiza a mano") — redundancia + riesgo de drift a la vez.
- El árbol **"Rutas SDD"** se repite en CLAUDE.md, AGENTS.md, README y dentro del Context de cada playbook.
- Las **descripciones de skills** dedican ~60–70% de sus palabras a listas bilingües de frases gatillo con pares de variantes de acento (`"haz la implementación", "haz la implementacion"`) — ~700–900 tok recortables sin riesgo real de triggering.
- **Asimetría de templates**: el template de Codex (`framework/templates/codex/AGENTS.md`) embarca 6.1 KB con tabla completa, mientras el de Claude (`framework/templates/claude/CLAUDE.md`) embarca 2.7 KB — un proyecto consumidor Codex nace con ~2.3× más contexto fijo que uno Claude.

### 3.3 Contexto que no se pudo verificar

- Tamaño exacto del system prompt base de cada harness (Claude Code / Codex) — es del harness, no de SpecLoom.
- Comportamiento de otras versiones de Claude Code respecto a AGENTS.md (en la sesión observada: no inyectado; hay riesgo *probable* de doble inyección en versiones que lean ambos).
- Cuánto del catálogo inyecta Codex por turno (el repo asume matching por `description`, igual que Claude Code — ver §12.3).

---

## 4. Contexto dinámico

### 4.1 El patrón dominante: lectura completa mandatada

`sdd-apply/canonical.md:27` es explícito — *"Read completely before writing code:"* — seguido de **8 fuentes**: proposal.md, tasks.md, design.md, system.md, spec del dominio afectado, `docs/agent_architecture.md` + `docs/doc_verification_guide.md`, `docs/security-checklist.md`, y "Existing implementation files in impacted modules" (sin cota). `sdd-archive/canonical.md:33-35` usa "**Full content** … read completely before making any edit" para tres archivos permanentes que crecen con el proyecto.

**Ningún playbook dice jamás "lee solo la sección X"** — con una única excepción: `sdd-security-gate` lee solo `## Product principles` de system.md. Esa excepción demuestra que la lectura por sección ya es compatible con el diseño; solo falta generalizarla.

### 4.2 Matriz de re-lecturas por ciclo de feature (hallazgo central)

| Artefacto | Lo leen completo | Veces por ciclo |
|---|---|---:|
| `proposal.md` | ff, apply, code-review, security-gate, ux-gate, commit, verify, archive | **8** |
| `openspec/specs/system.md` | new, ff, apply, code-review, security-gate*, ux-gate, archive | **7** (*1 parcial) |
| `docs/security-checklist.md` | enrich-us, new, ff, apply, security-gate, archive | **6** |
| `tasks.md` | apply (+re-edición tras **cada** tarea), code-review, security-gate, ux-gate | **4 + churn** |
| `testing-report.md` | code-review, security-gate, ux-gate, verify | **4** |
| `docs/doc_verification_guide.md` | ff, apply (×3 usos), code-review, verify (×3 usos) | **4** |
| **Superficie de implementación completa** | code-review ("All files listed as created/modified"), security-gate (ídem), ux-gate (subset frontend), commit (`git diff main...[branch]` completo) | **4 pasadas post-código** |

Además: los reportes alimentan reportes (ux-gate lee code-review-report.md; verify lee security-gate-report.md; archive lee verification-report.md). Y `sdd-enrich-us` **emite la proposal completa en el chat** por diseño, que luego `sdd-new` re-persiste — el mismo contenido pagado dos veces en fases distintas.

### 4.3 Qué debería cargarse completo vs. por fragmento

**Completos (correcto hoy)**:
- `proposal.md` y `tasks.md` del ticket activo — son el contrato; fragmentarlos es riesgoso.
- `docs/security-checklist.md` — está *diseñado* para leerse entero (~900 tok).

**Por fragmento (hoy se leen enteros)**:
- `system.md` — estructura H2 plana, perfectamente anclable; es el archivo "flywheel" que sdd-archive hace crecer para siempre. El hotspot futuro #1.
- Specs de dominio — frontmatter + H2 por concern.
- Reportes de gates anteriores — solo se necesita veredicto + blockers; `lib.js` ya demuestra cómo (`extractVerdict` hace substring-match).
- Superficie de implementación en los gates — diff-scoped, no file-scoped.

**Hallazgo positivo verificado**: `docs/manual-sdd-agentic-engineer.md` (~11.2k tok) y `docs/sdd-workflow.md` (~5.1k tok) — el 79% de `docs/` en bytes — **NUNCA entran al contexto del agente**: ningún playbook, ni CLAUDE.md, ni AGENTS.md los referencia. Son docs humanos. (Nota menor: sdd-workflow.md afirma que system.md "se carga como contexto" al inicio de sesión — es inexacto; solo CLAUDE.md se carga.)

---

## 5. Skills y herramientas

- **Carga**: el modelo es correcto de base — catálogo (frontmatter) siempre, cuerpo solo al invocar. El cuerpo de cada skill son 1.0–2.5k tok (sdd-archive el mayor: 9.9 KB ≈ 2.5k). **Las skills ya son lazy-loaded** — el fix no es la carga, es la mitad duplicada del catálogo y la grasa de las descripciones.
- **Problema 1 — catálogo duplicado (solo Claude Code)**: `sync.js:241-250` escribe los mismos 10 flujos como comandos Y como skills; ambos se registran. Observado en sesión: cada `sdd-*` listado dos veces. Costo: ~1.9k tok/turno cuando bastarían ~1.0k. En el repo dogfood existe porque se generan artefactos para ambos harnesses; en un consumidor Claude-only es puro desperdicio.
- **Problema 2 — descripciones infladas**: 619–808 caracteres por descripción (medido en frontmatter canónicos), promedio 89.9 palabras, dominadas por 12–16 frases gatillo citadas con duplicados de acento. `sync.js` no impone tope alguno.
- **Problema 3 — redundancia skill↔contexto base**: la regla 3 de CLAUDE.md ("ambigüedad → detente") se re-declara dos veces dentro del cuerpo de sdd-apply; la regla 4 (tests primero) también; el árbol `openspec/` se re-describe en cada Context.
- **Problema 4 — templates embebidos**: 7 playbooks embeben templates verbatim de sus reportes (~50% del cuerpo de sdd-new). Ese texto se paga tres veces: en el cuerpo del skill, al generar el reporte, y cuando fases posteriores re-leen el reporte.
- **Mayor riesgo de consumo**: `sdd-apply` (bucle TDD sin tope + 8 lecturas completas + verificación por tarea), `sdd-archive` (triple verificación del mismo contenido: full read → re-read post-move de cada ADR → `git diff --cached` por archivo), y los 3 gates en cadena (4 pasadas sobre la misma implementación).
- **Nota sobre las copias en disco**: las 4 copias por playbook no cuestan tokens por turno directamente, pero un agente que lea `canonical.md` en vez del artefacto generado paga ~2× (contiene cuerpo inglés + español separados por `<!-- END_SKILL -->`).

---

## 6. Bucles agentic / TDD

**Hallazgo verificado por grep exhaustivo: cero límites numéricos en los 10 playbooks.**

| Bucle | Instrucción literal | Límite |
|---|---|---|
| TDD por tarea (apply) | "Never mark a task complete without its verification passing" | **Ninguno** — retry-until-green implícito |
| `loom validate` (new) | "If it reports issues, fix proposal.md and re-run" | **Ninguno** |
| `loom validate` (commit) | "fix the reported issues and re-run it" | **Ninguno** |
| Q&A (enrich-us) | "ask as many questions as needed **(no artificial limit)**" | **Ninguno, explícitamente** |
| Gates fallidos (review/security/ux) | veredicto FAIL → arreglar → re-correr el gate entero (re-leyendo todo) | **Ninguno** |

- **Política de stop existente**: solo cualitativa y human-in-the-loop — "STOP si hay ambigüedad", "stop si status incorrecto", veredictos que bloquean fases siguientes. Buenas para *corrección*; ninguna se dispara por *costo* (N intentos, N tokens, N minutos).
- **Subagentes**: no existen en ningún playbook; sdd-commit los prohíbe explícitamente ("never delegate to an external skill"). Esto elimina el riesgo de subagentes re-leyendo contexto desde cero, pero todo se acumula en una sola ventana por fase, y los gates "paralelos" (security + ux) son sesiones separadas que re-leen el mismo contexto cada una.
- **Riesgo real**: un test flaky o un error de entorno puede producir 5–10 ciclos rojo-verde, cada uno pegando el output completo al historial y re-pagando todo el prefijo.

---

## 7. Outputs de herramientas

**Confirmado leyendo todo el código del framework: no existe ninguna persistencia de logs, compactación, summarización ni truncado.** Cero `slice()`, cero "and N more", cero límites de tamaño. Ningún playbook instruye limitar o resumir output de comandos.

Matices:

- **El CLI propio es compacto por diseño, no por truncado** — lo mejor del framework: `loom validate` éxito = 1 línea; fallo = 1 línea por issue; `loom status` = digest fijo de ~15 líneas pensado como la alternativa low-token a leer los artefactos. Este es el patrón a extender.
- **Los comandos del proyecto consumidor no tienen nada**: format/lint/test/regresión son placeholders de `doc_verification_guide.md` que se ejecutan crudos. `sdd-apply` los corre **por tarea** más 4 gates de cierre; `sdd-verify` además **re-corre deliberadamente todo** post-merge ("Re-run those negative tests … do not just trust the pre-merge report") — cada corrida entra completa al historial.
- **Trampa medida empíricamente**: `npm test` en `framework/` sin `npm ci` previo emite **~302 líneas** (12 stacktraces idénticos de `ERR_MODULE_NOT_FOUND: gray-matter`).
- **`git diff main...[branch]` en sdd-commit** carga el diff completo de la feature al contexto para redactar el PR — la 4ª pasada sobre código ya leído tres veces.

### Estrategia recomendada (contrato de salida de un wrapper `loom run`)

Devolver al modelo **solo**: exit code · comando ejecutado · conteos (pass/fail/skip) · **solo los tests fallidos** con su assertion · stacktrace recortado a primeros N frames *del proyecto* (filtrar `node_modules`) · warnings deduplicados con contador (`×12`) · archivos afectados · ruta al log completo en disco (`.specloom/runs/<id>/full.log`).

**Regla de oro: verde = 1 línea** ("✅ 135 passed, 3.2s, log: …"). El agente lee el log completo bajo demanda con grep si lo necesita — casi nunca lo necesitará.

---

## 8. Prompt caching

| Estado | Detalle |
|---|---|
| **Confirmado (nivel producto)** | Claude Code usa prompt caching de Anthropic automáticamente: system prompt + prefijo de conversación, TTL ~5 min, lecturas ~0.1× del precio. Codex se beneficia del prefix caching automático de OpenAI (descuento distinto, ~50% en muchos modelos, retención propia). |
| **No verificable** | Hit-rates reales de tus sesiones — no hay telemetría en el repo ni transcripts que lo expongan. Parámetros exactos vigentes de OpenAI. |
| **Diseño actual** | Razonablemente cache-friendly sin saberlo: CLAUDE.md/AGENTS.md y catálogo estables intra-sesión (prefijo estático ✓); conversación append-only (✓). |

**Qué degrada el cache hoy**:
1. Pausas humanas >5 min entre turnos (comunes en enrich-us, aprobaciones, confirmación de `rm -rf` en archive) → el turno siguiente re-lee el historial sin cache.
2. Sesiones nuevas por comando — cada `/sdd-*` en sesión fresca re-paga el fijo.
3. El costo dominante es el historial acumulado: el caching lo abarata (0.1×) pero no lo elimina — 150k tokens de historial siguen costando ~15k-equivalentes por turno *con* cache perfecto.

**Recomendaciones de diseño (portables a ambos harnesses)**: mantener kernel y catálogo estables y primero; **no** meter contenido volátil (fechas, estado del ticket, ramas) en el contexto base ni en descripciones de skills; encadenar fases en ventanas <5 min cuando sea posible; y sobre todo **reducir el volumen que se cachea** — el cache abarata, no absuelve. Antes del bloque cacheable: system prompt, kernel, catálogo. Después: context-packet del change, outputs, historial reciente.

---

## 9. Estimación de consumo por escenario

**Supuestos declarados**: ~4 chars/token; harness base ~10–15k tok (no verificable exacto); fijo SpecLoom ~3.4k (Claude Code con catálogo duplicado); proposal/tasks/design de feature pequeña 1–2k c/u; specs/docs en tamaño actual de este repo (cota inferior — en consumidores maduros multiplicar specs ×2–5); output de suite de tests 0.5–3k verde, 3–10k con fallos; cifras = input por turno sin ajustar por cache.

| Escenario | Tokens input estimados | Principales fuentes | Riesgo |
|---|---:|---|---|
| 1. Turno simple sin leer archivos | 13k–18k | harness + fijo SpecLoom (~3.4k) | Bajo |
| 2. Turno SDD leyendo proposal/tasks/specs | 25k–40k | 8 lecturas mandatadas de sdd-apply (~8–12k) + cuerpo skill + fijo | Medio |
| 3. Turno con tests fallidos | 35k–60k | ídem + outputs de fallo (3–10k por corrida) pegados al historial | Alto |
| 4. Turno con outputs largos (regresión, diff completo, trampa npm) | 50k–90k | `git diff main...`, re-runs de verify, 302 líneas de stacks | Alto/Muy alto |
| 5. Sesión de 20–30 iteraciones (apply completo) | 80k–150k por turno tardío; 1.5M–3M acumulados | historial acumulado (dominante) + re-runs por tarea | Muy alto |
| 6. Sesión problemática (retries + gates re-corridos) | 100k–200k+ por turno; puede forzar auto-compactación del harness | loops sin tope × outputs sin compactar × re-lecturas | Muy alto |

Estructura de costo clave: en sesiones largas, **el historial es >70% del input por turno** — compuesto principalmente de (a) archivos leídos enteros y (b) outputs de tests. Por eso el ranking de §11 pone esos dos primero.

---

## 10. Simulación end-to-end del flujo SDD

**Caso ficticio (simulación razonada, sin tocar archivos)**: `PROJ-42-validar-email` — validación de formato de email en el registro. 6 tareas, 1 test que falla una vez, ciclo completo enrich → archive.

| Paso | Acción simulada | Contexto leído | Tokens est. | Riesgo | Mejora recomendada |
|---|---|---|---:|---|---|
| 0 | Arranque de sesión | harness + CLAUDE.md + catálogo (×2 listado) | 13,000–18,000 | Bajo | kernel + catálogo único: −1.5–2k/turno × todos los turnos |
| 1 | `/sdd-enrich-us` — skill + docs obligatorios | cuerpo skill (1.4k) + agent_architecture (0.8k) + security-checklist (0.9k) | 3,100 | Bajo | OK — checklist está diseñado para leerse entero |
| 2 | Q&A iterativo (3–6 rondas, "no artificial limit") + inspección de código + proposal completa **eco en chat** | historial creciente + 2–4k de código + 1.5k proposal | 15,000–30,000 acum. | Medio/Alto | tope de rondas; pausas >5min matan cache |
| 3 | `/sdd-new` — system.md + spec dominio + checklist + draft; loop `loom validate --proposal` | 1.5k + 1k + 0.9k + 1.5k; validate = 1 línea/issue ✓ | 12,000–18,000 | Medio | no re-leer lo que enrich ya leyó |
| 4 | `/sdd-ff` — 7 fuentes + código existente → tasks.md | proposal + system.md + 3 docs + código (3–8k) | 18,000–30,000 | Medio/Alto | context-packet en vez de 2ª lectura de system.md/checklist |
| 5 | `/sdd-apply` — "Read completely" ×8 | 8 fuentes ≈ 8–12k antes de escribir código | 25,000–40,000 | **Alto** | el packet reemplaza 5 de las 8 lecturas |
| 6 | Tareas 1–6: test→código→verificación **por tarea** + re-edición de tasks.md ×6 | 6 corridas de test (0.5–3k c/u) al historial | +6,000–15,000 | **Alto** | wrapper: verde = 1 línea → −80–90% de este bloque |
| 7 | **Test falla** (tarea 4): output completo + stacktrace | 3–10k de output | +5,000–12,000 | **Muy alto** | solo fallidos + stack ≤40 líneas + ruta a log |
| 8 | Corrección + 2º intento + gates de cierre (format/lint/test/regresión) | re-run + 4 comandos (2–8k) | +8,000–15,000 | **Muy alto** | tope de retries; cada retry re-paga prefijo |
| 9 | testing-report.md + resumen | template ya pagado en cuerpo del skill | +1,500 | Bajo | — |
| 10 | `/sdd-code-review` — re-lee proposal, tasks, testing-report, system.md, 2 docs + **toda la implementación** | 5–15k | 20,000–35,000 | **Alto** | revisar sobre el **diff**; veredictos vía `loom status` |
| 11 | `/sdd-security-gate` — **2ª pasada completa** + 4ª lectura de proposal | 5–15k | 20,000–35,000 | **Alto** | diff-scoped + packet |
| 12 | `/sdd-commit` — 6ª lectura de proposal + `git diff main...` **completo** + PR body | diff 3–15k | 15,000–30,000 | Alto | `--stat` + secciones relevantes; PR body desde el packet |
| 13 | `/sdd-verify` — **re-corre** suite + negativos + regresión completa | outputs 5–20k | 20,000–50,000 | **Muy alto** | la re-corrida es correcta; su *output* no debe entrar entero |
| 14 | `/sdd-archive` — "Full content" ×3 + re-read ADRs post-move + `git diff --cached` por archivo | crece con la edad del proyecto | 15,000–30,000 | Alto (creciente) | única fase que justifica full reads; eliminar la triple verificación |

### Consumo acumulado por escenario

| Flujo | Tokens input por iteración activa | Ciclo completo (acum.) | Causa principal |
|---|---:|---:|---|
| Ideal optimizado | 8k–18k | ~150k–300k | packet + wrapper de outputs + gates diff-scoped |
| Actual probable | 25k–60k | ~400k–800k | re-lecturas ×8 + outputs crudos + historial |
| Problemático | 60k–150k+ | 1.5M–3M+ | retries sin tope × outputs largos × gates re-corridos enteros |

### Puntos exactos de mejora

- **Optimizar primero**: pasos 6–8 (outputs de tests en apply/verify) — mayor volumen, menor riesgo de precisión, cero cambio semántico del flujo.
- **Mayor aportador de tokens**: outputs de test/regresión repetidos; segundo: la superficie de implementación leída 4×.
- **Resumen persistente**: veredictos y hallazgos de cada gate (hoy cada gate re-deriva el estado leyendo reportes enteros; `loom status` ya extrae los veredictos).
- **Fuera del historial**: logs completos de comandos (a disco), el eco de la proposal en chat de enrich-us, el diff completo en commit.
- **Cacheable**: kernel + catálogo (ya lo es); el context-packet si es estable durante la fase.
- **Bajo demanda**: system.md por sección, cuerpos de ADR (ya lo están ✓), reportes de gates previos (solo veredicto), manual y sdd-workflow (ya lo están ✓).

**Trade-offs de la versión optimizada**: −50–70% de input por ciclo; velocidad igual o mejor (menos relectura). Riesgos: resumen de test que oculte el error real (mitigación: log completo a un grep de distancia) y packets desactualizados (mitigación: regenerarlos al cerrar cada fase, validados por `loom`).

---

## 11. Ranking de causas probables (ajustado a la evidencia)

| # | Causa | Evidencia | Impacto | Solución |
|--:|---|---|---|---|
| 1 | **Re-lectura completa de los mismos artefactos en cada fase** | proposal 8/10 playbooks, system.md 7/10, checklist 6/10, implementación 4× post-código; "Read completely"/"Full content" literales | Muy alto (multiplicador de todo el ciclo) | context-packet + gates diff-scoped + veredictos vía `loom status` |
| 2 | **Outputs de tests/regresión sin compactación** | cero lógica de truncado en todo el código (confirmado); verificación por tarea + cierre + re-run deliberado en verify; trampa de 302 líneas medida | Muy alto (domina el historial en apply/verify) | wrapper `loom run`, verde=1 línea |
| 3 | **Loops sin límite numérico** | grep exhaustivo: 0 topes; "no artificial limit" literal en enrich-us; 3 loops fix-and-rerun sin cota | Alto (cola pesada: las sesiones malas son las caras) | retries máx. 2–3 + stop/report |
| 4 | **Historial acumulado en ventana única** | sin subagentes ni handoffs; todo el ciclo de una fase en una conversación | Alto | packets + sesiones por fase + compactación proactiva |
| 5 | **Catálogo de skills duplicado + descripciones infladas** (Claude Code) | observado en sesión (cada sdd-* listado 2×); ~1.9k/turno vs ~1k necesario | Medio (pequeño pero en el 100% de los turnos) | render skills-only para Claude + recortar descripciones |
| 6 | **CLAUDE.md/AGENTS.md con TODOs y tabla redundante** | 5 secciones placeholder + tabla que duplica el catálogo; ~40–55% recortable de 1.5k c/u; en dogfood se paga en ambos harnesses | Bajo/Medio | llenar como kernel mínimo (no borrar) |

Confirmación de la restricción del encargo: **CLAUDE.md/AGENTS.md no son el problema principal** — son la causa #6 de 6. El costo está en el flujo, no en el prefijo.

---

## 12. Compatibilidad con Codex

**La gran mayoría de los arreglos son compatibles con Codex por construcción**: los playbooks canónicos y el CLI `loom` son agnósticos al harness, y `sync` solo decide dónde renderizar. El propio repo lo confirma (`framework/README.md:8`): skills escritas idénticas en `.claude/skills/` y `.agents/skills/`, "mismo formato abierto Agent Skills, dos rutas de escaneo", y "el matching implícito de **ambos** agentes depende de la `description` del frontmatter".

### 12.1 Clasificación arreglo por arreglo

| Arreglo | Compatibilidad con Codex |
|---|---|
| Wrapper `loom run` (compactación de outputs) | ✅ 100% agnóstico — binario CLI; Codex lo ejecuta por shell igual. El mayor impacto del plan es totalmente portable |
| Topes de retries/loops + stop/report | ✅ Agnóstico — texto de playbooks canónicos; ambos harnesses reciben el mismo cuerpo vía sync |
| Context-packet.md por change | ✅ Agnóstico — convención de archivos + instrucciones de playbook |
| Spec index / lectura por anchors | ✅ Agnóstico — Claude Code lee parcial con Read offset/limit; Codex con `sed`/`rg` |
| Gates diff-scoped, veredictos vía `loom status` | ✅ Agnóstico |
| Token budget en `config.yaml` | ✅ Agnóstico |
| Recorte de descripciones de skills | ✅ Agnóstico y **doblemente beneficioso** — el frontmatter canónico alimenta ambos renders |
| Kernel de contexto base | ✅ Con variante por harness — aplica a CLAUDE.md **y** AGENTS.md; corrige de paso la asimetría de templates (6.1 KB Codex vs 2.7 KB Claude) |
| Catálogo duplicado (`.claude/commands/`) | ⚠️ Solo aplica a Claude Code — Codex nunca usa `.claude/commands/`; el fix es del render de sync para Claude |
| AGENTS.md raíz | ⚠️ **Necesario para Codex** (dogfooding y consumidores Codex) — el arreglo es kernel-izarlo y llenarlo, no borrarlo; idealmente generado/verificado desde fuente única junto a CLAUDE.md |
| Prompt caching / prefijo estable | ⚠️ Diseño portable, economía distinta: Anthropic ~0.1× lecturas / TTL ~5 min; OpenAI descuento distinto (~50%) y retención propia. Recalibrar umbrales por proveedor |
| Telemetría (P0) | ⚠️ Mitad y mitad: el `usage.json` del wrapper es agnóstico; el postproceso de transcripts necesita un adaptador por harness (JSONL de Claude Code vs sesiones de Codex) |

### 12.2 Conclusión práctica

El plan de fases (§17) no necesita bifurcarse. Fases 1–4 y 6 son idénticas para ambos harnesses (viven en canonical + CLI). Solo la Fase 5 tiene trabajo por-harness: en Claude Code "commands fuera + descripciones cortas"; en Codex solo "descripciones cortas + AGENTS.md kernel". El baseline de la Fase 1 conviene correrlo **en ambos harnesses** desde el inicio.

### 12.3 No verificable en Codex

1. Comportamiento exacto de carga de Codex (el repo *asume* lazy-loading por `description` igual que Claude Code; verificar con una sesión real cuánto catálogo inyecta por turno).
2. Parámetros vigentes de caching de OpenAI.
3. Si Codex trunca outputs de shell por su cuenta y con qué umbral (afecta cuánto del beneficio del wrapper ya está "gratis").

---

## 13. Quick wins

```txt
1. Wrapper `loom run <clave-verificación>`: log completo a .specloom/runs/, al modelo solo
   exit code + fallos + stack ≤40 líneas + ruta al log. (mayor impacto único; agnóstico)
2. Tope de retries TDD = 2 y de loops fix→validate = 3, con stop/report, en los playbooks canónicos.
3. sync configurable: `--claude-render skills|commands|both` (default `skills`) → catálogo único
   en Claude Code. El repo dogfood puede mantener `both` temporalmente para comparar triggering.
4. Recortar descripciones de skills a 1 frase + ~5 gatillos (sin pares de acentos): −~50% del
   catálogo, beneficia a ambos harnesses.
5. LLENAR CLAUDE.md Y AGENTS.md del repo (dogfood): el "Qué es specloom" real está en el README;
   stack = Node 20 + node --test; tabla de comandos → 1 línea que apunte al catálogo.
   No borrar AGENTS.md — es el contexto de las sesiones Codex de auto-mejora.
6. Check de drift CLAUDE.md↔AGENTS.md en `loom validate`/spec-lint (ya divergieron; se editan
   a mano en paralelo durante el propio ciclo SDD).
7. Regla "sección/grep antes de lectura completa" para system.md y specs (generalizar lo que
   security-gate ya hace con '## Product principles').
8. Gates y commit leen el diff de la feature, no "all files listed in tasks.md".
9. enrich-us: escribir la proposal a disco y mostrar solo resumen (no eco completo en chat).
10. Guard-rail contra la trampa npm: doc_verification_guide con `npm ci && npm test` o check previo.
```

(“Skills lazy-loaded” no aparece: **ya lo son** en ambos harnesses.)

---

## 14. Propuesta de optimización por prioridad

### P0 — Medición / telemetría

El framework tiene **cero telemetría** (confirmado: ningún contador, ninguna métrica en todo el código). Mínimo viable sin tocar el harness:

- Wrapper `loom run <verification-key>` que registre por invocación: comando, duración, exit code, líneas crudas vs. líneas devueltas al modelo, retry-count (detectando re-ejecución del mismo comando en el mismo run), archivos del change.
- Tokens reales por sesión: los expone cada harness (Claude Code: `/cost` y transcripts JSONL en `~/.claude/projects/…` con `usage` por mensaje, postprocesables; Codex: adaptador propio para su formato de sesiones).

Formato propuesto (`.specloom/runs/<run-id>/usage.json`):

```json
{
  "timestamp": "2026-07-03T12:00:00",
  "command": "sdd-apply",
  "changeId": "PROJ-42-validar-email",
  "step": "task-verification",
  "harness": "claude-code | codex",
  "inputTokens": 12000,
  "outputTokens": 900,
  "cachedInputTokens": 8000,
  "toolOutputTokens": 1300,
  "rawOutputLines": 302,
  "returnedOutputLines": 6,
  "filesRead": ["proposal.md", "tasks.md"],
  "fullFileReads": 2,
  "agentIterations": 4,
  "testRetries": 1
}
```

### P1 — Reducción inmediata (sin cambiar la semántica del flujo)

Los quick wins 1–10 de §13. Impacto estimado combinado: −30–50% en las fases pesadas (apply/verify) + ~2k tok/turno de fijo en Claude Code.

### P2 — Cambios estructurales

`context-packet.md` por change (§15) · índice de specs con anchors (`loom index`) · gates diff-scoped · token budget en `config.yaml` (§16) · veredictos consultados vía `loom status` en vez de re-leer reportes · templates de reportes fuera de los cuerpos de skill (a `framework/templates/reports/`).

### P3 — Avanzadas

Prefijo estable documentado como contrato (nada volátil en kernel/descripciones) · summaries persistentes por fase (el packet actualizado al cierre de cada fase ES el summary) · encadenamiento de fases en ventanas <5 min para cache caliente · política de compactación proactiva: al terminar apply, sesión nueva para los gates con el packet como única herencia · evaluar gates security+ux como agentes paralelos con solo packet + diff (recién tras validar Fases 1–4).

---

## 15. Diseño objetivo de arquitectura de contexto

### `CLAUDE.md` / `AGENTS.md` (kernel, ≤600 tok cada uno, contenido llenado de verdad)

- Qué es el proyecto (2 líneas reales, no TODO)
- Stack real
- Las 8 reglas del agente comprimidas a ~10 líneas
- Una línea: "flujos SDD: usa las skills sdd-*; estado del ciclo: `loom status <ticket>`"
- Punteros a `.specloom/rules/`

En el repo dogfood ambos archivos conviven (Claude Code + Codex); mantenerlos como el **mismo kernel** generado o verificado desde fuente única para eliminar el drift manual.

### `.specloom/rules/` (bajo demanda, referenciadas desde los playbooks que las necesitan)

```txt
.specloom/rules/architecture.md
.specloom/rules/testing.md
.specloom/rules/git.md          ← convenciones de commit/branch/release (hoy ~⅓ de CLAUDE.md)
.specloom/rules/security.md     ← el checklist actual, que ya funciona así ✓
```

### `.specloom/skills/` (o las rutas actuales por harness)

- Cuerpo = comportamiento + reglas de stop + budget de la fase.
- Templates de reportes FUERA del cuerpo → `framework/templates/reports/*.md` (el agente los lee solo al generar el reporte — se paga 1 vez, no 3).
- Descripción = 1 frase + ~5 gatillos canónicos.

### `context-packet.md` por change (generado por sdd-ff, actualizado al cierre de cada fase, ~800–1,500 tok)

```md
# Context Packet — PROJ-42-validar-email
## Goal
(3 líneas)
## Current status
fase actual + veredictos de gates (lo que `loom status` sabe)
## Relevant specs
- system.md#code-conventions
- candidates/spec.md#profile-edition
## Relevant files
(lista cerrada)
## Constraints
(copiadas de proposal.md — el boundary de scope)
## Test commands
(del verification guide, resueltos)
## Token budget
- full file reads: 3
- test retries: 2
- max output lines: 120
```

**Regla nueva de playbook**: los gates y commit leen el packet + el diff; solo apply lee proposal/tasks completos.

### Logs

```txt
.specloom/runs/<run-id>/full.log     ← todo, a disco
.specloom/runs/<run-id>/summary.md   ← lo único que entra al modelo
.specloom/runs/<run-id>/usage.json   ← telemetría
```

### Contexto que recibe el modelo en un flujo normal (objetivo)

kernel (~600) + catálogo (~1k) + cuerpo del skill invocado (~1–1.5k) + packet (~1.2k) + artefacto primario de la fase (~1–2k) + outputs compactados (~0.2–1k) ≈ **5–8k por turno activo** más historial corto.

---

## 16. Token budget configurable

```yaml
tokenBudget:
  fixedContextMax: 1800            # kernel 600 + catálogo ~1000 (post-recorte)
  activeContextTarget: 12000
  activeContextHardLimit: 30000    # sdd-apply legítimamente necesita más que los gates
  maxFullFileReadsPerTask: 3       # proposal + tasks + archivo bajo edición
  maxSpecFullReadsPerTask: 1       # solo sdd-archive puede excederlo (edita specs)
  maxToolOutputLines: 120          # verde = 1 línea; esto es el techo para fallos
  maxStackTraceLines: 40           # primeros frames del proyecto; node_modules filtrado
  maxDiffLinesInContext: 200
  maxTddRetriesPerTask: 2          # al 3er rojo: stop/report con log path
  maxValidateFixLoops: 3           # cubre los loops de sdd-new/sdd-commit
  maxEnrichQuestionRounds: 4       # hoy es "no artificial limit" literal
  maxAgentIterationsPerCommand: 8
contextPolicy:
  defaultReadMode: section-first
  preferIndex: true
  preferContextPacket: true
  summarizeAfterRead: true
  persistSummaries: true
  gateReadScope: diff              # gates revisan el diff, no "all files in tasks.md"
subagents:
  enabledByDefault: false          # ya es la realidad; se declara como decisión
  requireExplicitReason: true
  passContextPacketOnly: true
logs:
  storeFullOutputsOnDisk: true
  injectFullOutputsIntoPrompt: false
sync:
  claudeRender: skills             # skills | commands | both — dogfood puede usar both
                                   # temporalmente para comparar triggering
```

**Advertencia honesta**: estas claves son *instrucciones para el agente* (citadas en los playbooks) más *comportamiento del wrapper* (`maxToolOutputLines`, stacktraces, logs). El framework no puede forzar que el modelo respete `maxFullFileReadsPerTask` — solo el wrapper y la telemetría hacen los límites auditables.

---

## 17. Cambios estructurales — evolución por fases

| Fase | Objetivo | Archivos afectados | Beneficio | Riesgo | Esfuerzo |
|---|---|---|---|---|---|
| 1. Medición | usage.json por comando + postproceso de transcripts (ambos harnesses) | `framework/cli/loom.js`, nuevo `run.js` | baseline real en Claude Code y Codex; valida todo lo demás | bajo | 1–2 días |
| 2. Compactación | `loom run` + contrato de output en playbooks | loom.js, `doc_verification_guide.md`, playbooks apply/verify | −30–50% en apply/verify | resumen que oculte el error (mitigado por log en disco) | 2–4 días |
| 3. Context packet | sdd-ff lo genera; gates/commit lo consumen | playbooks ff/gates/commit, template nuevo, `lib.js` (validarlo) | −40–60% lecturas en fases 5+ | packet desactualizado (mitigar: regenerar al cierre de fase + validación loom) | 3–5 días |
| 4. Spec index | `loom index` → anchors de system.md/specs; playbooks referencian secciones | loom.js, playbooks | contiene el crecimiento del flywheel de system.md | omitir contexto crítico (mitigar: apply mantiene lectura completa) | 2–3 días |
| 5. Catálogo/kernel | `sync --claude-render skills` (default), descripciones cortas, CLAUDE.md/AGENTS.md kernel llenados + check de drift entre ambos | sync.js, canonical frontmatters, templates claude/codex, lib.js | −~2k/turno en Claude Code; −~1k en Codex; elimina drift manual | mis-triggering de skills (probar frases clave en ambos harnesses, el dogfood es el banco de pruebas) | 1–2 días |
| 6. Budget + caching | tokenBudget en config.yaml; prefijo estable como contrato documentado | config.yaml, playbooks, docs | costo predecible; cache-friendliness deliberada en ambos proveedores | complejidad de framework | 2–3 días |
| 7. Subagentes (opcional) | gates security+ux como agentes paralelos con solo packet + diff | playbooks gates | wall-clock y aislamiento de historial | duplicación de lecturas si se hace mal; mecánicas distintas por harness | evaluar tras F1–F4 |

**Nota de gobernanza (propia de SpecLoom)**: ADR-003 declara los playbooks fijos y la regla 8 de CLAUDE.md exige PR + spec-lint para tocar `framework/`. Este rediseño debe entrar **por el propio ciclo SDD del framework** (proposal → gates → PR) — que es exactamente el modo de auto-mejora con el que ya se trabaja. Cada fase es una feature SDD más, y de paso genera el baseline/after de sí misma con la telemetría de la Fase 1.

---

## 18. Riesgos y trade-offs

| Riesgo | Mitigación |
|---|---|
| Resumir de más (el wrapper esconde el error real) | log completo siempre en disco + regla "si el resumen no explica el fallo, lee el log con grep antes de reintentar" |
| Lectura fragmentada que omite contexto crítico | sdd-apply conserva lecturas completas de proposal/tasks; el modo sección aplica a specs de referencia, no al contrato del ticket |
| Cortar retries demasiado pronto | el tope no aborta: dispara stop/report con estado y log; el humano decide continuar (y ese "continuar" resetea el contador conscientemente) |
| Packets desactualizados | regeneración obligatoria al cierre de cada fase; `loom validate` verifica frescura (timestamp vs. artefactos) |
| Cache invalidado por contenido dinámico | prohibir fechas/estado en kernel y descripciones; el packet vive en contexto dinámico, no en el prefijo |
| Drift CLAUDE.md↔AGENTS.md (dogfood dual-harness) | fuente única o check en `loom validate`/spec-lint, mismo patrón que `sync --check` |
| Optimizar para un harness degradando al otro | baseline y validación de cada fase en ambos harnesses desde la Fase 1 |
| Mayor complejidad del framework | cada fase es independiente y aporta valor sola; no hay big-bang |
| Telemetría poco confiable | transcripts del harness como fuente de verdad (traen usage real por mensaje); usage.json del wrapper como proxy operativo |

---

## 19. Plan de implementación paso a paso

```txt
Paso 1: Medir (semana 1)
- Crear framework/cli/run.js: ejecuta comando, guarda .specloom/runs/<id>/full.log,
  emite summary compacto, escribe usage.json (comando, exit, líneas crudas/devueltas, retries).
- Crear scripts/report-usage.js: postprocesa transcripts de Claude Code
  (~/.claude/projects/*/·jsonl → tokens input/output/cache por sesión y por comando sdd-*);
  dejar el adaptador de Codex como stub documentado hasta verificar su formato de sesiones.
- Validar: correr un ciclo SDD dogfood (feature pequeña en el propio framework) EN AMBOS
  harnesses y capturar el baseline. Sin baseline no se puede afirmar mejora.

Paso 2: Compactar outputs (semana 2)
- Cambiar doc_verification_guide.md (template): todos los comandos vía `loom run <clave>`.
- Cambiar playbooks sdd-apply/sdd-verify (canonical → sync a ambos harnesses):
  "ejecuta con loom run; si falla, usa el resumen; lee el log completo solo si el resumen
  no explica el fallo; máx. 2 reintentos por tarea, al 3er rojo STOP y reporta con ruta al log".
- Validar: repetir el ciclo dogfood → esperar −30–50% en tokens de apply/verify vs. baseline.

Paso 3: Context packet (semanas 3–4)
- Crear framework/templates/context-packet.md.hbs.
- Integrar: sdd-ff lo genera; sdd-apply lo actualiza al cierre; gates/commit lo leen
  en lugar de proposal+tasks+system.md completos; lib.js valida presencia/frescura.
- Validar: los gates del ciclo dogfood deben emitir el mismo veredicto que antes
  con −40–60% de input; cualquier divergencia de veredicto bloquea el rollout.

Paso 4: Spec index + kernel + catálogo (semana 5)
- Crear `loom index` (mapa de anchors de openspec/specs/).
- Cambiar sync.js: `--claude-render skills|commands|both` con default skills
  (dogfood puede mantener both temporalmente para comparar triggering).
- Recortar descripciones en los frontmatter canónicos (1 frase + ~5 gatillos).
- LLENAR CLAUDE.md y AGENTS.md del repo como kernel (≤600 tok c/u) desde el contenido
  real del README; agregar check de drift entre ambos a loom validate o spec-lint.
- Validar: sync --check verde; probar auto-trigger de las 10 skills con 3 frases c/u
  en Claude Code Y Codex; medir fijo por turno (objetivo ≤1.8k SpecLoom-owned).

Paso 5: Budget + iterar (semana 6)
- Integrar tokenBudget en config.yaml y citarlo en los playbooks.
- Comparar usage.json/transcripts vs. baseline del Paso 1 en ambos harnesses;
  ajustar topes con datos.
```

---

## 20. Anexo A — Inventario de tamaños medidos (evidencia)

| Archivo | Bytes | Tokens aprox. | ¿Entra al contexto del agente? |
|---|---:|---:|---|
| CLAUDE.md | 5,978 | ~1,500 | Siempre (Claude Code) |
| AGENTS.md | 6,122 | ~1,530 | Siempre (Codex); no observado en Claude Code |
| Descripciones de 10 skills | 6,826 | ~1,710 | Cada turno (catálogo) |
| README.md | 7,769 | ~1,940 | Bajo demanda |
| config.yaml | 2,275 | ~570 | No (placeholder; playbooks aún no lo leen) |
| docs/manual-sdd-agentic-engineer.md | 44,700 | ~11,175 | **Nunca** (0 referencias en playbooks/contexto) |
| docs/sdd-workflow.md | 20,508 | ~5,127 | **Nunca** (0 referencias) |
| docs/doc_verification_guide.md | 4,692 | ~1,170 | 4 playbooks |
| docs/security-checklist.md | 3,594 | ~900 | 6 playbooks |
| docs/doc_architecture.md | 3,836 | ~960 | 2 playbooks |
| docs/agent_architecture.md | 3,052 | ~760 | 2 playbooks (hard-stop en enrich-us si no se puede leer) |
| openspec/specs/system.md | 6,211 | ~1,550 | 7 playbooks (crece para siempre vía archive) |
| openspec/specs/{ci,cli,playbooks}/spec.md | 3–4.6k c/u | ~750–1,160 c/u | Por dominio afectado |
| openspec/specs/adr/ (6 ADRs + índice) | ~29k | ~7,220 | Solo archive (índice basta para numeración) |
| Playbooks canónicos (10) | 64,485 | ~16,120 | Cuerpo del skill al invocar (1.0–2.5k c/u) |
| .claude/commands/ (10) | 50,075 | ~12,520 | Duplican el catálogo en Claude Code |

## Anexo B — Lo que NO se pudo verificar

1. Consumo real de sesiones históricas — no hay telemetría ni transcripts en el repo; las cifras de §9–10 son estimación y simulación razonada.
2. Hit-rate real de prompt caching (existe como comportamiento de producto en ambos proveedores; no medible desde el repo).
3. Tamaño exacto del system prompt de cada harness y comportamiento de otras versiones de Claude Code con AGENTS.md.
4. Mecánica exacta de carga de skills en Codex (el repo asume matching por `description`; verificar con sesión real).
5. Tamaños reales de specs/código en repos consumidores — este repo es la cota inferior; el multiplicador de re-lecturas (causa #1) es lo que escala ese tamaño desconocido.
6. Output real de los comandos de test de consumidores (los del guide son placeholders); única medición empírica: la trampa de `npm test` sin deps (~302 líneas).

Todo lo demás — matriz de re-lecturas, ausencia de topes, ausencia de compactación, duplicación del catálogo, porcentajes recortables del contexto fijo, divergencia CLAUDE.md↔AGENTS.md — es **evidencia observada** con archivo y línea citados.
