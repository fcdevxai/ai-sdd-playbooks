---
schema: design
schema_version: 1
change_id: sdd-3.0-legacy-removal
title: "SDD 3.0 — Legacy removal + doc-template alignment design"
status: approved   # re-approved 2026-07-15 (adds §9)
owner: felipe.campos
created: 2026-07-15
updated: 2026-07-15
depends_on: proposal.md
security:
  risk: low
  threat_model_required: false
  controls: []
---

# SDD 3.0 — Legacy & old-reference removal design

Technical contract for `proposal.md`. A removal + contract change with **no new
behavior**: the command-surface change, the exact deletion list, the reference
purge, and versioning. 3.0 is a clean baseline — no cross-version migration.

## 1. Command surface change (8 → 7)

`migrate` is removed from the public surface (supersedes 2.0 AC-01). New surface,
in order: `install · init · doctor · status · next · validate · sync`.

- `src/cli/dispatch.js`: drop `migrate` from `COMMAND_NAMES`, the `HANDLERS.migrate`
  wiring, and the `migrateCommand` import.
- `sdd migrate` → unknown-command handling (`exit 3`). No deprecation notice
  (clean baseline).
- `test/dispatch.test.js`: assert the 7-command surface and `migrate` unknown.

## 2. `sync` — drop the legacy dual-emit

Remove the `--legacy` branch from `src/cli/sync.js` (and its `PACKAGE_ROOT` /
`execFileSync` / `scripts/sync.js` dependency). `sync` keeps only reconcile
(lock `resolved` ↔ installed version). Delete the `--legacy` byte-stable test in
`test/sync.test.js`; keep the reconcile tests.

## 3. Deletion list

**Delete:**

| Path | Why |
|---|---|
| `playbooks/` | 1.x canonical sources |
| `dist/` | 1.x generated commands |
| `scripts/sync.js`, `scripts/sync-consumer.sh`, `scripts/fix-bodies.mjs` (if present) | 1.x generator/installer/helpers |
| `legacy/` | freeze-policy doc |
| `templates/command.md.hbs`, `templates/command-en.md.hbs` | 1.x command templates |
| `templates/docs/`, `templates/claude/`, `templates/github/`, `templates/openspec/` | pre-2.0 consumer templates |
| `.github/workflows/generate.yml` | 1.x generate workflow |
| `src/cli/migrate.js`, `test/migrate.test.js` | migrate command + `detectLegacy` |
| `skills/sdd-ff/` | 1.x→2.0 deprecation bridge (obsolete on a fresh baseline) |

**Keep (untouched):** `bin/`, all `src/` except `migrate.js`, `skills/` except
`sdd-ff/` (13 core skills remain), `addons/`, `schemas/`, **`templates/project/`**,
`test/` except the deleted files, `openspec/` (incl. the historical
`changes/sdd-2.0/`). If `scripts/` becomes empty, remove the empty dir.

**Guard:** a test asserts `templates/project/` survives and `sdd init` still
scaffolds fully, so a wildcard `templates/` delete can't slip through.

## 4. Reference purge (surviving files)

After the deletions, remove every remaining mention of the old world:

- `skills/sdd-plan/SKILL.md`: drop "Replaces the deprecated `sdd-ff`" from the
  `description` and body — `sdd-plan` simply is the planner.
- `addons/confluence/document-code/SKILL.md` and `write-in-confluence/SKILL.md`:
  remove the "Full 1.x reference: `playbooks/…` (frozen)" lines.
- `README.md`: remove the *Legacy & deprecation* section and any migration/
  deprecation wording; present 3.0 as the baseline (single doc source). Command
  reference → 7 commands, no `sync --legacy`.
- `test/skill-contract.test.js`: drop `sdd-ff` from the presence list.
- `test/traceability.test.js`: the 2.0 map references `AC-13 → migrate.test.js`
  and an 8-command AC-01; both are superseded — realign to the 3.0 ACs.

Driven by the Phase 0 grep inventory; the Phase 4 grep sweep must come back empty
(AC-02), exempting `openspec/changes/sdd-2.0/` (historical record).

## 5. package.json, versioning & config

- `version` → `3.0.0`; remove `sync` and `check` npm scripts (`test` stays).
  `files` already lists only `templates/project/` — re-audit via `npm pack --dry-run`.
- `templates/project/sdd.config.yaml`: `methodology.compatible` → `">=3.0.0 <4.0.0"`.
- The `sdd.lock` compatibility-range machinery and `doctor`'s range check stay as
  a **forward-looking** feature (3.0→4.0); there is no 1.x/2.x migration framing.

## 6. CI

- `.github/workflows/ci.yml`: remove the "Legacy drift check (1.x)" (`npm run check`)
  step; keep tests + `npm pack --dry-run` + CLI smoke.
- Delete `.github/workflows/generate.yml`.

## 7. Test impact

- **Delete:** `test/migrate.test.js`; the `sync --legacy` case in `test/sync.test.js`.
- **Update:** `test/dispatch.test.js` (7 commands, `migrate` unknown);
  `test/skill-contract.test.js` (13 skills, no `sdd-ff`); `test/traceability.test.js`
  (realign to 3.0 ACs); `test/install.test.js` if it asserts a skill count.
- **Add:** a grep/guard test asserting no source/test/skill/shipped-doc reference
  to any deleted path or old term (AC-02), plus the `templates/project/`-survives guard.
- **Unchanged, must stay green:** engine, schemas, install (+`--runtime`), init
  (+capability hint), doctor, validate, security, adapters, delivery,
  detect-capabilities, publish.

## 8. Traceability

| AC | Design section |
|---|---|
| AC-01 | §1 |
| AC-02 | §3, §4, §7 |
| AC-03 | §2 |
| AC-04 | §3 (keep list), §7 |
| AC-05 | §5 |
| AC-06 | §4 (README), §9 |
| AC-07 | §6 |
| AC-08 | §9.1, §9.2, §9.3 |
| AC-09 | §9.1, §9.4, §9.5 |

## 9. Consumer doc-template alignment (amendment 2026-07-15 — AC-08/AC-09)

Align the shipped consumer docs with the convention real projects use. The doc
system already resolves a **logical name → path** (`src/config/docmap.js`), with
`DEFAULT_DOCUMENTS` as fallback and an **open** `documents` schema
(`additionalProperties: string`), so this is a defaults + templates + prose
change — **no schema change**, and existing projects that pin their own
`documents:` paths are unaffected.

### 9.1 Model — keep keys, change default paths, add one doc

Logical **keys stay stable and semantic**; only their default **paths** change,
plus one new key.

| Logical key | 2.0 default path | 3.0 default path |
|---|---|---|
| `system_spec` | `openspec/specs/system.md` | *(unchanged)* |
| `architecture` | `docs/architecture.md` | `docs/doc_architecture.md` |
| `verification` | `docs/verification.md` | `docs/doc_verification_guide.md` |
| `workflow` | `docs/sdd-workflow.md` | *(unchanged)* |
| **`agent_architecture`** *(new)* | — | `docs/agent_architecture.md` |

`architecture` = **technical** architecture (layers, placement); the new
`agent_architecture` = **how agents operate** here (what to inspect, task
workflows, tool/skill activation, boundaries).

### 9.2 Templates

- Rename `templates/project/docs/architecture.md` → `doc_architecture.md`, and
  `verification.md` → `doc_verification_guide.md` (git-mv to keep history).
- Add `templates/project/docs/agent_architecture.md`: a **generic, stack-agnostic
  skeleton** (structure lifted from the git-history 1.x `templates/docs/agent_architecture.md`,
  modernized to point at the **global SDD skills + the `sdd` CLI**, not any
  framework). It cross-links the sibling docs + `CLAUDE.md`/`AGENTS.md` but stays
  a skeleton, not a filled-in guide.

### 9.3 CLI wiring

- `src/config/config.js` `DEFAULT_DOCUMENTS`: update the two paths, add
  `agent_architecture: 'docs/agent_architecture.md'`.
- `src/cli/init.js` `LOGICAL`: update the two paths, add
  `['docs/agent_architecture.md', 'agent_architecture']`.
- `src/cli/init.js` `CANDIDATE_PATTERNS`: add `agent_architecture` and make the
  patterns **specific** so a file is not adopted as both docs — the
  `agent_architecture` pattern requires "agent", and the plain `architecture`
  pattern must **not** match a filename containing "agent" (R-05).
- `templates/project/sdd.config.yaml` `documents:`: reflect the four paths (and,
  in the same edit, bump `methodology.compatible` → `">=3.0.0 <4.0.0"`, from §5).

### 9.4 Skills

- Update project-doc references in prose from `docs/architecture.md` →
  `docs/doc_architecture.md` and `docs/verification.md` →
  `docs/doc_verification_guide.md` across `sdd-enrich-us`, `sdd-design`,
  `sdd-plan`, `sdd-apply`, `sdd-code-review`, `sdd-verify`.
- `sdd-bootstrap-project`: learn the **4th** doc — detection guidance + the
  logical-key mapping now covers `agent_architecture`.
- **Proposed** reference of the new doc: `sdd-apply` (and `sdd-bootstrap-project`)
  point at `docs/agent_architecture.md` for "how agents operate here". Kept modest
  on purpose — confirm the exact skill set at approval.

### 9.5 Tests

- `test/config.test.js` + `test/init.test.js`: assert the new default paths and
  the 4th logical doc; cover that `agent_architecture.md`/`doc_architecture.md`
  are not cross-adopted (R-05).
- `test/e2e.test.js`: the four docs scaffold on a fresh `sdd init`.
- The Phase 3 guard/grep is unaffected (it targets legacy **terms**, not doc
  names); the final sweep additionally asserts **no leftover** `docs/architecture.md`
  / `docs/verification.md` references (AC-08).

### 9.6 Compatibility

Only defaults + a fresh `sdd init` change. Consistent with "everyone starts on
3.0"; no per-project migration.
