# ai-sdd-playbooks

Single source of truth for SDD AI workflow definitions. Generates both **Copilot Skills** (`.github/skills/`) and **Claude Commands** (`.claude/commands/`) from canonical playbook files.

## Structure

```
playbooks/[slug]/canonical.md      → source of truth per flow
templates/
├── skill.md.hbs                   → SKILL.md template
├── command.md.hbs                 → command.md template
└── docs/                          → base templates for project docs
    ├── agent_architecture.md      → AI agent workflow guide template
    ├── doc_architecture.md        → technical architecture template
    └── doc_verification_guide.md  → verification commands template
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
| `enrich-us` | Requirements |
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
2. **Documentation setup**: detects missing `docs/` files and offers to create base templates:
   - `docs/agent_architecture.md` — AI agent workflow guide
   - `docs/doc_architecture.md` — technical architecture reference
   - `docs/doc_verification_guide.md` — verification commands guide

> **Important**: The generated SKILLs reference these docs files. Customize the templates for your project's stack and architecture.

**Non-interactive mode** (for CI/scripts):

```bash
# Sync only GitHub Copilot skills, skip docs prompt
AI_TARGET=copilot CREATE_DOCS=no bash sync-playbooks.sh

# Sync only Claude commands, create docs if missing
AI_TARGET=claude CREATE_DOCS=yes bash sync-playbooks.sh

# Sync both, create docs if missing
AI_TARGET=both CREATE_DOCS=yes bash sync-playbooks.sh
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
