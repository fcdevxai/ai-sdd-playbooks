# /sdd-e2e-gate — SDD E2E Gate — Validación de Integración Backend vía Navegador

## Objetivo

Validar que los flujos críticos implementados integran correctamente con el backend real, usando Playwright MCP para conducir el flujo a través de la UI real e inspeccionar peticiones de red, respuestas, sesión/auth y errores de consola. Complementa `sdd-code-review` (cumplimiento técnico/spec) y `sdd-ux-gate` (calidad visual/UX) verificando que los datos fluyen correctamente end-to-end contra el backend real.

Este gate solo aplica a proyectos con interfaz web. Si el proyecto no tiene interfaz web (API REST pura, CLI, worker, etc.), este gate se omite automáticamente.

Este gate requiere que el servidor MCP `playwright` esté registrado en el entorno del agente (`claude mcp add playwright npx @playwright/mcp@latest`, o un scope equivalente de proyecto/usuario). Registrar el MCP es un paso de configuración de entorno único, fuera del control de este comando — este gate solo puede detectar si está disponible, nunca instalarlo. Si no está disponible, no se debe simular ni inventar evidencia de navegador.

## Uso

```
/sdd-e2e-gate [ticket-slug]
```

## Cuándo ejecutar

Después de `/sdd-code-review`. Puede ejecutarse en paralelo o después de `/sdd-ux-gate`, siempre antes de `/sdd-commit`. Solo aplica a proyectos con interfaz web — en proyectos backend-only (APIs REST sin UI) este gate se omite automáticamente.

## Instrucciones al agente

0. Verifica si el proyecto tiene interfaz web (`openspec/specs/system.md` o `CLAUDE.md`). Si no la tiene, genera `e2e-gate-report.md` con nota "N/A - proyecto sin interfaz web" y detente; no bloquees el ciclo SDD.
1. Confirma que el servidor MCP `playwright` está disponible en esta sesión (`claude mcp list`, o revisa si aparecen tools `mcp__playwright__*` como deferred). Si aparecen como deferred, cárgalas con ToolSearch (`select:browser_navigate,browser_snapshot,browser_click,browser_type,browser_fill_form,browser_network_requests,browser_console_messages,browser_take_screenshot`) antes de usarlas. Si el MCP no está registrado, detente: genera `e2e-gate-report.md` con veredicto `BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED` e indica al usuario cómo registrarlo (`claude mcp add playwright npx @playwright/mcp@latest`).
2. Lee `openspec/changes/[ticket-slug]/proposal.md` para identificar flujos críticos y casos de error.
3. Lee `openspec/changes/[ticket-slug]/tasks.md` para identificar rutas/endpoints tocados.
4. Si existe, lee `code-review-report.md` y considera los riesgos técnicos abiertos.
5. Confirma que existe un entorno seguro/aislado para pruebas (`docs/doc_verification_guide.md`) — nunca producción ni base de datos de desarrollo compartida con datos reales.
6. Para cada flujo crítico: navega e interactúa con la UI real usando las tools de Playwright MCP ya cargadas (`browser_navigate`, `browser_click`, `browser_type`/`browser_fill_form`, `browser_snapshot`), captura las peticiones de red con `browser_network_requests` y confirma que la UI refleja la respuesta real del backend.
7. Provoca al menos un caso de error del backend relevante y confirma que la UI lo expone sin fallos silenciosos.
8. Revisa la consola del navegador (`browser_console_messages`) durante el flujo exitoso; no deben aparecer errores inesperados.
9. Genera el reporte en `openspec/changes/[ticket-slug]/e2e-gate-report.md`.

## Checklist

### Aplicabilidad
- [ ] Se confirmó si el proyecto tiene interfaz web
- [ ] Si no tiene interfaz web, reporte marcado N/A y gate no bloqueante

### Playwright MCP disponible
- [ ] Se confirmó que el servidor MCP `playwright` está registrado (`claude mcp list`)
- [ ] Las tools necesarias se cargaron vía ToolSearch si aparecían como deferred
- [ ] Si el MCP no estaba disponible, el gate se marcó `BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED` en vez de simular evidencia

### Entorno seguro
- [ ] El entorno usado es aislado/test, nunca producción ni datos reales
- [ ] Existen credenciales/semillas de prueba para el flujo

### Flujos críticos
- [ ] Flujos críticos identificados desde `proposal.md`/`tasks.md`
- [ ] Cada flujo fue conducido a través de la UI real (Playwright MCP)
- [ ] Las peticiones de red del flujo fueron capturadas (status, payload)
- [ ] La UI refleja la respuesta real del backend (no datos obsoletos o mockeados)
- [ ] Headers/tokens de auth se envían correctamente en rutas protegidas

### Casos de error
- [ ] Al menos un caso de error de backend fue provocado y verificado
- [ ] El error se expone al usuario sin fallo silencioso
- [ ] No hay errores inesperados en consola durante el flujo exitoso

### Evidencia
- [ ] Referencia a peticiones de red relevantes (status, endpoint)
- [ ] Referencia a mensajes de consola (o "sin errores")

## Formato de reporte

`openspec/changes/[ticket-slug]/e2e-gate-report.md` con: entorno usado, aplicabilidad (interfaz web / N/A / bloqueado por MCP), tabla de flujos ejercitados con endpoints y resultado, tabla de casos de error verificados, evidencia (red/consola), issues encontrados con severidad/ubicación/corrección propuesta, y veredicto `READY FOR PR E2E`, `REQUIRES E2E FIXES` o `BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED`.

## Criterio de bloqueo

El servidor MCP `playwright` no está registrado en el entorno → el veredicto es `BLOCKED - PLAYWRIGHT MCP NOT CONFIGURED` (no `REQUIRES E2E FIXES`, ya que es un problema de configuración del entorno, no del código). Nunca simules ni inventes evidencia de navegador en este caso.

El veredicto debe ser `REQUIRES E2E FIXES` si el MCP sí está disponible y se cumple cualquiera:
- Un flujo crítico no llega al backend o la petición falla de forma silenciosa
- La UI muestra datos obsoletos/incorrectos pese a una respuesta exitosa del backend
- Un error del backend no se expone al usuario (fallo silencioso)
- Aparecen errores de consola no manejados durante un flujo supuestamente exitoso
- La sesión/auth no se respeta correctamente (ej. una acción protegida se completa sin auth válida)

## Qué NO reemplaza

- Revisión técnica/spec de `/sdd-code-review`
- Validación visual/UX de `/sdd-ux-gate`
- Verificación de cobertura de criterios de aceptación post-merge de `/sdd-verify`
- Decisión final de PM/negocio sobre adecuación de la feature
