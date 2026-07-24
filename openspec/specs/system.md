# System Spec — playbook-ai

**Version**: 0.1 · **Owner**: maintainers

> Permanent, global source of truth for playbook-ai's own architecture and
> conventions. Every agent working on this repo reads this before changing a
> core module. Each archived change enriches this file (the SDD flywheel) —
> playbook-ai dogfoods its own methodology.

## What this project is

The Spec-Driven Development methodology itself: a globally-installed set of
Agent Skills (`skills/<name>/canonical.md` → generated `SKILL.md`) plus the
`playbook` CLI (`bin/playbook.js` → `src/cli/dispatch.js`). Consumer projects
install this package once, globally, and keep only their own
`playbook.config.yaml` + `playbook.lock` + `openspec/`.

## Product principles (architecture constraints)

- **The CLI is the authority on state**, never the language model. `sdd-next`
  and every gate skill defer to `playbook status`/`next`/`validate`.
- **Never fabricate evidence.** A gate with missing evidence or an
  unavailable dependency blocks — it never reports `passed`.
- **Schema + code, not one or the other.** JSON Schema (ajv) validates
  frontmatter; hand-written rules (`src/schema/body-rules.js`,
  `src/adr/validate.js`, `src/tokens/packet.js`) validate markdown body
  structure, which a schema cannot express.
- **Additive, never breaking, for multi-repo.** `repos:`/`contract:`/`gating:`
  in `playbook.config.yaml` are optional; a single-repo project's config is
  valid without them.

## Layer architecture

```
bin/playbook.js → src/cli/*.js → { src/lifecycle, src/config, src/schema,
  src/adapters, src/github, src/security, src/install, src/adr, src/tokens,
  src/repos, src/generator, src/util }
```

| Module | Responsibility |
|---|---|
| `src/lifecycle/engine.js` | PURE two-dimension state computation (no fs/network) |
| `src/schema/` | ajv frontmatter validation + body-section rules |
| `src/config/` | `playbook.config.yaml`/`playbook.lock` IO, capability detection |
| `src/adapters/` | Runtime-gate adapter descriptors (browser/http/cli/worker) |
| `src/github/` | Live delivery state (git + `gh`), never persisted |
| `src/security/` | Risk classification (reconcile, never auto-lower) |
| `src/install/` | Global skill installation + shared SKILL.md frontmatter contract |
| `src/adr/` | ADR structural validation + promotion (draft → numbered record) |
| `src/tokens/` | context-packet, compacted `run`, spec index/read, usage-report |
| `src/repos/` | Multi-repo config, git-state, classification, planning, gate-check, delivery aggregation |
| `src/generator/` | `canonical.md` → `SKILL.md` (the only thing `install` copies) |

## Main data model

Not a database-backed system — the "data model" is the artifact set per
change under `openspec/changes/<change-id>/`: `OWNER.md`, `proposal.md`,
`design.md` (conditional), `tasks.md`, `context-packet.md` (generated),
`adr-*.md` drafts, `code-review-report.md`, `security-report.md`,
`runtime-gate-report.md`, `verification-report.md`. Schemas for each live in
`schemas/*.schema.json`.

That set splits along a line a playbook must respect (**ADR-031**):
`context-packet.md` is **derived** — regenerable on demand from `proposal.md` +
`tasks.md` via `playbook packet` — while everything else is **signed**, either by a
human (`proposal.md`/`design.md` carry a human `status: approved`; an `adr-*.md`
draft awaits a human accept/reject) or by a gate (the three `*-report.md` verdicts).
A playbook may regenerate a derived artifact to satisfy `playbook validate`; it must
never edit a signed one for that purpose. Anything not named derived counts as
signed.

## Code conventions

- ESM throughout (`"type": "module"`), Node ≥18.
- `node --test` for tests (`test/*.test.js`), no test framework dependency.
- No comments explaining *what* code does; only *why*, when non-obvious.
- A module never calls `process.exit`; only `bin/playbook.js` does.

## Immutability rule

Once a spec is approved and archived, treat it as immutable. Introduce future
changes via a new folder in `openspec/changes/`. ADRs are promoted, numbered,
and immutable once accepted — a reversed decision supersedes, never edits.
