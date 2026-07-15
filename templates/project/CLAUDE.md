# CLAUDE.md

Read [AGENTS.md](AGENTS.md) for project context (stack, architecture,
conventions). It is the single source of project truth.

## SDD

This project uses Spec-Driven Development. The SDD skills are installed globally
in `~/.claude/skills/`. The `sdd` CLI — not the model — decides the lifecycle
state and the next step:

- `sdd status` — current lifecycle + GitHub delivery state
- `sdd next` — the single next valid action (or run the `sdd-next` skill)
- `sdd validate` — validate the change artifacts against the schemas

Do not skip lifecycle steps; trust `sdd next`.
