---
schema: design
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Legacy removal design"
status: draft
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
depends_on: proposal.md
security:
  risk: low
  threat_model_required: false
  controls: []
---

# SDD 3.0 — Legacy removal design

Technical contract for `proposal.md`. This is a **removal + contract change**, so
the design is short: the command-surface change, the exact deletion list, the
`sync` change, and versioning/compatibility. No new behavior is introduced.

## 1. Command surface change (8 → 7)

`migrate` is removed from the public surface. This **supersedes 2.0 AC-01**
(which fixed the surface at 8). New surface, in order:

```
install · init · doctor · status · next · validate · sync
```

- `src/cli/dispatch.js`: remove `migrate` from `COMMAND_NAMES`, drop the
  `HANDLERS.migrate` wiring and the `migrateCommand` import, and remove the
  `--version`/help lines that mention migrate (help lists 7).
- `sdd migrate` now falls through to unknown-command handling → `error: unknown
  command 'migrate'` + exit `3` (EXIT.USAGE). No special deprecation notice (the
  clean-break decision; unlike `sdd-ff`, which keeps a deprecation skill).
- `test/dispatch.test.js`: assert the 7-command surface and that `migrate` is
  unknown.

## 2. `sync` change — drop the legacy dual-emit

`src/cli/sync.js` currently has two paths: reconcile (default) and `--legacy`
(runs the frozen `scripts/sync.js` generator). Remove the `--legacy` branch and
its `PACKAGE_ROOT`/`execFileSync`/`scripts/sync.js` dependency. `sync` keeps only
the reconcile behavior (lock `resolved` ↔ installed global version). The
`test/sync.test.js` `--legacy` byte-stable test is deleted; the reconcile tests
stay.

## 3. Exact deletion list

**Delete:**

| Path | Why |
|---|---|
| `playbooks/` | 1.x canonical sources |
| `dist/` (`dist/claude-commands/`) | 1.x generated commands |
| `scripts/sync.js` | 1.x generator |
| `scripts/sync-consumer.sh` | 1.x consumer installer |
| `scripts/fix-bodies.mjs` (if present) | 1.x-only helper |
| `legacy/` (`legacy/README.md`) | freeze-policy doc, no longer needed |
| `templates/command.md.hbs`, `templates/command-en.md.hbs` | 1.x command templates |
| `templates/docs/`, `templates/claude/`, `templates/github/`, `templates/openspec/` | pre-2.0 consumer templates |
| `.github/workflows/generate.yml` | 1.x generate workflow |
| `src/cli/migrate.js` | migrate command + `detectLegacy` |
| `test/migrate.test.js` | migrate tests |

**Keep (2.0, untouched):** `bin/`, all of `src/` except `migrate.js`, `skills/`,
`addons/`, `schemas/`, **`templates/project/`**, `test/` except `migrate.test.js`,
`openspec/`.

**Guard:** a test asserts `templates/project/` still exists and `sdd init` still
scaffolds the full project set (so a wildcard delete of `templates/` can't slip
through). If `scripts/` becomes empty, remove the empty dir too.

## 4. package.json, versioning & config template

- `version` → `3.0.0`.
- Remove the `sync` and `check` npm scripts (they invoked `scripts/sync.js`).
  `test` remains. `files` already lists only `templates/project/` under
  templates — no change needed, but re-audit via `npm pack --dry-run`.
- Config template `templates/project/sdd.config.yaml`:
  `methodology.compatible` → `">=3.0.0 <4.0.0"`.

## 5. CI

- `.github/workflows/ci.yml`: remove the "Legacy drift check (1.x)"
  (`npm run check`) step. Keep tests + `npm pack --dry-run` + CLI smoke.
- Delete `.github/workflows/generate.yml`.

## 6. Compatibility & migration boundary (C-10/C-08 carried forward)

- 2.x consumers pin `methodology.compatible: ">=2.0.0 <3.0.0"`, so a 3.0 global
  install is **out of range** → `sdd doctor` blocks it (AC-08). No silent break.
- There is **no** in-3.0 migration path (migrate removed). Consumers still on 1.x
  must run `sdd migrate` on a **2.x** release first, then adopt 3.0. This is
  stated in the README *Upgrading to 3.0* note and the CHANGELOG.
- Keep the last 2.x release tagged/published so the migration path stays reachable.

## 7. Test impact

- **Delete:** `test/migrate.test.js`; the `sync --legacy` case in `test/sync.test.js`.
- **Update:** `test/dispatch.test.js` (7 commands, `migrate` unknown);
  `test/traceability.test.js` — the 2.0 map references `AC-13 → test/migrate.test.js`
  and `AC-01 → 8 commands`; both are superseded, so realign the 3.0 traceability
  (drop the migrate AC, note the 7-command surface).
- **Add:** a grep/guard test asserting no source/test/doc references any deleted
  path (AC-02), and the `templates/project/`-survives guard (§3).
- **Unchanged and must stay green:** engine, schemas, install (+`--runtime`),
  init (+ capability hint), doctor, validate, security, adapters, delivery,
  detect-capabilities, publish.

## 8. Traceability

| AC | Design section |
|---|---|
| AC-01 | §1 |
| AC-02 | §3, §7 |
| AC-03 | §2 |
| AC-04 | §3 (keep list), §7 |
| AC-05 | §4 |
| AC-06 | §6 |
| AC-07 | §5 |
| AC-08 | §6 |
