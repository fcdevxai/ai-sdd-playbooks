# Auditoría de consumo de tokens - specloom

**Fecha**: 2026-07-05
**Base auditada**: specloom `main@4638eb4` (v1.2.0)
**Consumer real usado como evidencia**: `athly-loom` (specloom 1.2.0, hub multi-repo: backend Java/Spring, frontend Angular, infra, web)
**Prompt de origen**: `docs/token-consumption-audit-prompt.md`
**Heurística de estimación**: ~4 chars/token.

---

## Resumen ejecutivo

- Las Fases 1–5 del roadmap anterior ya aterrizaron y funcionan: `loom run` compactado redujo outputs de 110–291 líneas a 1 línea en ~20 de los 30 runs reales de athly-loom; el kernel CLAUDE.md/AGENTS.md pesa solo ~2.2KB; las descripciones de skills son cortas (ADR-014). La base está bien; lo que queda es mover **mecánica de agente a CLI**.
- **El mayor gasto restante no está en specloom sino en cómo los playbooks delegan trabajo determinista al agente**: generar `context-packet.md` a mano, promover ADRs a mano, navegar el spec-index a mano. Todo eso es CLI-able.
- **Evidencia crítica del consumer**: el change activo `ath-004-billing-subscription-charges` **no tiene `context-packet.md`** — los 5 consumidores del packet pagarán fallback completo (en el ciclo anterior comparable, ath-005: proposal 14.3KB + tasks 9.7KB ≈ 6K tokens × 5 fases ≈ 30K tokens). El packet solo existe si `sdd-ff` corrió bajo una versión reciente; no hay forma CLI de generarlo/regenerarlo.
- **"Section-first" hoy cuesta casi lo mismo que leer todo**: en athly el índice pesa 17.9KB (JSON pretty-printed) — leerlo entero para ubicar una sección cuesta ~4.5K tokens, comparable a leer `attendance/spec.md` (22.4KB) completo. Falta un comando que imprima la sección directamente.
- **La convención cwd-safe (ADR-011) se viola sistemáticamente en el consumer real**: ~19/30 runs usan `bash -lc cd ../athly-api && ./mvnw ...` porque en un hub multi-repo no hay alternativa — `config.yaml` ya declara `repos[].path` pero `loom run` no lo usa (el propio config.yaml lo dice: *"Playbooks that should eventually read this file (not yet implemented)"*).
- `sdd-archive` es el playbook más grande (10.2KB) y ~40% es mecánica de promoción de ADRs + rituales de verificación git (`git diff --cached`) que existen porque el bug de índice-git-desactualizado ocurrió 3 veces. Un `loom adr promote` elimina el costo y la clase de bug.
- El `openspec/specs/system.md` del dogfood tiene la sección "Run telemetry conventions" **desactualizada** (describe el passthrough de ADR-007 como vigente, contradiciendo `openspec/specs/cli/spec.md` y ADR-009) y conserva tablas placeholder sin llenar (`[entity_1]`, stack con `[e.g., ...]`).
- El dogfood registra los 10 skills **dos veces** por sesión de Claude Code (`.claude/commands/` + `.claude/skills/`, ~450–500 tokens/sesión); athly-loom ya no tiene `.claude/commands/` y no paga esto.
- Los reports repiten texto completo de criterios en tablas; con IDs estables (`AC-N`/`EC-N`/`SEC-N`) los reports de athly (testing 4.6KB + security 4.1KB + code-review 2.9KB) se reducirían ~30–40% sin perder trazabilidad.
- En un consumer backend/frontend end-to-end, el costo dominante futuro son los **touched files leídos completos por 3 gates** (10–30 archivos Java/TS ≈ 12–40K tokens por gate). El mecanismo diff-first (Fase 7 del roadmap) es la mitigación correcta y aún no existe.

## Diagnóstico

El contexto se va en cuatro cubetas, en este orden en un consumer real:

1. **Archivos de implementación leídos completos por cada gate.** `sdd-code-review`, `sdd-security-gate` y `sdd-ux-gate` instruyen "read all files listed as created/modified". En athly eso significa archivos en `../athly-api` y `../athly-frontend`. Tres gates × N archivos completos, sin guía de leer el diff primero.
2. **Cuerpos de playbook.** Los 10 canónicos suman 71.4KB (~18K tokens); un ciclo completo invoca 8–10 skills. Dentro de esos cuerpos hay ~1.5–2KB de párrafos idénticos repetidos entre playbooks: el párrafo packet-fallback (5 playbooks), section-first (6), la regla "visibly contradicts" (5), `pwd`-check (3, dos veces en apply y verify), retry-caps (4). Son prosa que existe para orquestar lecturas — exactamente lo que un comando CLI puede reemplazar por una línea.
3. **Artefactos releídos por fase.** Resuelto a medias por el packet (Fase 3): el diseño es correcto, pero la *generación* es agente-manual (copy-paste verbatim = output tokens, que cuestan ~5× los de input) y no hay backfill para changes en vuelo — ath-004 lo demuestra.
4. **Specs permanentes crecientes.** `attendance/spec.md` ya pesa 22.4KB tras pocas features y `sdd-archive` solo agrega, nunca borra. El índice existe pero la mecánica de uso (leer JSON completo → segundo Read con offset) casi anula el ahorro.

Lo que ya **no** es problema: outputs de comandos (`loom run` compactado funciona — el suite de tests de specloom emite 484 líneas en verde directo vs 1 línea vía `loom run`; `sync --check --target all` son 4 líneas; `status`/`validate`/`index` son compactos), tamaño del kernel, y descripciones de skills.

## Hallazgos priorizados

### P0 - Cambios urgentes

| Hallazgo | Evidencia | Impacto en tokens | Riesgo | Recomendación |
|---|---|---|---|---|
| El context-packet lo genera el agente y no puede regenerarse | `sdd-ff` paso 5 hace copy-paste manual; ath-004 activo sin packet → 5 fases × ~6K tokens de fallback | Muy alto (consumer) | Bajo — contenido 100% derivable mecánicamente | `loom packet <ticket>`: lee proposal+tasks, escribe el packet con secciones verbatim + hashes de fuentes; `sdd-ff` lo invoca en vez de redactarlo |
| system.md dogfood stale y con placeholders | "Run telemetry conventions" describe passthrough ADR-007 como vigente (contradice ADR-009/cli-spec); tablas `[entity_1]`, stack `[e.g., ...]` | Bajo directo, alto indirecto (desinforma y fuerza relecturas) | Nulo | Corregir la sección de telemetría; llenar o podar las tablas placeholder con la realidad de specloom |
| Doble registro de skills en el dogfood | `.claude/commands/` (10) + `.claude/skills/` (10) → 20 entradas por sesión Claude Code; athly no tiene commands | Medio (~450–500 tokens × cada sesión) | Bajo — ADR-013 ya hizo skills el default | Eliminar `.claude/commands/` del dogfood y dejar de sincronizarlos ahí (mantener el target para quien lo pida) |

### P1 - Alto impacto

| Hallazgo | Evidencia | Impacto en tokens | Riesgo | Recomendación |
|---|---|---|---|---|
| Section-first requiere leer el índice completo | Índice athly 17.9KB pretty JSON ≈ 4.5K tokens vs sección típica <1K; dos Reads por consulta | Alto (crece con nº de specs) | Bajo | `loom spec-read <file>#<anchor>` que imprime solo el cuerpo de la sección; el índice pasa a ser detalle interno del CLI |
| Promoción de ADRs es mecánica agente-manual | `framework/playbooks/sdd-archive/canonical.md` pasos 5.1–5.7 + reglas duplicadas; bug git-index repetido 3× | Medio-alto por archive + elimina re-verificaciones | Medio-bajo (automatiza git; mitigable con `--dry-run` y tests) | `loom adr promote <ticket> [--dry-run]`: numera, mueve, regenera README, actualiza supersession, verifica staged == disco |
| Orquestación de lecturas duplicada en prosa | Párrafos idénticos packet-fallback ×5, section-first ×6, "visibly contradicts" ×5 | Alto (por invocación de skill, cada ciclo) | Medio (cambio de semántica de fallback) | `loom context <ticket> --for <fase>`: imprime packet válido (hash-checked) o fallback; los 3 párrafos se vuelven 1 línea por playbook |
| Reports repiten texto completo de criterios | Templates: `\| 1 \| [criterion from proposal.md] \| ...`; reports ath-005 = 11.7KB total | Medio (×3 reports × cada feature, y releídos por verify/commit) | Bajo | IDs estables `AC-N`/`EC-N`/`SEC-N` asignados en proposal; tasks/reports/gates referencian el ID, no el texto |
| Multi-repo fuerza el anti-patrón `cd` | ~19/30 runs athly: `bash -lc cd ../athly-api && ./mvnw ...`; `runGateCheck` ya spawnea en repo dir | Bajo directo, alto en fricción/retries | Bajo (reusa `loadConfig` + spawn existente) | `loom run --repo <name> -- <cmd>` con cwd = `repos[].path` de config.yaml; opcional `--verification <key>` para usar el comando declarado |
| Gates leen archivos completos en vez del diff | Playbooks: "read all files created/modified"; consumer backend: 10–30 archivos × 3 gates | Muy alto (consumer end-to-end) | Medio (un diff puede ocultar contexto de seguridad) | `loom changed-files <ticket>` (+ diff por archivo vía git) y regla "diff primero; archivo completo solo si el diff toca superficie sensible o no basta" |

### P2 - Mejoras incrementales

| Hallazgo | Evidencia | Impacto en tokens | Riesgo | Recomendación |
|---|---|---|---|---|
| Sin modo JSON en status/validate/list | `framework/cli/loom.js`: solo texto; outputs ya compactos | Bajo | Nulo | `--json` en `status`/`validate`/`list` para automatización sin parsing frágil |
| Índice verboso | Pretty-print 2-espacios, campos `anchor`+`lineStart`+`lineEnd` | Bajo (interno si spec-read aterriza) | Nulo | Compactar solo si spec-read no se implementa |
| Docs de humanos scaffoldeados junto a docs de agentes | `manual-sdd-agentic-engineer.md` 44.7KB + `sdd-workflow.md` 20.5KB en `docs/` de cada consumer | Bajo (solo si un agente los lee por error: ~16K tokens) | Nulo | Moverlos a `docs/human/` o anotar en kernel que no son material de agente |
| security-checklist dogfood con filas TODO placeholder | `docs/security-checklist.md` tabla con `[e.g., ...]` | Bajo | Nulo | Podar a las superficies reales (workflows CI ya está) |
| `sdd-enrich-us` pide inspeccionar el codebase sin acotar | "inspect the existing codebase when relevant" sin límite de scope | Medio en consumers grandes | Bajo | Acotar: grep dirigido a endpoints/contratos mencionados, no exploración abierta |
| `.specloom/runs/` crece sin retención | 30 dirs / 792KB tras ~1.5 features en athly | Nulo (disco, no tokens) | Nulo | `loom runs prune --keep N` eventual |

## Propuesta de arquitectura objetivo

**El CLI como compresor y cacheador de contexto; los playbooks como política, no mecánica.**

1. **Toda transformación determinista de artefactos vive en `loom`**: generar packet, promover ADRs, extraer secciones, listar archivos cambiados. El agente decide *qué* hacer; el CLI hace *cómo*.
2. **Una llamada = el contexto mínimo de la fase**: `loom context <ticket> --for security` imprime exactamente lo que ese gate necesita (packet verificado por hash + punteros), en vez de 3 párrafos de instrucciones de lectura por playbook.
3. **Artefactos con identidad estable**: criterios con IDs (`AC-N`), packets con hashes de fuentes, runs con run-ids. Los reports referencian, nunca repiten. La trazabilidad mejora (un ID es más greppeable que texto parafraseado).
4. **Lectura por sección y por diff como default**, lectura completa como derecho reservado de `sdd-apply`, `sdd-archive` y del security gate cuando lo justifique.
5. **Consumers multi-repo como caso primario, no excepción**: `config.yaml` `repos` alimenta `loom run --repo`, `changed-files` y los gates — hoy solo lo lee `gate-check`.

## Cambios concretos propuestos

1. Corregir `openspec/specs/system.md` (sección telemetría → ADR-009) y llenar/podar placeholders del dogfood.
2. Eliminar `.claude/commands/` del repo dogfood (los consumers ya operan solo con skills).
3. Implementar `loom packet <ticket>` y cambiar `sdd-ff` paso 5 a invocarlo; correrlo como backfill en `ath-004`.
4. Añadir IDs estables a los templates de proposal (`AC-N`, `EC-N`, `SEC-N`) y actualizar templates de reports para referenciarlos.
5. Implementar `loom spec-read`, `loom context --for`, `loom adr promote --dry-run`, `loom run --repo`, `loom changed-files` (detalle abajo).
6. Regenerar los 10 playbooks reemplazando los párrafos de orquestación por las invocaciones CLI correspondientes (`sync --target all` — lección de la Fase 2).
7. Retomar Fase 6 (token budget en config.yaml + prefijo estable de caching) con la telemetría existente como base.

## Nuevos comandos CLI sugeridos

| Comando | Propósito | Output | Ahorro esperado | Riesgo |
|---|---|---|---|---|
| `loom packet <ticket>` | Genera/regenera context-packet.md desde proposal+tasks (verbatim garantizado + hashes de fuentes) | Packet en disco + 1 línea de confirmación | Muy alto: elimina generación manual (output tokens ×5) y el fallback de changes sin packet | Bajo: contenido 100% mecánico; `validatePacket` ya existe como verificador |
| `loom spec-read <file>#<anchor>` | Imprime solo el cuerpo de una sección de spec usando el índice (regenera si falta) | Cuerpo de la sección, nada más | Alto: 1 llamada Bash de <1K tokens vs índice 4.5K + segundo read | Bajo: índice ya tiene lineStart/lineEnd; fallback a full-read si el anchor no existe |
| `loom context <ticket> --for <fase>` | Bundle mínimo por fase: packet hash-verificado (o fallback explícito), reports previos relevantes, punteros | Texto compacto por fase | Alto: reemplaza ~165 palabras × 5 playbooks + decisión "packet stale" pasa de juicio a hash | Medio: definir bien qué incluye cada fase; empezar con gates |
| `loom adr promote <ticket> [--dry-run]` | Numeración, move, README index, supersession frontmatter, verificación staged==disco | Plan (dry-run) o resultado por ADR | Medio-alto: adelgaza sdd-archive ~40% y elimina el ritual `git diff --cached` | Medio-bajo: automatiza git; `--dry-run` + tests + el status-gate humano se mantiene |
| `loom run --repo <name> [--verification <key>]` | Ejecuta en `repos[].path` de config.yaml con telemetría normal | Mismo resumen compactado actual | Bajo directo; mata el anti-patrón `bash -lc cd` y sus retries | Bajo: reusa spawn de `runGateCheck` |
| `loom changed-files <ticket> [--repo <name>] [--diff]` | Lista archivos cambiados vs main (por repo del hub), opcionalmente con diff acotado | Lista o diffs con cap de líneas | Muy alto en gates de consumers backend/frontend | Medio: gates deben conservar derecho a full-read en superficies sensibles |
| `loom status/validate/list --json` | Output machine-readable | JSON estable | Bajo | Nulo |

## Cambios a skills/playbooks

- **Todos los consumidores del packet** (`sdd-code-review`, `sdd-security-gate`, `sdd-ux-gate`, `sdd-commit`, `sdd-verify`): reemplazar el párrafo packet-fallback + regla "visibly contradicts" por "Run `loom context [ticket] --for <fase>`". Ahorro ~250–350 tokens por cuerpo de skill, y elimina juicio de frescura.
- **Los 6 section-first**: reemplazar el párrafo de índice por "Use `loom spec-read <file>#<section>`".
- **`sdd-ff`**: paso 5 pasa de template+instrucciones de copy verbatim (~1.2KB) a "Run `loom packet [ticket]`". La regla verbatim se vuelve garantía del CLI.
- **`sdd-archive`**: paso 5 completo (7 sub-pasos) → "Run `loom adr promote [ticket] --dry-run`, revisar el plan, confirmar, re-correr sin dry-run". Los pasos 7.2–7.3 y las 2 reglas de staged-content se reducen a una verificación que el comando hace solo. Es el playbook que más adelgaza (10.2KB → ~6.5KB estimado).
- **Gates**: añadir la regla diff-first ("lee el diff de `loom changed-files`; abre el archivo completo solo si el diff toca autorización/ownership/input o no basta para juzgar").
- **`sdd-enrich-us`**: acotar "inspect the existing codebase" a búsquedas dirigidas.
- Mantener intactos: caps de retry, reglas de seguridad, verdicts binarios, y la exclusión de `sdd-apply` de packet/section-first.

## Cambios a artefactos SDD

- **proposal.md**: criterios numerados con IDs estables al aprobar (`AC-1`, `EC-1`, `SEC-1`); congelados al pasar a `status: pending`.
- **context-packet.md**: generado por CLI; añade frontmatter `sources: {proposal: <sha256>, tasks: <sha256>}` — la frescura se verifica mecánicamente.
- **Reports**: tablas referencian `AC-N` + comando/test + run-id de `.specloom/runs/` como evidencia, sin repetir el texto del criterio. La auditabilidad sube: el run-id apunta al log completo.
- **tasks.md**: "Linked acceptance criterion: AC-N" (ya numera; solo estabilizar el formato).
- **ADRs/specs permanentes**: sin cambios de contenido; solo la mecánica de promoción se automatiza.

## Plan de implementación por fases

### Fase 1 - Quick wins (1-3 días)

Corrección de system.md stale + placeholders dogfood; eliminar `.claude/commands/` del dogfood; `loom packet` + integración en `sdd-ff` + backfill de ath-004; IDs `AC-N` en templates de proposal/reports. Cada uno como ticket SDD propio (dogfooding).

### Fase 2 - CLI/context compression (1-2 semanas)

`loom spec-read`, `loom adr promote --dry-run`, `loom run --repo`, `loom changed-files`, `--json`. Tests `node --test` para cada uno; validación antes/después con `report-usage.js` en ambos harnesses.

### Fase 3 - Rediseño estructural (2-4 semanas)

`loom context --for` + reescritura de los 10 canónicos sobre los comandos nuevos (`sync --target all`); gates diff-first; Fase 6 del roadmap original (budget + prefijo de caching); evaluar Fase 7 (gates paralelos con packet + diff) usando athly-loom como banco de pruebas end-to-end.

## Métricas sugeridas

- **Por sesión/skill**: tokens input/output/cache de `framework/scripts/report-usage.js` (ya existe), segmentado por skill detectado — misma feature tipo antes/después en dogfood y en athly-loom.
- **Por run**: `rawOutputLines` vs líneas impresas (ya en usage.json); % de runs con patrón `cd` en `command` (hoy ~63% en athly; objetivo ~0 tras `--repo`).
- **Por artefacto**: bytes de packet vs proposal+tasks; bytes promedio de reports por feature (baseline ath-005: 11.7KB); bytes de cuerpos SKILL.md (baseline: 71.4KB los 10).
- **Por ciclo**: tokens totales de un ciclo `sdd-code-review → sdd-archive` en athly-loom — es exactamente el escenario que motivó la auditoría (30% del presupuesto diario); repetirlo post-Fase 2 es la prueba de éxito.

## Riesgos de compactar demasiado

- **Nunca resumir criterios de aceptación ni security considerations**: la regla verbatim del packet debe sobrevivir cualquier compresión (con `loom packet` pasa de regla de prosa a garantía de código).
- **Diff-first puede ocultar fallas de autorización en código no tocado** (un endpoint sin authz que el diff no muestra): el security gate conserva siempre el derecho a full-read, y la regla debe decirlo explícitamente.
- **IDs por referencia dependen de proposal inmutable post-aprobación**: si la proposal cambia tras aprobar, los IDs bailan — el hash del packet lo detecta, pero la regla "IDs se congelan en `status: pending`" debe quedar escrita.
- **No tocar**: los 4 gates obligatorios, el verdict binario, los caps de retry con stop-and-report, ni la promoción de ADRs con status-gate humano. La automatización de `adr promote` ejecuta mecánica, no decide — `proposed` sigue bloqueando.
- **`loom context` no debe volverse una segunda fuente de verdad**: imprime desde artefactos en disco, nunca sintetiza.

## Conclusión

specloom ya hizo el trabajo difícil (telemetría, compactación, packet, índice, kernel) — la auditoría no encontró gasto estructural nuevo en el framework, sino **mecánica determinista que sigue ejecutando el agente**. La recomendación central es una sola idea aplicada cinco veces: si el playbook describe un procedimiento sin juicio (copiar verbatim, numerar y mover ADRs, ubicar una sección, listar archivos cambiados, entrar a un repo sibling), conviértelo en comando `loom` y deja en el playbook una línea. Empieza por `loom packet` (el consumer real ya está pagando su ausencia en ath-004), sigue con `spec-read` y `adr promote`, y mide el ciclo completo en athly-loom con la telemetría que ya tienes. Con eso, el escenario backend/frontend end-to-end deja de escalar con el tamaño del proyecto y pasa a escalar con el tamaño del diff — que es lo único que un gate necesita ver por defecto.
