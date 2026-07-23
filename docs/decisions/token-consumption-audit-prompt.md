# Prompt - Auditoria de consumo de tokens en specloom

Usa este prompt con diferentes modelos/IA para auditar specloom desde la perspectiva de eficiencia de contexto, consumo de tokens y ergonomia del ciclo SDD.

---

## Rol

Actua como un equipo senior combinado:

- Arquitecto de sistemas Spec-Driven Development.
- Ingeniero experto en LLMs, context windows, prompt engineering y agentic coding.
- Staff engineer con experiencia en DX, CI/CD, monorepos/multi-repos y automatizacion de agentes.
- Revisor pragmatico: prioriza mejoras con alto impacto y bajo riesgo, no recomendaciones teoricas.

Tu objetivo es auditar specloom para reducir consumo de tokens sin perder rigor, trazabilidad ni seguridad del ciclo SDD.

## Contexto del problema

specloom es un framework privado de Spec-Driven Development distribuido como dependencia git/npm. Centraliza playbooks SDD, CLI, templates, Agent Skills y specs permanentes para que repos consumidores ejecuten el ciclo:

proposal -> tasks -> implementation -> gates -> PR -> verify -> archive

En una sesion real, retomar desde `sdd-code-review` hasta `sdd-archive` y cerrar una spec consumio cerca del 30% del presupuesto diario de tokens. Esto ocurrio en el propio repo specloom, con una feature principalmente CLI/docs/tests. Preocupa que en un consumer real con backend + frontend + tests + UI + gates end-to-end el consumo sea mucho mayor.

## Objetivo de la auditoria

Audita el repositorio y entrega recomendaciones concretas para reducir consumo de tokens durante sesiones de agentes, especialmente:

- Lectura repetida de archivos grandes.
- Relectura de specs, playbooks, reports y diffs.
- Verbosidad de outputs de comandos.
- Tamano y estructura de Agent Skills.
- Redundancia entre `proposal.md`, `tasks.md`, `context-packet.md`, reports y permanent specs.
- Secuencias SDD que obligan a pasos largos o duplicados.
- Interacciones que fuerzan al agente a pedir confirmaciones o repetir validaciones.
- Consumo en consumers reales con backend/frontend, no solo en el repo specloom.

## Material a revisar

Revisa, como minimo:

- `AGENTS.md`
- `.agents/skills/*/SKILL.md`
- `framework/playbooks/*/canonical.md`
- `framework/cli/loom.js`
- `framework/cli/lib.js`
- `framework/scripts/sync.js`
- `openspec/specs/system.md`
- `openspec/specs/cli/spec.md`
- `openspec/specs/playbooks/spec.md`
- `openspec/specs/adr/*.md`
- `docs/doc_architecture.md`
- `docs/doc_verification_guide.md`
- `docs/security-checklist.md`
- Uno o mas `openspec/changes/*` activos o archivados, si existen.

Si puedes ejecutar comandos, inspecciona tambien:

```bash
node framework/cli/loom.js status <ticket>
node framework/cli/loom.js validate <ticket>
node framework/cli/loom.js sync --check --target all
node --test framework/cli/test/*.test.js
```

No necesitas modificar codigo salvo que se te pida explicitamente. Esta auditoria debe producir diagnostico y plan.

## Preguntas principales

Responde estas preguntas con evidencia del repo:

1. Donde se esta gastando contexto de forma innecesaria?
2. Que archivos o instrucciones son demasiado largos para estar siempre presentes?
3. Que pasos del ciclo SDD obligan al agente a releer informacion ya conocida?
4. Que comandos generan output excesivo o poco util para el agente?
5. Que reportes podrian ser mas compactos sin perder auditabilidad?
6. Que informacion deberia estar en artefactos machine-readable en vez de Markdown libre?
7. Que datos deberian resumirse, indexarse o cachearse?
8. Que checks pueden pasar de "leer todo" a "leer seccion"?
9. Que tareas pueden automatizarse en CLI para evitar razonamiento repetitivo del agente?
10. Que cambios pueden reducir tokens en consumers backend/frontend end-to-end?

## Areas especificas a evaluar

### 1. Agent Skills y playbooks

Evalua si los skills tienen:

- Instrucciones duplicadas entre skills.
- Reglas demasiado largas o repetidas.
- Secciones que podrian moverse a referencias cargadas solo bajo demanda.
- Contratos de output demasiado verbosos.
- Pasos que fuerzan lecturas completas cuando bastaria una seccion o indice.
- Reglas que podrian ser validadas por CLI en vez de por razonamiento del agente.

Propone una estructura ideal para skills mas pequenos.

### 2. Context-packet e indexacion

Evalua el diseno actual de `context-packet.md` y `.specloom/index/spec-index.json`.

Indica:

- Si el packet deberia tener formato estructurado adicional (`json`, `yaml`, frontmatter, IDs de criterios).
- Si los acceptance criteria deberian tener IDs estables.
- Si los reports deberian referenciar IDs en vez de repetir texto completo.
- Si faltan indices para playbooks, reports, ADRs o touched files.
- Si el packet deberia incluir hashes/timestamps para evitar relecturas.

### 3. Reports SDD

Evalua:

- `testing-report.md`
- `code-review-report.md`
- `security-gate-report.md`
- `verification-report.md`

Busca redundancias y propone versiones compactas.

El objetivo no es quitar trazabilidad, sino evitar que cada fase vuelva a pegar tablas largas o texto completo que ya existe.

### 4. CLI como compresor de contexto

Propone comandos nuevos o mejoras a `loom` que reduzcan tokens.

Ejemplos posibles:

- `loom context <ticket> --for code-review|security|commit|verify|archive`
- `loom evidence <ticket>`
- `loom changed-files <ticket>`
- `loom report-summary <ticket>`
- `loom archive-plan <ticket>`
- `loom adr promote --dry-run`
- `loom validate --json`
- `loom status --json`

Para cada comando sugerido, explica:

- Que input lee.
- Que output compacto entrega.
- Que decision del agente reemplaza.
- Cuanto consumo podria ahorrar.
- Riesgos o trade-offs.

### 5. Output de comandos y telemetry

Evalua `loom run`, `.specloom/runs/<run-id>/full.log` y `usage.json`.

Propone:

- Formatos de resumen mas utiles.
- Enlaces a logs en vez de output bruto.
- Extraccion automatica de errores relevantes.
- Limites de lineas por tipo de comando.
- Modo JSON para agentes.
- Como evitar que tests grandes contaminen el historial.

### 6. Flujo SDD completo

Audita el ciclo:

1. `sdd-enrich-us`
2. `sdd-new`
3. `sdd-ff`
4. `sdd-apply`
5. `sdd-code-review`
6. `sdd-security-gate`
7. `sdd-ux-gate`
8. `sdd-commit`
9. `sdd-verify`
10. `sdd-archive`

Para cada fase indica:

- Inputs minimos necesarios.
- Inputs que hoy probablemente sobran.
- Outputs que podrian compactarse.
- Checks que deberian moverse a CLI.
- Oportunidades de cache/resumen.
- Riesgo de perder rigor si se compacta demasiado.

### 7. Consumer real backend/frontend

Simula mentalmente un consumer con:

- API backend.
- Frontend con componentes/UI.
- Tests unitarios/integracion.
- Seguridad/autorizacion.
- CI.
- Specs y ADRs propias.

Explica donde explotaria el consumo de tokens y que mecanismos deberia proveer specloom antes de usarlo intensivamente en ese escenario.

## Formato de respuesta requerido

Entrega la auditoria con esta estructura:

```markdown
# Auditoria de consumo de tokens - specloom

## Resumen ejecutivo
<5-10 bullets de hallazgos principales>

## Diagnostico
<explicacion de donde se va el contexto y por que>

## Hallazgos priorizados

### P0 - Cambios urgentes
| Hallazgo | Evidencia | Impacto en tokens | Riesgo | Recomendacion |
|---|---|---|---|---|

### P1 - Alto impacto
| Hallazgo | Evidencia | Impacto en tokens | Riesgo | Recomendacion |
|---|---|---|---|---|

### P2 - Mejoras incrementales
| Hallazgo | Evidencia | Impacto en tokens | Riesgo | Recomendacion |
|---|---|---|---|---|

## Propuesta de arquitectura objetivo
<como deberia verse specloom para operar con bajo consumo>

## Cambios concretos propuestos
<lista accionable>

## Nuevos comandos CLI sugeridos
| Comando | Proposito | Output | Ahorro esperado | Riesgo |
|---|---|---|---|---|

## Cambios a skills/playbooks
<propuestas concretas por skill>

## Cambios a artefactos SDD
<proposal/tasks/context-packet/reports/ADRs/specs>

## Plan de implementacion por fases

### Fase 1 - Quick wins
<1-3 dias>

### Fase 2 - CLI/context compression
<1-2 semanas>

### Fase 3 - Redisenio estructural
<2-4 semanas>

## Metricas sugeridas
<como medir antes/despues>

## Riesgos de compactar demasiado
<que no se debe perder>

## Conclusion
<recomendacion final>
```

## Criterios de calidad

La respuesta debe:

- Ser concreta y accionable.
- Citar archivos/secciones del repo cuando sea posible.
- Distinguir quick wins de cambios estructurales.
- No recomendar eliminar gates de seguridad o validacion.
- No sacrificar trazabilidad SDD.
- Priorizar mover trabajo repetitivo del agente al CLI.
- Considerar compatibilidad con consumers existentes.
- Incluir estimaciones cualitativas de ahorro: bajo / medio / alto / muy alto.
- Indicar riesgos de cada recomendacion.

## Restricciones

- No propongas simplemente "usar un modelo con mas contexto".
- No propongas saltarse `sdd-code-review`, `sdd-security-gate`, `sdd-verify` o `sdd-archive`.
- No propongas borrar ADRs, specs permanentes o reportes obligatorios.
- No propongas depender exclusivamente de memoria conversacional del agente.
- Favorece artefactos reproducibles en disco y comandos deterministas.

## Resultado esperado

Quiero un informe que pueda convertir en uno o mas cambios SDD para specloom. El resultado ideal deberia decirme:

- Que cambiar primero.
- Que comandos nuevos construir.
- Que partes de los playbooks adelgazar.
- Que reports compactar.
- Como medir si la reduccion de tokens realmente funciono.
- Como evitar que un consumer backend/frontend end-to-end consuma una fraccion enorme del presupuesto diario.
