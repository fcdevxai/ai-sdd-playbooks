# ai-sdd-playbooks

Single source of truth for SDD AI workflow definitions. Generates both **Copilot Skills** (`.github/skills/`) and **Claude Commands** (`.claude/commands/`) from canonical playbook files.

## Structure

```
playbooks/[slug]/canonical.md      → source of truth per flow
templates/
├── skill.md.hbs                   → SKILL.md template
├── command.md.hbs                 → command.md template
├── openspec/                      → base templates for OpenSpec structure
│   └── system.md                  → global system spec template (generic)
├── docs/                          → base templates for project docs
│   ├── agent_architecture.md      → AI agent workflow guide template
│   ├── doc_architecture.md        → technical architecture template
│   └── doc_verification_guide.md  → verification commands template
├── claude/                        → base templates for Claude Code setup
│   ├── CLAUDE.md                  → Claude agent context template (SDD + TODO sections)
│   └── settings.json              → Claude permissions template (secure SDD defaults)
└── github/                        → base templates for GitHub SDD integration
    ├── CODEOWNERS                 → protege openspec/specs/ y workflows
    ├── PULL_REQUEST_TEMPLATE.md   → checklist SDD en cada PR
    ├── ISSUE_TEMPLATE/
    │   └── user-story.md            → issue template para el ciclo /sdd-enrich-us
    └── workflows/
        ├── archive-cleanup.yml      → alerta semanal de proposals obsoletas
        └── spec-lint.yml            → valida estructura de specs en cada PR
scripts/
├── sync.js                        → generator
└── sync-consumer.sh               → consumer project sync script
dist/
├── github-skills/[slug]/          → generated SKILL.md files
└── claude-commands/[slug].md      → generated command.md files
```

## Usage

```bash
npm install
node scripts/sync.js        # generate dist/
node scripts/sync.js --check  # check for drift (used in CI)
```

## Flows

| Slug | Phase |
|---|---|
| `sdd-enrich-us` | Requirements |
| `sdd-new` | Scaffolding |
| `sdd-ff` | Planning |
| `sdd-apply` | Implementation |
| `sdd-code-review` | Review |
| `sdd-ux-gate` | UX Validation |
| `sdd-commit` | Ship |
| `sdd-verify` | Verification |
| `sdd-archive` | Closure |

## Distribution (git submodule)

### Adding to a new project

```bash
# 1. Add submodule
git submodule add https://github.com/fcdevxai/ai-sdd-playbooks.git .ai-sdd-playbooks

# 2. Copy the sync script into your project (once)
cp .ai-sdd-playbooks/scripts/sync-consumer.sh sync-playbooks.sh

# 3. Run sync (interactive mode)
bash sync-playbooks.sh
```

**Interactive mode features:**

1. **AI target selector**: checkbox menu to choose which AI(s) to sync (GitHub Copilot, Claude, or both)
2. **OpenSpec setup**: detects missing `openspec/` base structure and offers to create:
  - `openspec/specs/system.md` — global system spec template
  - `openspec/changes/` — active features workspace
3. **Documentation setup**: detects missing `docs/` files and offers to create base templates:
   - `docs/agent_architecture.md` — AI agent workflow guide
   - `docs/doc_architecture.md` — technical architecture reference
   - `docs/doc_verification_guide.md` — verification commands guide

> **Important**: The generated SKILLs reference these docs files. Customize the templates for your project's stack and architecture.

**Non-interactive mode** (for CI/scripts):

```bash
# Sync only GitHub Copilot skills, skip all prompts
AI_TARGET=copilot CREATE_OPENSPEC=no CREATE_DOCS=no CREATE_GITHUB_FILES=no bash sync-playbooks.sh

# Sync only Claude commands, create all missing files
AI_TARGET=claude CREATE_OPENSPEC=yes CREATE_DOCS=yes CREATE_CLAUDE_FILES=yes bash sync-playbooks.sh

# Sync both, create all missing files
AI_TARGET=both CREATE_OPENSPEC=yes CREATE_DOCS=yes CREATE_GITHUB_FILES=yes CREATE_CLAUDE_FILES=yes bash sync-playbooks.sh
```

**Custom paths:**

```bash
SKILLS_DEST=".github/skills" COMMANDS_DEST=".claude/commands" bash sync-playbooks.sh
```

### Updating playbooks

```bash
# Pull latest playbooks from canonical
git submodule update --remote .ai-sdd-playbooks

# Sync (will ask which AI target to update)
bash sync-playbooks.sh

# Or specify target explicitly
AI_TARGET=both bash sync-playbooks.sh

# Commit changes
git add .ai-sdd-playbooks .ai/skills .claude/commands docs/
git commit -m "chore: update playbooks from canonical"
```

### CI anti-drift

Add a workflow step that runs `bash sync-playbooks.sh --check` after checking out with `submodules: true`. It exits 1 if committed files differ from the canonical, preventing untracked manual edits.

**Example GitHub Actions workflow:**

```yaml
- name: Check playbooks are in sync
  run: bash sync-playbooks.sh --check
```

**Scope check to specific AI** (useful if project only uses one):

```yaml
- name: Check Copilot skills are in sync
  run: AI_TARGET=copilot bash sync-playbooks.sh --check
```

Without `AI_TARGET`, checks both Copilot and Claude files (default).
