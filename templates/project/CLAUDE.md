# CLAUDE.md

Leé [AGENTS.md](AGENTS.md) para el contexto del proyecto (stack, arquitectura,
convenciones). Es la fuente única de verdad — no dupliques su contenido acá.

## SDD

Este proyecto usa Spec-Driven Development. Las skills de SDD están instaladas
globalmente en `~/.claude/skills/`. El CLI `playbook` — no el modelo — decide
el estado del ciclo y el próximo paso:

- `playbook status` — estado de lifecycle + delivery de GitHub
- `playbook next` — la única acción siguiente válida (o corré la skill `sdd-next`)
- `playbook validate` — valida los artefactos del change contra los schemas

No te saltees pasos del ciclo; confiá en `playbook next`.
