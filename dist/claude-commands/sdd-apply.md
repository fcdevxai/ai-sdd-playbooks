# /sdd-apply — SDD Apply — Ejecutar el Contrato

## Objetivo

Ejecutar la spec activa sin improvisar. Implementar las tareas de `tasks.md` en orden, aplicando TDD, respetando el scope de la spec y bloqueando ante ambigüedades.

## Uso

```
/sdd-apply [ticket-slug]
```

## Cuándo ejecutar

Después de `/sdd-ff` y confirmación de tasks.md con `status: ready`.

## Instrucciones al agente

1. Lee completamente `openspec/changes/[ticket-slug]/proposal.md`. Verifica `status: pending`.
2. Lee `openspec/changes/[ticket-slug]/tasks.md`. Verifica `status: ready`.
3. Lee `openspec/changes/[ticket-slug]/design.md` para decisiones técnicas.
4. Lee `openspec/specs/system.md` y los specs del módulo afectado.
5. Lee los archivos de implementación existentes (sibling files) para entender convenciones actuales.
6. Activa los skills relevantes antes de escribir código (laravel-best-practices, inertia-react-development, etc.).
7. Ejecuta `search-docs` para documentación version-specific de los paquetes afectados.
8. Para cada tarea en orden: escribe el test primero → escribe el código → verifica scope → ejecuta el test → márcala `[x]`.
9. Al finalizar todas las tareas: Pint, wayfinder:generate (si aplica), types:check (si aplica), test suite.
10. Genera `openspec/changes/[ticket-slug]/testing-report.md`.

## Checklist

- [ ] `proposal.md` con `status: pending` leído completamente
- [ ] `tasks.md` con `status: ready` leído completamente
- [ ] Skills relevantes activados antes de escribir código
- [ ] `search-docs` ejecutado para paquetes afectados
- [ ] Cada tarea: test escrito primero, luego código
- [ ] Ningún archivo fuera del scope de "Restricciones y non-goals" modificado
- [ ] Todos los tests pasan antes de marcar tarea como `[x]`
- [ ] `vendor/bin/pint --dirty --format agent` ejecutado
- [ ] `php artisan wayfinder:generate` si hubo cambios de rutas
- [ ] `npm run types:check` si hubo cambios TypeScript
- [ ] `testing-report.md` generado con tabla de criterios

## Formato de reporte

`openspec/changes/[ticket-slug]/testing-report.md` con tabla de criterios de aceptación, tareas completadas, comandos ejecutados y veredicto final.

## Criterio de bloqueo

**Si encuentras ambigüedad en la spec → DETENTE → señala el problema → espera instrucción.**

NUNCA improvises fuera de la spec. NUNCA modifiques módulos no listados en "Restricciones y non-goals". NUNCA marques una tarea como `[x]` sin que su test pase.

## Qué NO reemplaza

- La revisión de código humana (el code review detecta problemas que los tests no cubren)
- Las decisiones de arquitectura (deben estar en `design.md` antes de ejecutar)
- El juicio sobre si la spec captura correctamente la necesidad de negocio
