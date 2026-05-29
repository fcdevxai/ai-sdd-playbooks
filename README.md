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

In target projects:

```bash
git submodule add https://github.com/eduassistant/ai-sdd-playbooks .ai-sdd-playbooks
bash sync-playbooks.sh
```

The `sync-playbooks.sh` script in each project copies from `.ai-sdd-playbooks/dist/` into `.github/skills/` and `.claude/commands/`.

CI in each project runs the sync and fails if the committed files differ (`git diff --exit-code`), preventing drift.
