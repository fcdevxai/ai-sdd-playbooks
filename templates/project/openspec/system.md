# System Spec — <PROJECT_NAME>

**Version**: 1.0 · **Owner**: <Tech Lead>

> Permanent, global source of truth for architecture, conventions, and the data
> model. Every agent reads this before changing project layers. Each archived
> feature enriches this and the domain specs (the SDD flywheel).

## Product principles (architecture constraints)

- **Least data**: store only what is strictly required.
- **Clear ownership boundaries**: each tenant/user accesses only their own data.
- **Security by design**: privacy/security constraints are mandatory.

## Technology stack

See [AGENTS.md](../../AGENTS.md).

## Layer architecture

See [docs/doc_architecture.md](../../docs/doc_architecture.md).

## Main data model

<entities and key fields — replace with real ones>

## Code conventions

<backend / frontend / testing conventions>

## Immutability rule

Once a spec is approved and archived, treat it as immutable. Introduce future
changes via a new folder in `openspec/changes/`.
