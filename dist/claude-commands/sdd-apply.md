# /sdd-apply — SDD Apply - Ejecutar el Contrato

## Objetivo

Ejecutar la spec activa sin improvisar. Implementar `tasks.md` en orden, aplicando TDD, respetando el scope de la spec y bloqueando ante ambiguedades.

## Uso

```
/sdd-apply [ticket-slug]
```

## Cuándo ejecutar

Despues de `/sdd-ff` y confirmacion de tasks.md con `status: ready`.

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/proposal.md`. Verifica `status: pending`.
2. Lee `openspec/changes/[ticket-slug]/tasks.md`. Verifica `status: ready`.
3. Lee `openspec/changes/[ticket-slug]/design.md` para decisiones tecnicas.
4. Lee `openspec/specs/system.md` y los specs del modulo afectado.
5. Lee `docs/agent_architecture.md` y `docs/doc_verification_guide.md` para comandos reales del proyecto.
6. Para cada tarea en orden: test/check primero -> codigo -> verifica scope -> ejecuta validacion -> marca `[x]`.
7. Al finalizar todas las tareas: ejecuta formateo/lint/tests segun guia de verificacion del proyecto.
8. Genera `openspec/changes/[ticket-slug]/testing-report.md`.

## Checklist

- [ ] `proposal.md` con `status: pending` leido completamente
- [ ] `tasks.md` con `status: ready` leido completamente
- [ ] Recursos de arquitectura/verificacion del proyecto consultados
- [ ] Cada tarea: test/check escrito primero, luego codigo
- [ ] Ningun archivo fuera del scope de `proposal.md` modificado
- [ ] Todos los checks pasan antes de marcar tarea como `[x]`
- [ ] `testing-report.md` generado con criterios y comandos ejecutados

## Formato de reporte



## Criterio de bloqueo

Si encuentras ambiguedad en la spec -> DETENTE -> senala el problema -> espera instruccion.

Nunca improvises fuera de la spec. Nunca modifiques modulos fuera del scope. Nunca marques una tarea como `[x]` sin verificacion passing.

## Qué NO reemplaza


