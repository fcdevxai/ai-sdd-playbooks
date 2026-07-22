/**
 * Global install targets (design §2.1).
 *
 *   Claude Code             → ~/.claude/skills
 *   GitHub Copilot + Codex  → ~/.agents/skills
 *
 * Both are overridable via PLAYBOOK_CLAUDE_SKILLS_DIR / PLAYBOOK_AGENTS_SKILLS_DIR
 * (used by CI and tests so nothing touches the real home directory).
 */
import os from 'node:os';
import path from 'node:path';

export function resolveTargets(env = process.env, home = os.homedir()) {
  return {
    claude: env.PLAYBOOK_CLAUDE_SKILLS_DIR || path.join(home, '.claude', 'skills'),
    agents: env.PLAYBOOK_AGENTS_SKILLS_DIR || path.join(home, '.agents', 'skills'),
  };
}
