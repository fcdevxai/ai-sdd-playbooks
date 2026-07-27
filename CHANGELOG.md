# Changelog

## 0.9.0 — Contract-first loop, token-saving parity, delivery hardening

Eleven SDD cycles closed since the `0.1.0` unified baseline, all additive and
backward-compatible: no schema field went from optional to required, no
existing consumer config or `SKILL.md` invocation stops working. Fourteen new
ADRs (`ADR-026`–`ADR-039`) recorded the decisions and their rejected
alternatives; `ADR-020`–`ADR-025` predate this baseline — inherited history
from the `specloom` predecessor, restored (not decided) in this window.

### Contract-first: authoring → consumption closes the loop
- `sdd-design` authors the canonical `openapi.yaml` under a three-condition
  guard (`impact.public_contract` **and** `contract.path_in_loom` **and**
  `capabilities.http`) — a fourth ADR (`ADR-039`) added the HTTP condition
  after a CLI-only change was found to trigger OpenAPI authoring for a
  surface with no endpoints.
- `contract.provided_by`/`consumed_by` declare provider/consumer roles,
  validated against `repos:`; `sdd-plan` and `sdd-apply` now actually read the
  contract by path from the hub — provider as the spec to fulfill, consumer
  as what's available to call — instead of implementing from memory while a
  written contract sat unread (`ADR-030`, `ADR-038`).
- `playbook validate` gained a non-blocking `notices` channel for the
  `path_in_loom` + `http: false` config inconsistency.

### Token-saving parity completed
- `context-packet.md` is now actually read by all five designed consumers
  (`sdd-code-review`, `sdd-security-gate`, `sdd-runtime-gate`, `sdd-commit`,
  `sdd-verify`) — `sdd-commit` and `sdd-runtime-gate` had 0 mentions of it
  despite the original design.
- `playbook spec-index`/`spec-read` (section-first permanent-spec reads) and
  `playbook changed-files --diff` (diff-first review) are now invoked by the
  playbooks that were designed to use them but never did.
- The security thread (`SEC-N`) is closed end-to-end: `sdd-enrich-us` seeds it
  as a mandatory decision dimension, `sdd-verify` re-runs every negative test
  against **merged** code rather than trusting the pre-merge report.

### Multi-repo delivery hardening
- Delivery state aggregates across every impacted repo with "weakest-link"
  precedence — `merged` only when every repo, hub included, is merged
  (`ADR-027`); it resolves by the change's **own** branch, never the
  currently-checked-out one (`ADR-033`).
- `sdd-bootstrap-project` re-detects sibling repos on every re-run instead of
  treating a populated `repos:` as "topology already resolved" (`ADR-028`),
  and invokes detection through a `playbook detect-siblings` CLI wrapper
  instead of naming an internal function to run by hand (`ADR-029`).

### Retry-loop and CLI-adapter conventions restored
- The `sdd-apply`/`sdd-verify` `pwd` check and the `sdd-commit` fix→validate
  retry cap (both originally decided, neither wired) are now actually present
  in the generated skills, with the "no blind edits past the cap" guard
  language restored (`ADR-031`).
- The experimental `cli` runtime adapter's exclusion now carries a stated,
  reusable criterion instead of being re-justified from scratch in every
  proposal (`ADR-032`).

### Install integrity and safety
- `playbook doctor` compares installed skill content against a sha256
  manifest, not just a version stamp — closes a real drift bug where two
  divergent installs both reported `0.1.0` (`ADR-034`).
- `resolveContainedPath`/`resolveConfiguredRepoPath` are now the single
  boundary for every filesystem read derived from configuration, including
  the contract path (`ADR-035`).
- `playbook install --link` (dev-only, opt-in symlink mode) and a required
  `Regression` line in `tasks.md`, advised by `packet` when missing
  (`ADR-036`, `ADR-037`).

## 0.1.0 — Unified baseline

`playbook-ai` merges two sibling SDD frameworks into one methodology: the
deterministic engine/schema/multi-runtime foundation of `ai-sdd-playbooks`
(v3.0.0) with the ADR, token-efficiency, and multi-repo capabilities of
`specloom` (v1.0.0). Built greenfield — a new repo, source files ported and
reconciled piece by piece — not a merge or a fork of either.

### Core (single-repo engine)
- **`playbook` CLI**, ESM/Node ≥18, global install (`~/.claude/skills`,
  `~/.agents/skills` shared by GitHub Copilot + Codex).
- **Deterministic two-dimension lifecycle engine** (pure `computeState`):
  methodological `lifecycle` + GitHub `delivery`, computed from local
  artifacts and live git/`gh` state, never persisted delivery in the lock.
- **JSON Schema validation** (ajv 2020-12) for artifact frontmatter, plus
  **body-section validation** (proposal/design/ADR/context-packet) — the half
  of validation a schema alone cannot express.
- **13 canonical skills**, each authored once as `skills/<name>/canonical.md`
  and generated into the installed `SKILL.md` by `src/generator/`:
  `sdd-enrich-us`, `sdd-new`, `sdd-design`, `sdd-plan`, `sdd-apply`,
  `sdd-code-review`, `sdd-security-gate`, `sdd-runtime-gate`, `sdd-commit`,
  `sdd-verify`, `sdd-archive`, `sdd-bootstrap-project`, `sdd-next`.
- **Capability-driven runtime gate** (`browser`/`http`/`cli`/`worker`); the
  `browser` adapter absorbs the full UX/UI checklist (flows, states,
  responsive, accessibility) that used to be a separate gate.
- **Security as a core stage**: risk classified in the proposal, refined in
  the design, enforced by `sdd-security-gate` against a 7-category checklist
  (authz, IDOR, input handling, data exposure, secrets, dependencies).

### ADRs
- `adr-*.md` drafts (flagged during `sdd-enrich-us`/`sdd-apply`, created by
  `sdd-new`), structurally validated (`src/adr/validate.js`) and promoted to
  numbered, immutable records by `playbook adr promote <change-id>`
  (`src/adr/promote.js`) — transactional, git-staged, with automatic rollback.

### Token efficiency
- `context-packet.md`, generated by `sdd-plan` (`playbook packet`) from
  `proposal.md` + `tasks.md`, with sha256-hash staleness detection.
- `playbook run` — compacted verification output (one line on success, exit
  code + last 40 lines on failure) with full logs always on disk at
  `.playbook/runs/<run-id>/`.
- `playbook spec-read` / `spec-index` — section-first reads over permanent
  specs backed by a structural (headings-only) index cache.
- `usage-report` — offline token accounting from Claude Code transcripts.

### Multi-repo bootstrap
- `src/config/detect-siblings.js` — `sdd-bootstrap-project` proposes
  candidate sibling repos for `repos:` by scanning the parent directory for
  git repos. Validated empirically against a real, multi-project home
  directory: naming affinity (`sharedTokensWithOwn`/`cluster`) only sorts
  candidates, never filters them — a hub can be named unlike any of its
  siblings (`playbook-ai` + `frontend` + `backend`), and an unrelated repo can
  sit right next to a real one, so relevance is always a human decision.

### Multi-repo (optional, additive)
- `repos:`/`contract:`/`gating:` in `playbook.config.yaml` (a single-repo
  project omits them entirely).
- Read-only `repo-plan`/`commit-plan`/`changed-files` (diff-first, with a
  deterministic context-packet/tasks.md/local-git-state fallback when no diff
  base resolves); `prepare-repos` is the only mutator (branches only).
- `gate-check` runs each impacted repo's configured verification commands
  locally; `contract-drift` is a stack-agnostic structural OpenAPI diff.

### Add-ons
- Confluence flows (`document-code`, `operational-guide`, `code-audit-comment`)
  under `addons/`, install only on explicit opt-in.

### Conventions
- Machine-readable fields (statuses, impact, security, capabilities) are
  stable in English; skill bodies are English; project templates/docs are
  Spanish.
- **GitHub** is the only supported remote provider;
  `github.require_pull_request` and `github.require_ci` are mandatory.
