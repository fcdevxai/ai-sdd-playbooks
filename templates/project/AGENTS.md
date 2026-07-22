# Contexto del proyecto para agentes de IA

> Fuente única de verdad, compartida por Claude Code, GitHub Copilot y Codex.
> `CLAUDE.md` y `.github/copilot-instructions.md` solo apuntan acá — no
> dupliques este contenido en esos archivos.

## Qué es este proyecto

<descripción de una línea o párrafo del producto>

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | <ej. Node / PHP / Python> |
| Backend | <framework> |
| Frontend | <framework o "ninguno"> |
| Base de datos | <db> |
| Tests | <runner> |

## Arquitectura y guías para agentes

- [docs/doc_architecture.md](docs/doc_architecture.md) — estructura técnica (capas, dónde va cada cosa).
- [docs/agent_architecture.md](docs/agent_architecture.md) — cómo operan los agentes acá (límites, flujos de tarea).
- [docs/doc_verification_guide.md](docs/doc_verification_guide.md) — comandos de verificación y estrategia de tests.
- [docs/security-checklist.md](docs/security-checklist.md) — superficies sensibles conocidas del proyecto.

## Cómo se trabaja acá (SDD)

Este proyecto sigue Spec-Driven Development. La metodología está instalada
globalmente; corré `playbook next` para ver el estado actual del ciclo y el
próximo paso válido. Claude Code lee las skills desde `~/.claude/skills`;
GitHub Copilot y Codex comparten `~/.agents/skills`. Ver
[docs/sdd-workflow.md](docs/sdd-workflow.md).

Las herramientas de runtime se configuran por agente. Los gates de runtime que
tocan `browser` requieren un MCP de Playwright en el runtime activo; los
add-ons de Confluence requieren un MCP de Atlassian autenticado en el runtime activo.

## Reglas SDD críticas

1. Leé la proposal activa antes de implementar; sus criterios de aceptación son el contrato.
2. No modifiques archivos fuera del scope de la spec activa (`## Constraints and non-goals`).
3. Si la spec es ambigua, detente y pedí una decisión; no improvises.
4. Escribí o actualizá tests junto con el código (TDD: test primero).
5. No edites specs archivadas; abrí un change nuevo para modificar decisiones ya tomadas.
6. Toda proposal debe resolver `## Security considerations` (nunca vacío).

## Convenciones

- <naming, capas y convenciones de testing propias del proyecto>
- Commits: <convención, ej. Conventional Commits>
- Branches: <convención>
