# Legacy 1.x compatibility (frozen)

SDD 2.0 keeps the entire 1.x pipeline **operational and frozen at its current
paths**. Nothing is relocated in 2.0 — moving these paths would break existing
git-submodule consumers that resolve them directly.

## What stays in place (do NOT move in 2.0)

| Path | Role (1.x) |
|---|---|
| `playbooks/<slug>/canonical.md` | 1.x source of truth per flow |
| `dist/claude-commands/<slug>.md` | 1.x generated Claude commands (consumed via submodule) |
| `scripts/sync.js` | 1.x generator (`playbooks/` → `dist/`) |
| `scripts/sync-consumer.sh` | 1.x installer used by consumer projects |

Consumer projects on 1.x continue to reference `dist/claude-commands/` and
`scripts/sync-consumer.sh` through the `.ai-sdd-playbooks` submodule exactly as
before. `npm run sync` / `npm run check` keep working against these paths.

## Freeze policy

- **No new features** land in the 1.x pipeline. It receives only critical fixes.
- The 2.0 canonical source of truth is `skills/<name>/SKILL.md`. During the
  deprecation window the build may *dual-emit* legacy command files from the new
  skills so un-migrated consumers keep working.
- Migration to 2.0 is performed by `sdd migrate` (diff-then-confirm); it never
  deletes legacy files.

## Deprecation window

The 1.x pipeline is **time-boxed** by an announced deprecation window (dates to
be published in the top-level `README` / `CHANGELOG`). The **physical move** of
`playbooks/`, `dist/`, and `scripts/` under `legacy/` is deferred to **3.0**, the
release that removes 1.x compatibility.
