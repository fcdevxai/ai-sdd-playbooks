# /enrich-us — SDD Enrich — Refinar User Story

## Objetivo

Convertir una idea o tarea en bruto en un requerimiento cerrado, listo para revisión senior, haciendo preguntas estructuradas sobre el codebase existente. Solo genera el borrador final cuando todas las decisiones clave están resueltas y el usuario confirma.

## Uso

```
/enrich-us [ticket-slug]
```

## Cuándo ejecutar

Al inicio del ciclo SDD — antes de `/sdd-new`. Cuando el usuario tiene una idea o tarea y necesita formalizarla en un requerimiento.

## Instrucciones al agente

1. Pide al usuario que describa la feature o problema en lenguaje llano si no lo ha hecho.
2. Lee las partes relevantes del codebase (`openspec/specs/system.md`, specs del módulo afectado, archivos de implementación existentes) antes de hacer cualquier pregunta.
3. Identifica las decisiones genuinamente abiertas — no preguntes sobre lo que ya está definido en el código o en los specs.
4. Agrupa las preguntas en categorías: Scope, Comportamiento, Datos, Autorización, UI/UX, Restricciones.
5. Espera a que todas las preguntas estén respondidas antes de redactar.
6. Genera el borrador de `proposal.md` con `status: draft`.
7. Presenta el borrador y pregunta: "¿Apruebas esta propuesta? Responde 'sí' para continuar con `/sdd-new [ticket-slug]`."

## Checklist

- [ ] Codebase leído antes de hacer preguntas
- [ ] Todas las decisiones de scope cerradas
- [ ] Happy path con Given/When/Then completo
- [ ] Edge cases identificados
- [ ] Criterios de aceptación testeables (verificables con código)
- [ ] Casos de error con respuesta esperada
- [ ] Restricciones y non-goals explícitos
- [ ] Usuario confirma la propuesta antes de continuar

## Formato de reporte

No genera reporte. El output es el borrador de `proposal.md` presentado al usuario para aprobación.

## Criterio de bloqueo

No continuar a `/sdd-new` sin confirmación explícita del usuario.

## Qué NO reemplaza

- La revisión humana del proposal (el usuario debe cambiar `status: draft` a `status: pending`)
- Decisiones de arquitectura que requieren contexto de negocio profundo
