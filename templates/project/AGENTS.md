# Project context for AI agents

> Cross-agent context shared by Claude Code and GitHub Copilot. Keep this the
> single source of project truth; `CLAUDE.md` and `.github/copilot-instructions.md`
> reference it.

## What this project is

<one-paragraph product description>

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | <e.g. Node / PHP / Python> |
| Backend | <framework> |
| Frontend | <framework or "none"> |
| Database | <db> |
| Tests | <runner> |

## Architecture & agent guides

- [docs/doc_architecture.md](docs/doc_architecture.md) — technical structure (layers, placement).
- [docs/agent_architecture.md](docs/agent_architecture.md) — how agents operate here (boundaries, task workflows).
- [docs/doc_verification_guide.md](docs/doc_verification_guide.md) — verification commands and test strategy.

## How work is done here (SDD)

This project follows Spec-Driven Development. The methodology is installed
globally; run `sdd next` to see the current lifecycle state and the next valid
step. See [docs/sdd-workflow.md](docs/sdd-workflow.md).

## Conventions

- <naming, layering, and testing conventions>
