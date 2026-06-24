# ai-sdd-playbooks

Biblioteca de comandos Claude Code para equipos de desarrollo. Centraliza las definiciones de flujos de trabajo en archivos canónicos y los distribuye a los proyectos consumidores vía git submodule.

Cada playbook vive en `playbooks/[slug]/canonical.md` como fuente única de verdad. El script `sync-consumer.sh` los instala en `.claude/commands/` del proyecto destino.

---

## Comandos disponibles

### Ciclo SDD

Flujos que implementan la metodología Software-Driven Development. Se instalan siempre al ejecutar el sync.

| Comando | Fase | Descripción |
|---|---|---|
| `/sdd-enrich-us` | Requirements | Enriquece una user story con criterios de aceptación y casos de error |
| `/sdd-new` | Scaffolding | Crea los artefactos de la feature en `openspec/changes/` |
| `/sdd-ff` | Planning | Granulariza tasks y aplica feature flags |
| `/sdd-apply` | Implementation | Ejecuta el contrato de la spec |
| `/sdd-code-review` | Review | Revisión automática contra la spec |
| `/sdd-ux-gate` | UX Validation | Verifica criterios de UX antes de merge |
| `/sdd-commit` | Ship | Genera el commit con referencia a la spec |
| `/sdd-verify` | Verification | Verifica criterios de aceptación post-PR |
| `/sdd-archive` | Closure | Archiva la feature completada |

### Documentación técnica en Confluence

Comandos add-on para automatizar documentación. Se ofrecen opcionalmente durante el sync — el equipo decide si los instala.

| Comando | Descripción |
|---|---|
| `/document-code` | Lee código fuente y genera documentación técnica estructurada en Confluence. Soporta entidades/DB, servicios, controllers y componentes frontend. Incluye análisis de impacto y modo batch para documentar múltiples entidades en un solo ciclo. Compatible con Doctrine ORM, TypeORM, Eloquent y otros. |
| `/write-in-confluence` | Redacta guías operacionales sobre funcionalidades de la plataforma y las publica en Confluence. Dirigido a equipos de Operaciones y Soporte, no a TI. |

---

## Estructura del repositorio

```
playbooks/[slug]/canonical.md      → fuente de verdad por flujo
templates/
├── command.md.hbs                 → template de comando Claude (uso interno del generador)
├── openspec/
│   └── system.md                  → template del system spec global
├── docs/                          → templates base para documentación del proyecto
│   ├── agent_architecture.md
│   ├── doc_architecture.md
│   ├── doc_verification_guide.md
│   ├── manual-sdd-agentic-engineer.md
│   └── sdd-workflow.md
├── claude/                        → templates base para setup de Claude Code
│   ├── CLAUDE.md
│   ├── CLAUDE_SDD_BLOCK.md        → bloque SDD gestionado automáticamente dentro de CLAUDE.md
│   └── settings.json
└── github/                        → templates base para integración GitHub SDD
    ├── CODEOWNERS
    ├── PULL_REQUEST_TEMPLATE.md
    ├── ISSUE_TEMPLATE/
    │   └── user-story.md
    └── workflows/
        ├── archive-cleanup.yml    → alerta semanal de proposals obsoletas
        └── spec-lint.yml          → valida estructura de specs en cada PR
scripts/
├── sync.js                        → generador (produce dist/ desde playbooks/)
└── sync-consumer.sh               → script de instalación en proyectos consumidores
dist/
└── claude-commands/[slug].md      → comandos SDD generados (copiados por sync-consumer.sh)
```

---

## Uso del generador (este repositorio)

```bash
npm install
node scripts/sync.js          # genera dist/
node scripts/sync.js --check  # verifica que dist/ esté en sync con playbooks/ (CI)
```

---

## Distribución (git submodule)

### Agregar a un proyecto nuevo

```bash
# 1. Agregar el submodule
git submodule add https://github.com/fcdevxai/ai-sdd-playbooks.git .ai-sdd-playbooks

# 2. Copiar el script de sync al proyecto (una sola vez)
cp .ai-sdd-playbooks/scripts/sync-consumer.sh sync-playbooks.sh

# 3. Ejecutar el sync (modo interactivo)
bash sync-playbooks.sh
```

### Qué hace el sync interactivo

El script instala los comandos y valida que la estructura del proyecto esté completa. Ejecuta los siguientes pasos en orden:

1. **Comandos SDD core** — copia `dist/claude-commands/*.md` a `.claude/commands/` siempre.

2. **Comandos add-on de documentación** — detecta si `document-code` y `write-in-confluence` están disponibles pero no instalados, y pregunta si se desea instalarlos.

3. **docs/** — verifica que existan los archivos de contexto del proyecto (`agent_architecture.md`, `doc_architecture.md`, etc.). Si faltan, ofrece crear templates base.

4. **openspec/** — verifica la estructura base de OpenSpec (`openspec/specs/system.md`, `openspec/changes/`). Si falta, ofrece crearla.

5. **`.github/`** — verifica los artefactos SDD de GitHub (CODEOWNERS, PR template, issue template, workflows). Si faltan, ofrece copiarlos desde templates.

6. **Claude setup** — verifica `CLAUDE.md` en raíz y `.claude/settings.json`. Si faltan, ofrece crear templates base. Siempre mantiene en sync el bloque SDD entre marcadores dentro de `CLAUDE.md`.

### Modo no-interactivo (CI / scripts)

Todas las preguntas interactivas tienen su variable de entorno equivalente:

```bash
CREATE_OPENSPEC=yes \
CREATE_DOCS=yes \
CREATE_CLAUDE_FILES=yes \
CREATE_GITHUB_FILES=yes \
CREATE_DOC_COMMANDS=yes \
bash sync-playbooks.sh
```

### Rutas personalizadas

```bash
COMMANDS_DEST=".claude/commands" bash sync-playbooks.sh
```

### Actualizar playbooks

```bash
# Traer la última versión del submodule
git submodule update --remote .ai-sdd-playbooks

# Re-sincronizar
bash sync-playbooks.sh

# Commitear los cambios
git add .ai-sdd-playbooks .claude/commands docs/
git commit -m "chore: update playbooks from canonical"
```

### CI anti-drift

Agrega un step en tu workflow que ejecute `bash sync-playbooks.sh --check` después de hacer checkout con `submodules: true`. Sale con código 1 si los archivos en `.claude/commands/` difieren del canonical.

```yaml
- name: Check playbooks are in sync
  run: bash sync-playbooks.sh --check
```
