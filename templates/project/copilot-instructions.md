# Instrucciones para GitHub Copilot

Leé [AGENTS.md](../AGENTS.md) para el contexto del proyecto (stack,
arquitectura, convenciones).

Este proyecto usa Spec-Driven Development. Las skills de SDD están instaladas
globalmente en `~/.agents/skills/`, el target compartido por GitHub Copilot y
Codex. Usá `playbook next` para determinar el próximo paso válido; el CLI es
la autoridad sobre el estado del ciclo, no el modelo. No te saltees pasos.
