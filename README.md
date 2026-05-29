# ai-sdd-playbooks

Single source of truth for SDD AI workflow definitions. Generates both **Copilot Skills** (`.github/skills/`) and **Claude Commands** (`.claude/commands/`) from canonical playbook files.

## Structure

```
playbooks/[slug]/canonical.md   → source of truth per flow
templates/skill.md.hbs          → SKILL.md template
templates/command.md.hbs        → command.md template
scripts/sync.js                 → generator
dist/github-skills/[slug]/      → generated SKILL.md files
dist/claude-commands/[slug].md  → generated command.md files
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

# 3. Run sync
bash sync-playbooks.sh
```

If your project uses different paths, override via env vars:

```bash
SKILLS_DEST=".github/skills" COMMANDS_DEST=".claude/commands" bash sync-playbooks.sh
```

### Updating playbooks

```bash
git submodule update --remote .ai-sdd-playbooks
bash sync-playbooks.sh
git add .ai-sdd-playbooks .ai/skills .claude/commands
git commit -m "chore: update playbooks from canonical"
```

### CI anti-drift

Add a workflow step that runs `bash sync-playbooks.sh --check` after checking out with `submodules: true`. It exits 1 if committed files differ from the canonical, preventing untracked manual edits.
