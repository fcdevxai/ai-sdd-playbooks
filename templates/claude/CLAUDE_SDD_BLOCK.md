## Rutas SDD (Spec-Driven Development)

```
openspec/
├── specs/          -> source of truth permanente (NUNCA editar specs archivadas)
│   ├── system.md   -> arquitectura global, convenciones, modelo de datos
│   └── [module]/
│       └── spec.md
└── changes/        -> features en curso (una carpeta por feature activa)
    └── [ticket-slug]/
        ├── OWNER.md
        ├── proposal.md   -> spec de la feature (inmutable una vez APROBADA)
        ├── design.md
        └── tasks.md
```

---

## CodeGraph (intelligence sobre el codebase)

Este repo está indexado por CodeGraph (existe `.codegraph/` en la raíz). **Para entender o localizar código, usar CodeGraph ANTES de `grep`/`find` o leer archivos completos**: una sola llamada devuelve el source verbatim de los símbolos relevantes más los call paths entre ellos, en mucho menos contexto que un ciclo de grep + lectura de N archivos.

- **MCP tools** (si están disponibles): `codegraph_explore` responde la mayoría de las preguntas de código en una llamada (símbolos relevantes + rutas de llamada). `codegraph_node` devuelve el source de un símbolo + sus callers, o lee un archivo completo con números de línea. Si las tools aparecen como *deferred*, cargarlas por nombre vía tool search.
- **Shell** (siempre funciona): `codegraph explore "<símbolos o pregunta>"` y `codegraph node <símbolo-o-archivo>`.

**Cuándo NO usarlo**: para *contar* referencias de forma agregada (`grep -rl ... | wc -l` devuelve un entero y es más barato en tokens). CodeGraph rinde cuando el objetivo es *comprender* o *navegar* relaciones, no cuando solo se necesita un conteo.

---

## Reglas del agente (críticas)

1. **NUNCA modificar archivos fuera del scope de la spec activa** - la sección "Restricciones" de `proposal.md` define el boundary.
2. **SIEMPRE leer `openspec/changes/[feature]/proposal.md` antes de generar código** - los criterios de aceptación son los únicos criterios de éxito válidos.
3. **Si encuentras ambigüedad en la spec -> DETENTE -> señala el problema -> espera instrucción**. No improvises.
4. **Generar tests ANTES o JUNTO al código**, nunca después.
5. **Specs en `openspec/specs/` son inmutables** - si necesitas cambiar una spec archivada, abre una nueva en `openspec/changes/`.
6. **No crear archivos de documentación** a menos que el usuario lo pida explícitamente.

---

## Comandos del ciclo SDD

| Comando | Fase | Qué hace |
|---|---|---|
| `/sdd-enrich-us [ticket]` | Ideación | Enriquece user story, produce `proposal.md` draft |
| `/sdd-new [ticket] [desc]` | Inicio | Crea carpeta `openspec/changes/[ticket]/` con todos los artefactos |
| `/sdd-ff [ticket]` | Planificación | Granulariza `tasks.md` desde la proposal aprobada |
| `/sdd-apply [ticket]` | Implementación | Ejecuta spec activa (TDD, sin improvisar fuera de scope) |
| `/sdd-code-review [ticket]` | Revisión | Revisión automática contra spec |
| `/sdd-ux-gate` | Revisión | `ux-gate-report.md` con veredicto UX/UI (`READY FOR PR UX` / `REQUIRES UX FIXES`) |
| `/sdd-commit [ticket]` | Cierre | Commit estructurado con referencia a spec |
| `/sdd-verify [ticket]` | Cierre | Verifica criterios de aceptación post-PR |
| `/sdd-archive [ticket]` | Cierre | Integra delta en `openspec/specs/`, limpia `openspec/changes/` |
