# Contexto del proyecto para agentes de IA

> Fuente única de verdad, compartida por Claude Code, GitHub Copilot y Codex.
> `CLAUDE.md` y `.github/copilot-instructions.md` solo apuntan acá — no
> dupliques este contenido en esos archivos.

## Qué es este proyecto

`playbook-ai` **es** la metodología SDD: un conjunto de Agent Skills instalable
globalmente (`skills/<nombre>/canonical.md` → `SKILL.md` generado) más el CLI
`playbook`. No consume su propia metodología desde afuera — la construye.
Este mismo repo se auto-aplica SDD (dogfooding): las decisiones difíciles de
revertir sobre el propio framework quedan como ADRs en `openspec/specs/adr/`.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js ≥18, ESM (`"type": "module"`) |
| CLI | `bin/playbook.js` → `src/cli/dispatch.js` |
| Tests | `node --test` (sin framework externo) |
| Dependencias | `ajv`, `gray-matter`, `js-yaml` |
| Distribución | Instalación global (`playbook install`) |

## Arquitectura y guías para agentes

- [docs/doc_architecture.md](docs/doc_architecture.md) — estructura técnica (capas, dónde va cada cosa).
- [docs/agent_architecture.md](docs/agent_architecture.md) — cómo operan los agentes acá (límites, flujos de tarea).
- [docs/doc_verification_guide.md](docs/doc_verification_guide.md) — comandos de verificación y estrategia de tests.
- [docs/security-checklist.md](docs/security-checklist.md) — superficies sensibles conocidas del proyecto.
- [openspec/specs/system.md](openspec/specs/system.md) — spec de sistema completa.

## Cómo se trabaja acá (SDD)

Este proyecto sigue Spec-Driven Development. La metodología está instalada
globalmente; corré `playbook next` para ver el estado actual del ciclo y el
próximo paso válido. Ver [docs/sdd-workflow.md](docs/sdd-workflow.md).

Este repo no tiene UI web ni superficie HTTP (`capabilities.browser`/`http` en
`false`); sí tiene una superficie CLI (`capabilities.cli: true`), que hoy es un
adapter experimental y bloquea `sdd-runtime-gate` si un change la declara
relevante.

## Reglas SDD críticas

1. Leé la proposal activa antes de implementar; sus criterios de aceptación son el contrato.
2. No modifiques archivos fuera del scope de la spec activa (`## Constraints and non-goals`).
3. Si la spec es ambigua, detente y pedí una decisión; no improvises.
4. Escribí o actualizá tests junto con el código (TDD: test primero).
5. No edites specs archivadas ni ADRs promovidos; abrí un change nuevo para modificar decisiones ya tomadas.
6. Toda proposal debe resolver `## Security considerations` (nunca vacío).
7. Las skills se editan en `skills/<nombre>/canonical.md`, nunca en el `SKILL.md`
   generado — corré `npm run generate` después de cualquier cambio.

## Convenciones

- Naming: kebab-case para directorios/skills, camelCase para funciones/variables JS.
- Commits: Conventional Commits (`feat/fix/docs/test/refactor`).
- Branches: `<change-id>` (kebab-case, igual al nombre del change en `openspec/changes/`).
- Comandos de verificación principales: ver [docs/doc_verification_guide.md](docs/doc_verification_guide.md).
