# CLAUDE.md — [YOUR_PROJECT_NAME]

> Este archivo es el contexto base para sesiones de Claude Code.
> Mantén aquí el contexto específico de tu proyecto.
> El bloque SDD entre marcadores puede ser actualizado automáticamente por `sync-playbooks.sh`.

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
[Entry point] -> [Routing] -> [Controllers] -> [Services] -> [Models/Repositories] -> [Response]
```

---

## Módulos del sistema

> **TODO**: Lista los módulos principales de tu proyecto con sus specs y estado.

| Módulo | Specs | Estado |
|---|---|---|
| [Módulo 1] | `openspec/specs/[module]/spec.md` | pending |
| [Módulo 2] | `openspec/specs/[module]/spec.md` | pending |

---

<!-- BEGIN SDD PLAYBOOKS -->
<!-- Bloque SDD administrado automáticamente por scripts/sync-consumer.sh -->
<!-- Fuente canónica: templates/claude/CLAUDE_SDD_BLOCK.md -->
<!-- END SDD PLAYBOOKS -->

---

## Convenciones rápidas

> **TODO**: Documenta las convenciones de tu proyecto.

- Commits: Conventional Commits - `feat(module): description [ticket]`
- Branches: `[ticket-slug]-descripcion-corta`
- [Agrega convenciones de naming, formateo, etc. específicas de tu stack]
