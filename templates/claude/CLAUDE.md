# CLAUDE.md — [YOUR_PROJECT_NAME]

> Este archivo es el contexto base para sesiones de Claude Code.
> Para reglas de proyecto, stack, convenciones de código y herramientas MCP, leer también **AGENTS.md** en la raíz del repositorio.

---

## Qué es [YOUR_PROJECT_NAME]

> **TODO**: Describe tu proyecto aquí.
> - ¿Qué problema resuelve?
> - ¿Quiénes son los usuarios?
> - ¿Hay restricciones de arquitectura importantes (privacidad, seguridad, etc.)?

---

## Stack

> **TODO**: Documenta tu stack tecnológico.

- **Backend**: [e.g., PHP 8.4 · Laravel 13]
- **Frontend**: [e.g., React 19 · TypeScript · Tailwind CSS]
- **Auth**: [e.g., JWT · OAuth]
- **Testing**: [e.g., PHPUnit · Jest]
- **Formateo**: [e.g., Pint · ESLint · Prettier]
- **CI**: [e.g., GitHub Actions]

---

## Arquitectura de capas

> **TODO**: Describe el flujo de capas de tu arquitectura.
> Ver `docs/doc_architecture.md` para el detalle completo.

```
[Entry point] → [Routing] → [Controllers] → [Services] → [Models/Repositories] → [Response]
```

---

## Módulos del sistema

> **TODO**: Lista los módulos principales de tu proyecto con sus specs y estado.

| Módulo | Specs | Estado |
|---|---|---|
| [Módulo 1] | `openspec/specs/[module]/spec.md` | pending |
| [Módulo 2] | `openspec/specs/[module]/spec.md` | pending |

---

## Rutas SDD (Spec-Driven Development)

```
openspec/
├── specs/          → source of truth permanente (NUNCA editar specs archivadas)
│   ├── system.md   → arquitectura global, convenciones, modelo de datos
│   └── [module]/
│       └── spec.md
└── changes/        → features en curso (una carpeta por feature activa)
    └── [ticket-slug]/
        ├── OWNER.md
        ├── proposal.md   → spec de la feature (inmutable una vez APROBADA)
        ├── design.md
        └── tasks.md
```

---

## Reglas del agente (críticas)

1. **NUNCA modificar archivos fuera del scope de la spec activa** — la sección "Restricciones" de `proposal.md` define el boundary.
2. **SIEMPRE leer `openspec/changes/[feature]/proposal.md` antes de generar código** — los criterios de aceptación son los únicos criterios de éxito válidos.
3. **Si encuentras ambigüedad en la spec → DETENTE → señala el problema → espera instrucción**. No improvises.
4. **Generar tests ANTES o JUNTO al código**, nunca después.
5. **Specs en `openspec/specs/` son inmutables** — si necesitas cambiar una spec archivada, abre una nueva en `openspec/changes/`.
6. **No crear archivos de documentación** a menos que el usuario lo pida explícitamente.

---

## Convenciones rápidas

> **TODO**: Documenta las convenciones de tu proyecto.

- Commits: Conventional Commits — `feat(module): description [ticket]`
- Branches: `[ticket-slug]-descripcion-corta`
- [Agrega convenciones de naming, formateo, etc. específicas de tu stack]

---

## Comandos del ciclo SDD

| Comando | Fase | Qué hace |
|---|---|---|
| `/sdd-enrich-us [ticket]` | Inicio | Enriquece user story, produce `proposal.md` draft |
| `/sdd-new [ticket] [desc]` | Inicio | Crea carpeta `openspec/changes/[ticket]/` con todos los artefactos |
| `/sdd-ff [ticket]` | Planificación | Granulariza `tasks.md` desde la proposal aprobada |
| `/sdd-apply [ticket]` | Ejecución | Ejecuta spec activa (TDD, sin improvisar fuera de scope) |
| `/sdd-code-review [ticket]` | Ejecución | Revisión automática contra spec |
| `/sdd-commit [ticket]` | Cierre | Commit estructurado con referencia a spec |
| `/sdd-verify [ticket]` | Cierre | Verifica criterios de aceptación post-PR |
| `/sdd-archive [ticket]` | Cierre | Integra delta en `openspec/specs/`, limpia `openspec/changes/` |
