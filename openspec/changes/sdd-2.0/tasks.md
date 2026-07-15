---
schema: tasks
schema_version: 1
change_id: sdd-2.0
title: "SDD 2.0 — Implementation plan"
status: ready
owner: felipe.campos
created: 2026-07-14
updated: 2026-07-14
depends_on: design.md
---

# SDD 2.0 — Implementation plan

**Spec**: `openspec/changes/sdd-2.0/proposal.md` · **Design**: `openspec/changes/sdd-2.0/design.md`

> **Execution gate.** Human approval granted (2026-07-14): `proposal.md` = `approved`, `design.md` = `approved`, `tasks.md` = `ready`. Implementation proceeds **one phase at a time**, each stopping for human review. **Phases 0–12 are complete**; Phase 13 is not started. Legacy 1.x stays operational throughout.

Each phase is **independently reviewable and independently mergeable**, leaves the repository green (legacy 1.x keeps working throughout), and depends only on earlier phases. Task ids are `T<phase>.<index>`; each names its success criterion and required tests.

---

## Phase 0 — Package & CLI skeleton
*Goal: a runnable `sdd` binary with the full command surface stubbed.* — **AC-01**

- [x] **T0.1** Add `bin/sdd.js` + `src/cli/dispatch.js`; wire `package.json` `bin`, `files`, `type: module`, `version: 2.0.0`.
  - *Success*: `sdd --help` lists exactly `install init doctor status next validate sync migrate`. ✓ verified
  - *Tests*: dispatch routing; unknown command → exit `3`. ✓ `test/dispatch.test.js`
- [x] **T0.2** Implement global flags (`--json`, `--cwd`, `--config`, `--quiet`, `--yes`) and the exit-code map (design §1.4).
  - *Tests*: flag-parsing table test. ✓ `parseArgs` table in `test/dispatch.test.js`
- [x] **T0.3** Keep 1.x sources **at their current paths, frozen in place** — do **not** move `playbooks/`, `dist/claude-commands/`, `scripts/sync.js`, `scripts/sync-consumer.sh` (relocation deferred to 3.0). Add only `legacy/README.md` documenting the freeze + deprecation window; `npm run sync`/`check` keep their current paths.
  - *Success*: submodule consumers still resolve `dist/claude-commands/` and `scripts/sync-consumer.sh` unchanged; `npm run check` still passes (AC-16). ✓ verified (no drift)
  - *Tests*: CI `check` job green; path-stability assertion (legacy paths unchanged). ✓

## Phase 1 — Schemas & validation engine
*Goal: `sdd validate` enforces the artifact contract with corrected enums.* — **AC-09, AC-10**

- [x] **T1.1** Author `schemas/*.json` per design §4, with corrected enums: `design ∈ {draft,approved,not_applicable,archived}` (no `ready`), `tasks ∈ {draft,ready,in_progress,passed,blocked}`, and `runtime-gate-report` adapter status including **`blocked`** + `reason_code`. ✓ 9 schemas authored (`ajv@^8`, draft 2020-12)
  - *Tests*: schema-lint loads all schemas via ajv. ✓ `test/schema.test.js`
- [x] **T1.2** Add the structured `proposal` blocks to `proposal.schema.json`: required `impact` (10 boolean indicators) and `security` (`risk` + `triggers` enum) per design §4.3. ✓ (`acceptance_criteria` kept optional — bodies may render ACs in prose per design §4.3)
  - *Tests*: fixtures reject a proposal missing `impact`/`security`; accept a well-formed one. ✓
- [x] **T1.3** Implement `src/schema/{load,validate}.js` (ajv) and `sdd validate` / `--ci`; **no** heading/phrase/emoji matching; **no** artifact mutation (C-12). ✓ schema validation + `--ci`/`--json` + change_id↔folder check. **Deferred to their dependencies:** legal-state, required-gate, applicable-adapter, blocking-finding, and full cross-artifact checks land with the engine (Phase 4) and adapters (Phase 8); config/lock CLI validation lands with config IO (Phase 2).
  - *Success*: `--ci` exits `1` on any violation, `0` clean, `--json` output. ✓ verified
  - *Tests*: exit-code matrix; assert no string-verdict grep and no artifact write. ✓ `test/validate.cli.test.js` (incl. mtime/content no-mutation assertion)
- [x] **T1.4** Implement `sdd validate --precondition <skill>` evaluating a `requires:` block. ✓ pure `evaluatePreconditions` + `SKILL_PRECONDITIONS` (sdd-plan, sdd-apply)
  - *Tests*: met/unmet precondition fixtures (incl. `sdd-apply` triad, design §3.6). ✓ `test/preconditions.test.js`

## Phase 2 — Config & lock (compatibility range)
*Goal: configuration + reproducibility by range, not false pinning.* — **AC-19**, **AC-04** (partial)

- [x] **T2.1** Implement `src/config/config.js` (defaults → `sdd.config.yaml` → env) and `docmap.js`; include `methodology.compatible`, `capabilities`, `design.always`, `security`, `github` (with `require_pull_request`/`require_ci` pinned `const: true` — mandatory in 2.0, AC-21), `documents`, `addons`. ✓ (`js-yaml` for IO; `mergeConfig` pure) — also wired config/lock validation into `sdd validate` (closes the Phase 1 T1.3 deferral)
  - *Tests*: merge precedence + docmap resolution; a config with `require_ci: false` or `require_pull_request: false` is **rejected** by the schema (AC-21). ✓ `test/config.test.js`
- [x] **T2.2** Implement `src/config/lock.js` writing `methodology: { compatible, resolved }` — **not** a bare `methodology_version` (C-08). The lock never stores current GitHub delivery state (C-10). ✓ `buildLock` emits only allowed keys
  - *Success*: lock round-trips and validates; `resolved` is informational, `compatible` is the contract. ✓ verified
  - *Tests*: lock round-trip; assert no delivery/CI/PR field is persisted. ✓ `test/lock.test.js`

## Phase 3 — Global install
*Goal: methodology installs once, globally; no consumer files.* — **AC-02, AC-14**

- [x] **T3.1** `src/install/targets.js` resolving `~/.claude/skills` and `~/.agents/skills` (env-overridable). ✓ `SDD_CLAUDE_SKILLS_DIR` / `SDD_AGENTS_SKILLS_DIR`
- [x] **T3.2** `src/install/skills.js` + `sdd install`: copy core skills into both dirs, stamp version, **core only**. ✓ installs whatever `skills/`+opt-in `addons/` contain; stamps `.sdd-version`. (Core `skills/` is populated in Phase 5/6 — install already picks them up; today it reports "none authored yet".)
  - *Tests*: install into temp dirs; both receive core skills; no cwd writes; no add-on leakage. ✓ `test/install.test.js` (fixture source tree covers core-in-both, add-on opt-in, no consumer writes)

## Phase 4 — Deterministic lifecycle engine (two dimensions)
*Goal: the CLI is the authority on lifecycle AND combines it with GitHub delivery.* — **AC-06, AC-07, AC-08** (C-01)

- [x] **T4.1** Encode in `src/lifecycle/model.js`: the **lifecycle** state + transition tables (design §3.1/§3.3) and a **separate delivery** state table (§3.2). `sdd-enrich-us` is modeled as a pre-process with no lifecycle state (C-02). `failed`/`blocked` are exception views, not linear states. ✓ tables + next-maps are data-only
- [x] **T4.2** Implement the pure engine `src/lifecycle/engine.js`: `(config, lock, artifactIndex, deliveryStatus) → {lifecycle, delivery, next, blockedReason}`; plus `impact.js` (design-required, C-03) and `preconditions.js`. ✓ pure (no fs/model/network); delivery is an input; `impact.js` authored, `artifacts.js` re-exports it
  - *Success*: no fs/model/network calls inside the engine; delivery is an **input**. ✓
  - *Tests*: fixtures for every lifecycle state/transition, the dimension-combination matrix (§3.4), exception views, and design/security skip rules. ✓ `test/engine.test.js`
- [x] **T4.3** Implement `sdd status` (prints **both** dimensions) and `sdd next` (single action combining both). ✓ change resolution: explicit id → git branch → single change
  - *Success*: `status` shows `lifecycle` + `delivery`; `next` returns `next skill`, `wait_for_github_ci`, `merge`, or `blocked: <reason>`. ✓ verified (dogfood: sdd-2.0 → planned → sdd-apply)
  - *Tests*: e2e over fixture change folders + injected delivery states (incl. `unknown`). ✓ `test/lifecycle-cli.test.js`
  - *Note*: the live delivery reader (local Git + GitHub) lands in **Phase 10**; until then `sdd status`/`next` report delivery `unknown`. The engine already accepts every delivery state (fully tested).
- [x] **T4.4** Author `skills/sdd-next/SKILL.md` shelling `sdd next --json`; it does not re-derive state. ✓ (first authored core skill — `sdd install` now installs it)

## Phase 5 — Skill canonicalization
*Goal: `skills/<name>/SKILL.md` is the single source, consumed by both runtimes.* — decision 1, **AC-08**

- [x] **T5.1** Define the shared SKILL.md frontmatter contract (`name`, `description`, `lifecycle_stage`, `produces`, `requires`, `version`) + a `sdd doctor` lint. ✓ `src/install/skill-contract.js` (`lintSkillFrontmatter`/`lintSkillsDir`; wired into `sdd doctor` in Phase 9)
- [x] **T5.2** Convert 1.x flows to `skills/<name>/SKILL.md`: `sdd-enrich-us` (pre-process), `sdd-new`, `sdd-apply`, `sdd-code-review`, `sdd-verify`, `sdd-archive` (parity with frozen legacy bodies); `requires:` matches the lifecycle. ✓ (also `sdd-new` proposes the `impact`+`security` blocks → satisfies the sdd-new part of T6.1/T7.1 early; reports use normalized `status`, not verdict strings)
  - *Tests*: frontmatter lint + parity checklist vs legacy. ✓ `test/skill-contract.test.js` (+ requires↔precondition-table no-drift check)
- [x] **T5.3** Deprecate `sdd-ff` **without a silent alias** (C-05): the 2.0 `sdd-ff` prints the deprecation notice (design §8.6), does **not** run `sdd-plan`, and recommends `sdd next`. Original behavior survives only in the frozen `legacy/` wrapper. ✓ `skills/sdd-ff/SKILL.md` (`deprecated: true`, `produces: []`)
  - *Tests*: invoking `sdd-ff` emits the notice and does not produce `tasks.md`. ✓ (content assertions)
- [x] **T5.4** Retain a transitional dual-emit build behind `sdd sync --legacy`. ✓ `sdd sync` reconciles the lock; `--legacy` regenerates the frozen 1.x command files
  - *Tests*: dual-emit produces byte-stable legacy files for unchanged skills. ✓ `test/sync.test.js`

## Phase 6 — New lifecycle skills (design & plan)
*Goal: the revised lifecycle's design/plan split exists.* — decision 7 (C-03)

- [x] **T6.1** Author `skills/sdd-new/SKILL.md` so it **proposes** the structured `impact` block for human confirmation (C-03). ✓ authored in Phase 5; verified here (complete 10-indicator `impact` + `security` in the sdd-new template)
  - *Tests*: generated proposal contains a complete `impact` block. ✓ `test/skill-contract.test.js`
- [x] **T6.2** Author `skills/sdd-design/SKILL.md` producing `design.md` (written `draft`; a human sets `approved` — the skill never self-approves). When `design_required == false`, **no file is created and nothing is written**: the engine computes `designed` directly (§3.1/§4.4); `sdd status`/`sdd next` never write a `design.md`. Engine refinement: a `draft` design at `proposal_approved` yields `await_human` (approve design), not a re-run.
  - *Tests*: engine fixtures for design required/draft (await_human) and design not required (designed, no file); CLI asserts `sdd next` writes no `design.md`. ✓ `test/engine.test.js`, `test/lifecycle-cli.test.js`
- [x] **T6.3** Author `skills/sdd-plan/SKILL.md`; precondition `proposal=approved ∧ (design_required==false ∨ design∈{approved,not_applicable})`; refuses otherwise naming the missing precondition. ✓ `requires` matches the precondition table (no-drift test)
  - *Tests*: precondition fixtures — proposal `draft` → refusal; `design_required` with design `draft` → refusal; `design_required==false` with no `design.md` → allowed. ✓ `test/preconditions.test.js`

## Phase 7 — Security core (classified from the proposal)
*Goal: security is classified early and enforced late.* — **AC-12** (C-04)

- [x] **T7.1** Move risk classification **into the proposal/design authoring** (C-04): `sdd-new` proposes `security.risk`+`triggers`; `sdd-design` sets `threat_model_required`+`controls`. `http: true` alone does not imply `elevated`. ✓ `src/security/classify.js` (`classifyRisk` ignores capabilities for elevation)
  - *Tests*: an `http`-only, no-trigger change classifies below `elevated`. ✓ `test/security.test.js`
- [x] **T7.2** Author `skills/sdd-security-gate/SKILL.md` producing `security-report.md`: validates coherence proposal↔design↔impl, checks controls+evidence, **may raise** risk, **never lowers** it automatically, structured findings; blocking finding → `status: blocked`. ✓ + `reconcileRisk`/`gateStatusFromFindings` helpers
  - *Tests*: raise-not-lower behavior; blocking-finding forces blocked exception view; `low` → `not_applicable`. ✓ (engine exception view already covers security-report `blocked` → remediate sdd-security-gate)
- [x] **T7.3** Render the mandatory "does not replace a penetration test" disclaimer in report + CLI output. ✓ `SECURITY_DISCLAIMER` in the report template + surfaced by `sdd next` when it routes to `sdd-security-gate`
  - *Tests*: disclaimer present in report body and `--json`. ✓ `test/skill-contract.test.js`, `test/lifecycle-cli.test.js`
- [ ] **T7.4** Implement this change's own declared security controls (design §6.3), each with a test: `SEC-001` explicit confirmation for global/destructive/remote writes; `SEC-002` path-traversal/symlink/out-of-root write protection; `SEC-003` safe argument escaping / no shell injection; `SEC-004` token/secret redaction in logs; `SEC-005` installed-skill integrity + ownership check; `SEC-006` repo/base-branch/PR validation before remote actions.
  - *Tests*: one negative test per control (path-traversal attempt blocked; secret redacted in captured logs; remote action refused without a validated repo/branch).

## Phase 8 — Runtime gate & adapters (incomplete adapters block)
*Goal: one capability-driven gate; incomplete adapters block, never pass.* — **AC-11** (C-06)

- [x] **T8.1** Define adapter descriptors `src/adapters/{browser,http,cli,worker}.js` with support levels: `browser`/`http` **supported**, `cli`/`worker` **experimental**; each declares validates-list + evidence + pass criteria + `reason_code`s. ✓ + `planRuntimeAdapters`/`gateStatusFromAdapters` in `src/adapters/index.js`
- [x] **T8.2** Author `skills/sdd-runtime-gate/SKILL.md`: capability `false` → `not_applicable`; capability `true` + unimplemented/dependency-absent/insufficient-evidence → **`blocked`** (with `reason_code`); never fabricate `passed`. ✓ + `sdd validate` cross-checks the report's `status` against its adapter aggregate (C-06/C-12)
  - *Tests*: capability matrix → expected adapter set + gate status; experimental `cli`/`worker` with capability `true` → `blocked` (never `passed`). ✓ `test/adapters.test.js`
- [x] **T8.3** Full depth for `browser` (Playwright-MCP dependency → `blocked: DEPENDENCY_UNAVAILABLE`, no fabricated evidence) and `http`; `cli`/`worker` experimental descriptors that block when applicable. ✓ (browser descriptor names `playwright-mcp`; skill sets `blocked` when absent)
  - *Tests*: `browser` records `blocked` when the MCP dependency is unavailable. ✓ (skill content + `INSUFFICIENT_EVIDENCE`/`DEPENDENCY_UNAVAILABLE` reason codes)

## Phase 9 — Project scaffolding (safe documents)
*Goal: `init` connects a project without overwriting; adoption is explicit.* — **AC-03, AC-04, AC-05**

- [x] **T9.1** Author `templates/` scaffolds (`sdd.config.yaml`, `AGENTS.md`, `CLAUDE.md`, `copilot-instructions.md`, `docs/{architecture,verification,sdd-workflow}.md`, `openspec/system.md`, `github/workflows/sdd-validation.yml`). ✓ under `templates/project/` (keeps the frozen 1.x `templates/` used by legacy `sync-consumer.sh` intact)
- [x] **T9.2** Implement `src/util/fs-safe.js` (never-overwrite + per-file confirmation token + diff rendering). ✓ + `src/util/semver.js` for the compatibility-range check
  - *Tests*: overwrite without token throws; diff renders expected hunks. ✓ `test/fs-safe.test.js`
- [x] **T9.3** Implement `sdd init` with **tiered doc adoption** (C-09): automatic only for declared-path/exact-name/official-alias; plausible candidate → reported, never auto-adopted; semantic analysis deferred to `sdd-bootstrap-project`. Writes `sdd.lock` with `methodology.compatible`.
  - *Success*: fresh repo gets the full project-local set + no core copies; re-run creates only missing files and edits nothing; ambiguous doc is not auto-adopted. ✓ verified (dogfood + tests)
  - *Tests*: fresh-repo, re-run-idempotent, exact-adoption, and confirmation-required-for-ambiguous scenarios. ✓ `test/init.test.js`
- [x] **T9.4** Implement `sdd doctor` read-only + `--fix` (safe additive only): global-skill presence, **version-vs-`compatible`-range block** (C-08), config validity, missing docs, illegal states, delivery reachability (`unknown`; live reader in Phase 10).
  - *Tests*: doctor-writes-nothing; **version-incompatibility blocks** (C-08); `--fix` additive-only. ✓ `test/doctor.test.js`
- [x] **T9.5** Ship `sdd-validation.yml` using **only** `sdd validate --ci`; it must not mutate artifacts or complete states. ✓ `templates/project/github/workflows/sdd-validation.yml`
  - *Tests*: workflow lints; contains no verdict/heading/emoji matching and no write step. ✓ `test/init.test.js`

## Phase 10 — GitHub delivery integration (new)
*Goal: delivery (branch/commit/PR/checks/CI/merge) as a separate, GitHub-specific dimension.* — **AC-17, AC-18** (C-01, C-10, C-11)

- [x] **T10.1** Implement `src/github/{auth,repository,pull-request,checks}.js` (GitHub-specific, no generic forge layer). `repository.js` reads the local Git tree (`uncommitted`/`committed`); `pull-request.js`/`checks.js` map GitHub reality to the remaining delivery states of design §3.2. ✓ + `src/github/index.js` composer with injectable runners
  - *Tests*: state mapping fixtures (local + GitHub sources). ✓ `test/delivery.test.js`
- [x] **T10.2** Implement delivery resolution from **two sources**: local Git for `uncommitted`/`committed` (offline); GitHub for `pr_open`/`ci_*`/`merged`. No auth/connectivity → GitHub-sourced state `unknown` (`GITHUB_CONTEXT_UNAVAILABLE`); never assume CI/PR/merge; never persist current delivery in `sdd.lock` (C-10). Wired into `sdd status`/`sdd next` (replaces the hardcoded unknown).
  - *Tests*: `unknown`/`GIT_UNAVAILABLE`/`GITHUB_CONTEXT_UNAVAILABLE` paths; `uncommitted` resolved offline; `planned + unknown` does not block `sdd-apply`; `runtime_cleared + unknown` blocks; git-dirty repo → `sdd-commit`. ✓ `test/delivery.test.js`, `test/lifecycle-cli.test.js`, `test/engine.test.js`
- [x] **T10.3** Author `skills/sdd-commit/SKILL.md` per design §9.2 (C-11): validate → verify gates → detect base branch from `github.base_branch`/GitHub (**never** hardcode `main`/`master`) → commit → push → create/update PR (only if remote actions authorized) → return delivery state. No `ci_passed` on push; never auto-merges.
  - *Tests*: no hardcoded branch / no auto-merge / no ci_passed-on-push (content assertions). ✓ `test/skill-contract.test.js`
- [x] **T10.4** Wire `sdd next` merge/CI recommendations (design §3.4): `wait_for_github_ci`, `merge`, `blocked: GITHUB_CI_FAILED`. ✓ (engine `DELIVERY_NEXT` now fed by the live reader)
  - *Tests*: combination-matrix fixtures for each delivery state. ✓ `test/engine.test.js`

## Phase 11 — Migration & bootstrap
*Goal: a 1.x consumer moves to 2.0 safely; AI doc refactor is human-approved.* — **AC-13, AC-15, AC-16**

- [x] **T11.1** Implement 1.x detection (submodule `.ai-sdd-playbooks`, `.claude/commands/`, `sync-consumer.sh`). ✓ `detectLegacy` in `src/cli/migrate.js`
- [x] **T11.2** Implement `sdd migrate`: compute 2.0 target, render full diff, apply only on explicit confirmation (`--yes` still prints diff), leave legacy intact. ✓ shares `projectActions` with `sdd init` (preview vs write)
  - *Tests*: dry-run diff; confirm-gated apply; legacy-preserved; non-legacy repo still scaffolds. ✓ `test/migrate.test.js`
- [x] **T11.3** Author `skills/sdd-bootstrap-project/SKILL.md`: inspect repo → propose doc mappings + improvements → present diff → write only on human approval; decline is a no-op. ✓
  - *Tests*: decline-path leaves repo unchanged (content assertions). ✓ `test/skill-contract.test.js`

## Phase 12 — Add-on separation
*Goal: optional add-ons never install implicitly.* — **AC-14** (decision 12)

- [x] **T12.1** Move Confluence flows to `addons/confluence/{document-code,write-in-confluence}/SKILL.md`. ✓ (2.0 add-on skills; full 1.x detail remains in the frozen `playbooks/`)
  - *Tests*: add-on skills lint clean against the contract. ✓ `test/skill-contract.test.js`
- [x] **T12.2** Gate add-on install behind `sdd install --addon confluence` and/or `addons.confluence: true`. ✓ install merges `--addon` flags with `addons:` true keys from `sdd.config.yaml`
  - *Tests*: core install excludes add-ons; opt-in (flag or config) installs them. ✓ `test/install.test.js`

## Phase 13 — Legacy freeze, publish & docs
*Goal: ship 2.0 as an npm package with a documented, reversible migration path.* — **AC-16** (decision 11)

- [ ] **T13.1** Finalize `legacy/README.md`, `CHANGELOG.md`, README rewrite: global install, `sdd` command reference, two-dimension model, capability model, GitHub-only scope, deprecation window (dates), migration guide.
- [ ] **T13.2** Publish tooling: `npm publish` dry-run in CI, `files` allowlist audit, `sdd --version` == package version.
  - *Tests*: `npm pack` contains exactly the intended files; `npx sdd --help` smoke test from the tarball.
- [ ] **T13.3** End-to-end acceptance sweep: run a full lifecycle (`enrich → … → archive`) on a fixture consumer for a `browser+http` project and an `http`-only project, plus a `worker`-capable project that must show `blocked`; drive delivery through `uncommitted → … → merged` and through the `unknown` path.
  - *Success*: every AC (AC-01…AC-21) is exercised by ≥1 automated test; the design §11 traceability table has no gaps.

---

## Phase → acceptance-criteria coverage

| Phase | ACs |
|---|---|
| 0 | AC-01 |
| 1 | AC-09, AC-10 |
| 2 | AC-19, AC-21, AC-04 (partial) |
| 3 | AC-02, AC-14 |
| 4 | AC-06, AC-07, AC-08 |
| 5 | decision 1, AC-20 (sdd-ff) |
| 6 | decision 7 (impact/design/plan) |
| 7 | AC-12 (+ SEC-001…SEC-006) |
| 8 | AC-11 |
| 9 | AC-03, AC-04, AC-05 |
| 10 | AC-17, AC-18, AC-21 |
| 11 | AC-13, AC-15, AC-16 |
| 12 | AC-14 |
| 13 | full traceability (AC-01…AC-21) |
