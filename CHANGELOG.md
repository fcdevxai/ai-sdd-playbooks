# Changelog

## 0.10.1 — Post-merge delivery proven by merge-commit ancestry

`sdd-verify` and `sdd-archive` run on the base branch after the merge and write
evidence there. With that evidence uncommitted, `0.10.0` accepted delivery as
`merged` only when `HEAD` equaled the pull request's head commit, which holds
only after a fast-forward merge. After a merge commit, a squash or a rebase
merge, generating the stage packet turned delivery `unknown`
(`MERGED_HEAD_IDENTITY_UNPROVEN`) and blocked `validate`, the stage
preconditions, `status`, `next`, `evidence seal` and `evidence retain`.
Decided in change `merged-delivery-identity`.

- With only change evidence uncommitted and the pull request merged, delivery
  is `merged` when `HEAD` is the pull-request head (as before) or when the merge
  commit GitHub reports for the pull request is `HEAD` or an ancestor of `HEAD`.
  This covers merge-commit, squash and rebase merges and a base branch that
  advanced after the merge, using the same three-valued ancestry as delivered
  evidence.
- Undecidable cases stay `unknown` with a reason that says what to do:
  `MERGE_COMMIT_NOT_IN_HISTORY` (pull the base branch) and
  `MERGED_HISTORY_UNAVAILABLE` (fetch full history). A merge commit that is not
  an ancestor of `HEAD`, or a missing one, keeps `MERGED_HEAD_IDENTITY_UNPROVEN`.
- The merge-commit identifier is accepted only as a full lowercase object name
  before it reaches Git. Delivery's Git calls ignore replace refs, like evidence
  checks.
- No change to the clean-tree result, the evidence-path allowlist, sealing,
  binding, freshness or retention. Consumers on `semver:^0.10.0` receive this
  release without changes.

## 0.10.0 — Source-bound evidence for every lifecycle gate

Lifecycle gates no longer advance on a report's scalar `status`. Every gate now
cites execution receipts with retained raw output, is sealed to the stage
handoff it judged, and stays eligible only while its governed source is
unchanged. Decided in change `harness-trust-restoration`; see ADR-043 for the
threat model and accepted limits, and ADR-042 for how this change itself was
delivered.

- **`playbook run`** captures stdout and stderr losslessly (`stdout.raw`,
  `stderr.raw`, `full.log`), writes a schema-validated `execution-receipt.json`,
  preserves the child exit (127/126/`128 + signal` for spawn and signal
  failures) and prints a bounded summary. New flags: `--repo`, `--agent`,
  `--provider`, `--model`, `--container`, `--raw`.
- **`playbook packet --stage <stage> --agent <agent>`** writes a source-bound
  `handoff-manifest.json` plus an immutable copy per stage.
- **`playbook evidence seal|bind|retain`** seal a gate report to its receipts,
  bind identical content across a later commit, and retain closure proof before
  archive.
- **One eligibility evaluator** behind `validate`, `status`, `next` and stage
  preconditions. Verification needs unanimous merged delivery; archive needs a
  valid closure index.
- **Runtime coverage** requires every AC, EC and SEC to be mapped in
  `handoff.runtime_coverage` or declared in `handoff.non_runtime`, and an
  adapter entry for every enabled capability of every impacted repository.
- The consumer CI template checks out the pull request's exact head commit with
  full history and installs `semver:^0.10.0`.
- `playbook run --raw` never prints the install notice, so RAW streams carry only
  the child's bytes even where no skills are installed (for example a CI runner).
- `playbook validate --precondition sdd-commit` is met only when `next` routes to
  `sdd-commit`; an unavailable GitHub context no longer passes it.

### Migrating a consumer from 0.9.x

1. Install 0.10.0 explicitly; projects pinned to `^0.9.0` or `v0.9.x` are not
   moved by this release.
2. Update `.github/workflows/playbook-validation.yml` from the template:
   `fetch-depth: 0`, checkout of the pull request head SHA, and the new version.
3. Run `playbook sync` so `playbook.lock` records the installed version.
4. For changes still in progress: let `sdd-plan` add the `handoff` block to
   `tasks.md`, declaring every AC, EC and SEC; gates that passed under 0.9.x
   carry no `source_binding` and must be rerun and sealed.
5. Keep the global `playbook` on a released checkout; develop the methodology
   in a separate worktree.

### Known follow-ups

Eight TODO tests on summary accuracy and telemetry symlinks, error-case
navigation in the context packet, a simpler runtime-gate path for changes
without a product runtime surface, temporary-directory cleanup in the test
suite, and fail-closed rejection of non-UTF-8 names inside declared untracked
paths (today they are hashed as ordinary content).

## 0.9.2 — `worker` runtime adapter promoted to supported

The `worker` runtime-gate adapter moves from `experimental` (permanently
`blocked: ADAPTER_NOT_IMPLEMENTED` whenever relevant, regardless of evidence
quality) to `supported`, with no declared per-project dependency — the same
model `http` already uses. Reported from a real consumer project hitting the
structural deadlock: with `worker: true` relevant, the runtime gate could
never reach `passed`, even with `browser`/`http` fully passed and real tests
covering the worker.

- `sdd-runtime-gate` documents a 7-point real-evidence checklist for `worker`
  (real trigger, real consumer processing, observable side effect,
  retry/dead-letter path, idempotency when relevant, evidence citing `AC-N`)
  and explicit `failed`/`blocked` criteria, mirroring `browser`/`http`.
- **SEC-001**: evidence-gathering must never fire a real irreversible external
  effect (a real payment, email/SMS, or third-party call) — use the project's
  own test/sandbox double, or the finding is `blocked`, never a fabricated
  `passed`.
- `cli` is unaffected — ADR-032's criterion stands exactly as written.
- Purely additive: no new `playbook.config.yaml` field, no schema change, no
  new reason code. A project that never declares `worker: true` sees no
  behavior change at all.

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
