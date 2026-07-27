---
status: implemented
owner: bernardo
last_updated: 2026-07-27
---

# CLI Consumer-Root Behavior

> **Inherited from specloom**, adapted for `playbook-ai`. Command names shown as `loom <x>` map to `playbook <x>`, and the runtime dir is `.specloom/`. The live CLI (`playbook --help`) is the authority on the exact command surface. See `CREDITS` and `ADR-026`.

## Purpose

The `loom` CLI must operate on the consumer project when specloom is installed as a dependency, while still operating on the specloom repository itself during local development.

## Binary names

- The root `package.json` `bin` declares both `loom` and `specloom`, pointing to the same `framework/cli/loom.js` entrypoint. `npx loom <command>` and `npx specloom <command>` are equivalent — `loom` is the canonical name used throughout the playbooks and consumer kernels; `specloom` is retained as a legacy alias. See ADR-019.

## Root resolution

- `consumerRoot(cwd, repoRoot)` returns `repoRoot` in a local development checkout.
- `consumerRoot(cwd, repoRoot)` returns `cwd` when `repoRoot` is under a `node_modules` path.
- Defaults for consumer-owned files must use `consumerRoot`, not `REPO_ROOT` directly.

## Consumer-owned paths

- `defaultChangesDir(cwd, repoRoot)` resolves to `<consumerRoot>/openspec/changes`.
- `defaultConfigPath(cwd, repoRoot)` resolves to `<consumerRoot>/config.yaml`.
- `loadConfig(cwd, repoRoot)` reads the config from `defaultConfigPath`.
- `listTicketSlugs`, `readTicket`, `listAdrFiles`, `validateProposal`, `validateDesign`, `validatePacket`, and `validateReadyForPR` default to the consumer changes directory.
- `isArchiveOnlyDiffAgainst(baseRef, cwd, repoRoot)` runs git against `consumerRoot` and fails closed when git diff cannot be computed.

## Contract drift

- `contract-drift` compares a generated OpenAPI file against the canonical contract resolved from the consumer project.
- `config.yaml`'s `contract.path_in_loom` resolves against `consumerRoot` through `resolveContainedPath` — the same containment boundary as every other filesystem access derived from configuration (see `src/util/fs-safe.js`). A path that escapes the repo (`..`, or an absolute path to another tree) is rejected with a clear error naming the rejected path, and the read is never attempted.
- Without config, the default canonical contract path is `<consumerRoot>/openspec/specs/contracts/openapi.yaml`.
- Missing canonical-contract errors must report the resolved consumer path.
- A misleading canonical contract inside `node_modules/specloom` must not be used for an installed consumer.

### Contract roles and consumption (ADR-038, ADR-039)

Wired in change `contract-first-consumption`. Closes the gap where the
canonical contract was authored (`contract-first-authoring`, ADR-030) but
nothing downstream read it back: `sdd-plan` and `sdd-apply` had zero mentions
of the contract, and `context-packet.md` carried nothing about it.

- **Roles.** `contract.provided_by` (string, optional) names the repo that
  exposes the API; `contract.consumed_by` (array of strings, optional) names
  the repos that consume it. Both resolve against `repos:` via
  `resolveConfiguredRepoPath` — a name absent from `repos:` fails validation
  naming the unknown repo, without touching the filesystem. `consumed_by`
  declared without `provided_by` is not an error (ADR-038): `provided_by` only
  determines conformity obligation, not whether the contract is readable.
- **Authoring trigger is three conditions, not two.** `sdd-design` authors the
  contract only when `impact.public_contract: true` **and**
  `contract.path_in_loom` is set **and** `capabilities.http: true` (ADR-039
  adds the third condition on top of ADR-030's two). With `http: false`, or
  with `http: true` but the change's public contract is non-HTTP (e.g. a CLI
  command), the step is skipped and the reason is declared in `design.md`'s
  `## Public contracts / interfaces` — a silent skip is a design defect.
- **Advisory validate notice.** `playbook validate` warns when
  `contract.path_in_loom` is configured but `capabilities.http: false` — a
  legitimate config for a CLI-only hub keeping a contract for test fixtures
  (this repo). The notice is non-blocking: it never changes the exit code or
  invalidates an artifact, and surfaces under the same top-level `notices`
  channel in `--json`, prefixed `note:` in text output like `doctor`.
- **Read, never copied.** `sdd-plan` plans tasks against the contract's
  endpoints when `contract.path_in_loom` exists and the change touches the
  API; `sdd-apply` reads it per repo role — the provider's obligation is *the
  spec it must fulfill*, the consumer's is *what's available to call,
  including error codes to handle*. Both read the contract by path from the
  hub; neither copies or synchronizes it into the local repo, avoiding the
  N-copies-can-diverge failure a single canonical contract exists to prevent.
- **Packet carries the topology.** `context-packet.md`'s optional
  `sources.contract` and a `## Contract` section (path + declared roles) let a
  topology change (`path_in_loom`, `provided_by`, `consumed_by`) mark the
  packet stale; a packet without `sources.contract` is never reported stale by
  this path, and one without a contract section is byte-identical to before.
- **`provided_by` does not install CI.** Declaring `provided_by` does not wire
  `contract-drift` into that repo's CI — that remains a manual template step
  (ADR-038, accepted risk: a declared `provided_by` can read as "conformity is
  verified" when the CI isn't installed).
- `test/contract-first.test.js`, `test/tokens.test.js`, and
  `test/skill-contract.test.js` carry the enforcement for all of the above, so
  a future merge cannot silently disconnect any of it again.

## Generated agent files

- `commandsDestDir(cwd, repoRoot)` resolves to `<consumerRoot>/.claude/commands`.
- `claudeSkillsDestDir(cwd, repoRoot)` resolves to `<consumerRoot>/.claude/skills`.
- `codexSkillsDestDir(cwd, repoRoot)` resolves to `<consumerRoot>/.agents/skills`.
- `loom sync` without `--target` generates Agent Skills by default. Claude slash commands remain available through explicit `--target commands` or `--target all`. See ADR-013.
- `loom init` without `--agent` scaffolds the default Claude context files and generates Agent Skills in the consumer root. `loom init --agent codex` scaffolds Codex context plus Agent Skills without generating `CLAUDE.md` or `.claude/commands`; `loom init --agent all` scaffolds both context files and generates both commands and skills.

## Template drift detection

- Every `INIT_TEMPLATE_MANIFEST` / `CODEX_TEMPLATE_MANIFEST` entry declares `ownership`: `managed` (must track the package template; drift or absence is an error) or `consumer-owned` (scaffolded to be customized; divergence is informational only, and the default when omitted). See ADR-005. Only the two CI workflow templates (`spec-lint.yml`, `archive-cleanup.yml`) are managed.
- `checkTemplateDrift(targetDir, templatesDir, manifests)` is pure: it returns structured buckets (`managedDrift`, `managedMissing`, `ownedDrift`, `ownedMissing`, `missingSource`, `blocking`) and never exits or logs; `loom.js` renders the report and picks the exit code.
- `loom sync --check --target templates|all` runs the check against `consumerRoot`: managed drift/missing and `missingSource` (broken install) exit 1 with suggested actions; consumer-owned differences never fail. `--target templates` without `--check` errors with a hint (templates are scaffolded by `loom init`, the target is check-only). Write-mode sync never touches templates.
- In specloom's own dev checkout (package not under `node_modules`) the consumer template check is skipped with a note — the repo's own CI files intentionally diverge from the consumer templates.
- In the dev checkout, `loom sync --check --target templates|all` also runs a kernel drift check that compares root `CLAUDE.md`/`AGENTS.md` and template `CLAUDE.md`/`AGENTS.md` after harness-name normalization. Root or template kernel divergence and missing kernel files are blocking. Consumer-owned context drift remains informational for installed consumers.
- `scaffoldProject` ignores the `ownership` field: `init` still copies only what's absent and never overwrites.

## Install manifest and modes (`playbook install`, `playbook doctor`)

- `installSkills({ targets, version, addons, sourceRoot, mode })` writes each
  target's `.playbook-manifest.json` (`schema_version: 1`) alongside the
  existing `.playbook-version` stamp. `mode: "copy"` (default) is byte-for-byte
  identical to the pre-manifest behavior; each installed file gets a sha256
  digest entry. `mode: "link"` (`playbook install --link`, dev-only) makes the
  skill directory real but symlinks each installable file (`SKILL.md` only,
  never `canonical.md`) to `sourceRoot`; the manifest records `mode: "link"`,
  `source`, and a `link` entry per file instead of a digest. See ADR-034,
  ADR-036.
- `playbook doctor` reads the manifest (`installedContentDiagnostics`, pure,
  read-only) and reports: a blocking **problem** naming the skill/file when
  installed content differs from its recorded digest (copy mode) or when a
  linked file's symlink is dangling (source moved/deleted); an informational
  **note** when the manifest is absent, unreadable, or of an unknown
  `schema_version` (never an exception); an informational **note** naming the
  linked source when in link mode (content is verified by symlink resolution,
  not by digest — link mode never compares digests). See ADR-034.
- The manifest never reaches `playbook.lock`: `playbook sync` writes only the
  one-line `.playbook-version` stamp to `methodology.resolved`, regardless of
  install mode. See ADR-034 (SEC-002).

## Post-update signal (postinstall)

- The root `package.json` declares exactly one lifecycle script: a message-only `postinstall` (`scripts/postinstall.cjs`, shipped via the `files` whitelist) that prints the installed version plus a reminder to run `playbook install`. See the ADR "postinstall message-only".
- Policy (structurally enforced by `test/postinstall.test.js`): it never writes to the filesystem, never reads the consumer's repo, never touches the network, and never exits non-zero — self-contained, no `src/` import. `prepare`/`preinstall`/`install` remain forbidden.
- With `--ignore-scripts` there is no signal; the manual flow (`playbook install`) documented in the README is the canonical post-update path.

## Run telemetry and compaction (`loom run`)

- `loom run [--change <slug>] [--step <name>] [--harness claude-code|codex] -- <command...>` executes the command with its stdout/stderr buffered silently (no live streaming) and prints a **compacted summary** once it exits: a one-line success message (`✓ passed (N lines) — log: <path>`) on exit code 0, or the exit code plus the last 40 lines (`MAX_FAILURE_SUMMARY_LINES`) of combined output on a non-zero exit. This replaces the full-passthrough behavior of the first version. See ADR-007 (superseded) and ADR-009 (current).
- The compacted summary only changes what is printed to the terminal/agent — it never affects what is persisted: `full.log`/`usage.json` always receive the complete, untruncated output and the same schema as before.
- The command runs via `spawn` **without a shell** — no shell interpretation of the passed command, so `loom run -- <cmd>` is equivalent to running `<cmd>` directly. The child's exit code is propagated unchanged; a failing command still fails `loom run` and is still recorded.
- Each invocation writes `<consumerRoot>/.specloom/runs/<run-id>/` (`runsDir`): `full.log` (the raw combined output) and `usage.json` (`timestamp`, `command`, `changeId`, `step`, `harness`, `exitCode`, `rawOutputLines`, `retryCount`, `filesInChange`). `<run-id>` is unique per invocation; the schema and directory layout are a stable convention downstream tooling depends on. See ADR-008.
- Metadata resolution (`resolveRunMetadata`): explicit flags win; otherwise `changeId` falls back to the current git branch (`git symbolic-ref --short HEAD`, fail-soft to `"unknown"`), `step` to `"manual"`, `harness` to `"unknown"`.
- `retryCount` (`countPriorRuns`) is derived by scanning prior `.specloom/runs/*/usage.json` for the exact `{changeId, step, command}` triple — stateless across processes. `filesInChange` guards its `changeId` with the same `isSafeSlug` check as every other slug consumer that turns a slug into a **path**, so it can never `readdir` outside the changes directory. (`resolveDelivery` turns a slug into a **branch name and a `gh` argument** instead, so it applies a stricter variant — see "Delivery resolves by the change's own branch", ADR-033.)
- `.specloom/` is git-ignored: run telemetry (which may capture whatever a command prints, including secrets) never leaves the local machine. There is no automatic secret redaction — an accepted, documented risk (see `docs/security-checklist.md`). Compaction reduces this exposure in practice (less of `full.log`'s content reaches the agent's context by default) but does not change the underlying risk on disk.
- `framework/scripts/report-usage.js` is a standalone read-only reporter: it summarizes input/output/cache tokens per Claude Code session transcript (`~/.claude/projects/*/*.jsonl`) and detects the invoked `sdd-*` skill from the `Launching skill:` marker. The Codex adapter (`parseCodexSession`) is a documented stub pending session-format verification.
- `sdd-apply` and `sdd-verify` canonical playbooks (and their generated commands/skills) route their verification, quality-gate, and regression commands through `loom run --change <ticket-slug> --step <apply|verify> -- <command>`, so the compacted summary — not raw command output — is what normally reaches an agent during those flows.

## Multi-repo execution (`loom run --repo`)

- `config.yaml` `repos` is the canonical multi-repo execution substrate for the CLI, not only for `loom gate-check`. See ADR-020, ADR-024, and ADR-025.
- The SDD repo may be declared explicitly under `repos` with `role: sdd` and `path: "."`; at most one repo may use `role: sdd`. If no repo declares that role, the CLI keeps the legacy implicit SDD repo behavior for backwards compatibility.
- `repos.<name>.default_base` is an optional fallback base branch used only when the repo's real `origin/HEAD` cannot be resolved.
- `repos.<name>.protected_paths` is an optional additive list of globs that are never commit candidates for that repo. These globs are added to, never replace, the built-in denylist.
- `loom run --repo <name> --verification <key>` resolves `<name>` through `config.yaml` `repos`, resolves the repo cwd from `repos[<name>].path`, resolves the command from `repos[<name>].verification[<key>]`, and runs it with the same compacted telemetry as `loom run`.
- `loom run --repo <name> -- <command...>` executes the explicit passthrough command in the configured repo cwd with the same telemetry contract.
- Repo names are an allowlist: an undeclared repo name, missing repo path, absent path on disk, or missing verification key exits non-zero with a clear error before spawning any command.
- Repo paths resolve with the same conventions as `gate-check`: relative paths are resolved from `consumerRoot`, absolute paths are used as-is.
- Repo and verification resolution must share the same library interpretation used by `gate-check`; future changes to `config.yaml` `repos` semantics must not create divergent behavior across commands.

## Multi-repo commit planning (`loom repo-plan`, `loom commit-plan`, `loom prepare-repos`)

- `loom repo-plan <ticket-slug>` builds a read-only plan for the repos declared in the change's `## Impacted repos`. The plan includes one entry per impacted repo with repo identity, resolved path, base branch, current/target branch, dirty state, related files, unrelated files, expected-but-missing files, protected staged files, validations, and any blocker.
- `loom commit-plan <ticket-slug>` is read-only and emits a PR payload per repo with related changes. Each payload includes title, body, base, head, files, validation evidence, and rollback note; `base` is the resolved base branch for that repo.
- `loom prepare-repos <ticket-slug>` is the only mutating command in this flow. It creates `[ticket-slug]` from the resolved base when the branch is absent, or switches to `[ticket-slug]` when it exists. It never stages, commits, pushes, force-pushes, or performs destructive checkout, and it skips repos with blockers. See ADR-023.
- Base branch resolution is per repo: real `origin/HEAD` wins, then `repos.<name>.default_base`, then the built-in probe candidates. If none resolves, the repo gets `base_branch_unresolved` and requires human action.
- Git safety blockers are fail-closed and actionable: missing declared repo path, ambiguous git state, dirty working tree on the wrong branch, unresolved base branch, undeclared-only modifications, expected files absent, and protected path candidates.
- The canonical `## Files touched` format is grouped by logical repo name with repo-relative paths, e.g. `- frontend: src/app.ts`. Legacy flat lists remain interpreted as SDD-repo files only; the CLI does not infer repo ownership from path prefixes. See ADR-025.

## Multi-repo delivery aggregation (`playbook status` / `playbook next`)

- `resolveMultiRepoDelivery({ cwd, changesDir?, slug?, resolveOne? })`
  (`src/repos/delivery.js`) is the `deliveryStatus` input `computeState`
  (the pure lifecycle engine) already consumed for single-repo projects —
  the engine's signature and purity are unchanged (ADR-027). It computes the
  value live on every `status`/`next` call and never persists it (`sdd.lock`
  stays untouched).
- **Single-repo back-compat.** When the active change's `## Impacted repos`
  is empty, `resolveMultiRepoDelivery` early-returns exactly
  `resolveDelivery({ cwd, slug })`'s state — identical behavior to before this
  aggregation existed, except that the change's `slug` is now forwarded (see
  "Delivery resolves by the change's own branch" below, ADR-033).
- **Multi-repo reduction ("weakest link", ADR-027).** When `## Impacted
  repos` is non-empty, the aggregate is computed over the hub (`cwd`) plus
  every impacted repo, resolved to a path via `config.yaml` `repos` (the same
  allowlist `gate-check`/`loom run --repo` use). Precedence, first match
  wins: `unknown` → `ci_failed` → `uncommitted` → `committed` → `pr_open`/
  `ci_pending` (folded into `ci_pending`) → `ci_passed` (also covers a
  `ci_passed`+`merged` mix) → `merged`. The aggregate reaches `merged` only
  when **every** repo — hub included — is `merged`.
- **Fail-closed on unresolvable paths.** An impacted repo name absent from
  `config.yaml` `repos`, or without a `path`, is never skipped and never
  read from outside the configured tree: it becomes a synthetic `unknown`
  target with `blocked_reason: REPO_PATH_UNRESOLVED @<repo>`, which — by the
  precedence table — pulls the whole aggregate down to `unknown`.
- **`per_repo` in output.** `playbook status --json` adds `delivery.per_repo`
  (array of `{ repo, path, state, blocked_reason? }`, hub first) additively —
  existing `delivery` fields (`provider`, `state`, `blocked_reason?`) are
  unchanged. Text output prints a `Per-repo: <repo>=<state> · …` line.
- **`sdd-verify`/`sdd-archive` confirmation.** Both playbooks reference
  `playbook status --json`'s `delivery.per_repo` before proceeding on a
  multi-repo change, since `merged` at the aggregate level is unanimous by
  construction but worth re-confirming per repo.

## Delivery resolves by the change's own branch (`playbook status` / `playbook next`)

Fixed in change `delivery-state-branch-independence` (see **ADR-033** for the decision,
its three rejected alternatives, and the accepted risk). `resolveDelivery` took no
change identifier and resolved the pull request for `currentBranch(git)`, so the same
merged change reported a different delivery depending on what was checked out: `merged`
from the change's branch, `committed` from `main` — where `playbook next` then advised
`sdd-commit (push and open the pull request)` for a change already merged. Observed
three times while running the `contract-first-authoring` and
`convention-drift-verify-commit` cycles. It contradicted `system.md`'s first product
principle: an authority on state that answers differently depending on where you stand
is not an authority.

- **`resolveDelivery({ cwd, runGit?, runGh?, slug? })`** resolves the pull request and
  the CI checks for the branch named by `slug` — the change-id. `sdd-new` creates that
  branch (`git checkout -b <change-id>`) and `OWNER.md` records it, so the convention
  already existed; this makes it load-bearing.
- **The current branch is a fallback, not the source of truth.** With no `slug`
  (`undefined`) the behavior is exactly as before — `currentBranch(git)` — for callers
  with no change context. Any other malformed value **fails closed** with
  `unknown` + `INVALID_CHANGE_SLUG` rather than silently resolving a different change.
- **The slug is validated before it becomes a `gh` argument**, as the *first* statement
  of the function, before any runner is instantiated: non-empty string, not `.`/`..`,
  no `/` or `\`, and **no leading `-`**. The dash matters because the value becomes an
  element of `gh`'s argv, where `-R` or `--web` would be parsed as an option rather than
  a branch name. (`isSafeSlug` in `src/tokens/packet.js` needs no such rule — there a
  slug is a path segment, where a leading dash is harmless.)
- **Nothing is persisted.** The `slug` is an *input*; the pull request is looked up live
  on every call, so `src/github/`'s "never persisted" property is preserved. The
  rejected alternative was recording the PR number in the change folder.
- **Every caller that knows the change passes it.** `resolveMultiRepoDelivery` forwards
  its `slug` to `resolveOne` in both the single-repo path and the per-repo fan-out — an
  impacted repo carries the change's branch too (`prepare-repos` creates it).
- **Accepted risk: local tree state keeps its precedence.** A dirty working tree still
  short-circuits to `uncommitted` without consulting GitHub — deliberate, pinned by a
  test, and what keeps the CLI usable offline. So with `lifecycle: runtime_cleared`, a
  merged PR and any uncommitted file, delivery still reads `uncommitted`. Closing that
  would break the pinned test and force a network call on the common path; the residual
  case is one where the operator genuinely does have uncommitted work.

## Cross-repo gate check (`loom gate-check`)

- `loom gate-check <ticket-slug>` reads `openspec/changes/<ticket-slug>/proposal.md` from `consumerRoot` and extracts repo names from the `## Impacted repos` section.
- Missing or empty `## Impacted repos`, missing `config.yaml`, or a `config.yaml` without `repos` is a no-op: the command exits 0 and does not block archive.
- When `config.yaml` declares `gating.strategy`, only `per-feature` is supported. Any other strategy exits non-zero with an explicit unsupported-strategy error.
- Impacted repo names must exist under `config.yaml` `repos`. Unknown repos, missing repo `path`, missing verification commands, and invalid `config.yaml` all exit non-zero with an explicit error.
- Repo `path` values resolve against `consumerRoot` unless absolute. If an impacted repo path does not exist on disk, `gate-check` exits non-zero and reports the missing path.
- Each impacted repo may declare any number of string commands under `verification`. `gate-check` executes every declared command for impacted repos only; repos present in `config.yaml` but absent from `## Impacted repos` are skipped.
- Verification commands execute in the target repo directory via `spawn` without a shell after command-string tokenization. Command output is buffered and recorded locally.
- Any command with a non-zero exit code, or any spawn error such as command-not-found, makes `gate-check` exit non-zero and report repo, verification name, command, exit code, and log path.
- Each command execution writes `<consumerRoot>/.specloom/runs/<run-id>/full.log` and `usage.json` using the same stable base schema as `loom run`, with `changeId` set to the ticket slug, `step` set to `gate-check`, and `harness` set to `unknown`. `usage.json` may include additional `gateCheck` metadata (`repo`, `repoPath`, `verification`) for cross-repo consumers.
- In an installed consumer, `gate-check` resolves `proposal.md`, `config.yaml`, repo paths, and `.specloom/runs/` from the consumer root, never from `node_modules/specloom`.

## Spec section reads (`loom spec-read`)

- `loom spec-read <spec-path>#<anchor>` reads the live spec file and prints only the body of the resolved heading section, stopping before the next heading of the same or higher level.
- Spec reads are confined to `openspec/specs/` under `consumerRoot`; traversal (`..`), absolute paths, path separators in unsafe positions, backslash escapes, and files outside the specs tree are rejected before reading.
- Anchors are derived from the target file's headings at runtime. A missing anchor exits non-zero and reports the available anchors for that file.
- `spec-read` does not read or require `.specloom/index/spec-index.json`; the index remains navigation metadata only.

## Changed-file discovery (`loom changed-files`)

- `loom changed-files <ticket-slug>` lists changed paths one path per line, using git in `consumerRoot`.
- Without `--base`, the comparison base is discovered by probing implicit candidates in order — `main`, `origin/main`, `master`, `origin/master` — via `git rev-parse --verify --quiet <ref>`; the first that resolves is used. The resolved base is unioned with local staged, unstaged, and untracked paths, as before.
- If no implicit base resolves, the command falls back to a deterministic local file list instead of failing: it reads `openspec/changes/<ticket-slug>/context-packet.md` `Files touched`, then (if that is absent or empty) `tasks.md` `Files to create/modify` tokens, unioned with local staged, unstaged, and untracked paths — deduplicated and sorted. SDD artifacts always resolve from `consumerRoot`, even when `--repo` points git at a sibling repo, and reads stay confined to `openspec/changes/<ticket-slug>/`. A compact warning naming the unavailable diff base and the fallback source used is written to stderr, and the command still exits 0 when at least one source could be inspected. It exits non-zero only when no base resolves and no fallback source can be inspected.
- `--base <ref>` overrides the comparison base and stays strict: it skips implicit probing, and an invalid or unresolved explicit ref exits non-zero without falling back. Option-like base refs and unsafe ticket slugs are rejected before invoking git.
- `--diff` appends an inline diff with a line cap so agents can inspect relevant changes without streaming unbounded output. When no base resolves, `--diff` includes only local diffs computable without a base and records `diff_base_unavailable` in the warnings.
- `--json` emits a parseable object carrying at least `slug`, `repo`, `cwd`, `baseRef`, `baseResolved`, `fallback`, `warnings`, `files`, `diff`, and `diffTruncated`, so agents can inspect fallback state without parsing human text.
- `--repo <name>` resolves the git cwd through the same `config.yaml` `repos` allowlist used by `loom run --repo` and `gate-check`.
- No changes is a successful empty result (`exit 0`). See ADR-022.

## Context packet generation (`loom packet`)

- `loom packet <ticket-slug>` reads `openspec/changes/<ticket-slug>/proposal.md` and `tasks.md` from `consumerRoot` and writes `openspec/changes/<ticket-slug>/context-packet.md` — the deterministic generator for the ADR-010 packet convention, replacing the agent-manual copy step. See ADR-019.
- The slug is sanitized with `isSafeSlug`; every write occurs only inside `openspec/changes/<slug>/`. Traversal attempts (`..`, path separators) are rejected before any read or write.
- The Acceptance criteria, Security considerations, and Constraints and non-goals sections are copied byte-for-byte from `proposal.md` (raw section substrings, never re-serialized through gray-matter). Files touched and Verification commands are extracted from `tasks.md`.
- Generation is deterministic (same sources → byte-identical packet) and idempotent (overwrites without a flag; the packet is a derived artifact, never a source of truth).
- The packet carries frontmatter `sources: { proposal: <sha256>, tasks: <sha256> }` computed over the raw bytes of the two sources at generation time.
- Parsing policy: strict on `proposal.md` — a missing verbatim section throws before any write, nothing is written (exit ≠ 0); a missing `tasks.md` throws. Tolerant on `tasks.md` content — an extraction that yields an empty section still writes the packet with a stderr warning naming the section and exits 0 ("Full sources" remains as fallback for the gates).
- `buildPacket(slug, changesDir)` is pure (returns `{ content, warnings }`, never touches disk); `writePacket(slug, changesDir)` persists it. `cmdPacket` in `loom.js` only parses argv, calls the lib, prints the confirmation line, and maps warnings/errors to stderr and exit codes.
- `validatePacket` gains a hash-staleness check: when the packet frontmatter has a `sources` object, it recomputes the two sha256 hashes from disk and reports `context-packet.md stale — re-run \`loom packet <slug>\`` on mismatch, surfaced through `loom validate` (via `validateReadyForPR`). Packets without a `sources` frontmatter (legacy, hand-generated) are never reported stale — the hash check applies only when the frontmatter exists.

## ADR promotion (`loom adr promote`)

- `loom adr promote <ticket-slug>` promotes `openspec/changes/<ticket-slug>/adr-*.md` drafts to `openspec/specs/adr/` during archive. The ticket slug is validated as a folder-name token before any read, write, or git command.
- The command is mechanical only: any draft with `status: proposed` exits non-zero before moving files. Only `accepted` and `rejected` drafts are promoted.
- Promotion is planned before mutation. The planner scans existing `ADR-NNN-*.md` files, assigns sequential zero-padded IDs from the current maximum, resolves `supersedes: ADR-NNN`, and fails before mutation when a superseded ADR does not exist.
- The apply path moves drafts with filesystem rename, regenerates `openspec/specs/adr/README.md` from directory contents while preserving prose above the table, applies the only allowed edit to promoted ADRs (`status: superseded` plus `superseded_by`), stages the touched files with `git add`, and verifies staged content matches disk for each touched file.
- Git commands run through array arguments without a shell. The command never commits or pushes.
- `--dry-run` prints the computed plan and exits without changing disk or the git index. A valid existing change with no ADR drafts prints `no ADR drafts to promote` and exits 0.

## Spec index (`loom index`)

- `loom index` builds a local structural index for permanent specs and writes it to `<consumerRoot>/.specloom/index/spec-index.json`.
- The command indexes only `openspec/specs/system.md` and one-level domain specs matching `openspec/specs/*/spec.md`.
- The command excludes ADRs, docs, active changes, templates, generated agent files, contracts, and any other file outside that target set.
- The CLI prints a compact summary with the indexed file count, heading count, and output path.
- Each indexed file entry contains `file`, `title`, `frontmatter.status`, and `headings`.
- Each heading entry contains `level`, `title`, `anchor`, `lineStart`, and `lineEnd`.
- `lineEnd` points to the line before the next heading at the same or higher level, or EOF.
- Headings inside fenced code blocks are ignored.
- No section bodies are persisted in the JSON; the index is navigation metadata only, not a second source of truth.
- Invalid frontmatter in a target spec exits non-zero and reports the affected path.
- If no target spec files exist, the command exits non-zero with a clear message.
- If `.specloom/index/spec-index.json` cannot be created or written, the command exits non-zero and reports the target path.
- `loom validate` does not require `.specloom/index/spec-index.json`, does not enforce index freshness, and must not fail because the local index cache is absent or stale.

## Spec index advisory (`playbook doctor`)

Added in change `token-saving-parity`.

- `specIndexAdvisory({ cwd })` (`src/cli/doctor.js`) is a pure, read-only
  advisory check, modeled on `workflowStaleness`: it returns a warning string
  when the project has permanent specs to index (`openspec/specs/system.md` or
  a domain `spec.md` present, via `discoverSpecFiles`) but
  `.specloom/index/spec-index.json` has not been built yet, and `null` when
  there is nothing to index or the index already exists.
- `playbook doctor` pushes the result to the existing, non-blocking
  `warnings[]` channel (visible in text output and `--json`) — it never
  affects `healthy` or the exit code, the same contract `workflowStaleness`
  already established.
- This closes the loop on `loom index`/spec index above: a consumer project
  that never ran it now gets a one-line nudge instead of silently missing out
  on section-first reads.

## JSON output

- `loom status --json`, `loom validate --json`, and `loom list --json` emit parseable JSON instead of text output.
- JSON mode is opt-in; the default text output remains stable for humans and playbook prose.
- Error cases in JSON mode emit a JSON error object and exit non-zero without mixing plain text into stdout.

## Verification-report body validation

Added in change `wire-token-and-security-policy`.

- `playbook validate` validates the `verification-report.md` **body** (not just its frontmatter) via `validateVerificationBody` (`src/schema/body-rules.js`), the same section-presence/emptiness pattern as `validateProposalBody`/`validateDesignBody`. It is wired under `BODY_VALIDATORS['verification-report.md']` in `src/cli/validate.js`.
- Required sections — must exist and be non-empty: `## Acceptance criteria`, `## Security considerations`, `## Regression`. `"Not applicable: <reason>"` counts as content, exactly as for proposal bodies (the HTML-comment placeholder is stripped; real prose is not).
- A `verification-report.md` that omits `## Security considerations` fails with `missing section: "## Security considerations"`; one that leaves it empty fails with `empty content in "## Security considerations"`. Either makes `playbook validate` exit non-zero.
- This is the enforcement half that keeps the security thread from silently disconnecting: a post-merge report cannot drop its security evidence and still validate. It never matches verdict strings or emojis — only section presence/emptiness (C-12).
- Covered by `test/schema.test.js` (unit: `validateVerificationBody`) and `test/validate.cli.test.js` (CLI: missing/empty section → violation, complete report → exit 0).

## Validation

- Installed-consumer behavior is covered by `framework/cli/test/installed-consumer.test.js`.
- `loom run` telemetry (metadata resolution, `retryCount` scanning, traversal-safe `filesInChange`, CLI passthrough on a simulated install) and the usage reporter are covered by `framework/cli/test/run.test.js` and `framework/cli/test/report-usage.test.js`.
- `loom spec-read`, `loom run --repo`, `loom changed-files`, and JSON output behavior are covered by `framework/cli/test/spec-read.test.js`, `framework/cli/test/run-repo.test.js`, `framework/cli/test/changed-files.test.js`, and `framework/cli/test/json-output.test.js`.
- `loom gate-check` behavior is covered by `framework/cli/test/gate-check.test.js` and installed-consumer root resolution coverage in `framework/cli/test/installed-consumer.test.js`.
- Readiness and archive validation are covered by `framework/cli/test/validate-ready-for-pr.test.js`.
- `validatePacket` (optional `context-packet.md`, structurally validated when present, plus the `sources` hash-staleness check — see ADR-010, ADR-019 and `openspec/specs/playbooks/spec.md`) is covered by `framework/cli/test/validate-packet.test.js`.
- `loom packet` generation (happy path, byte-exact verbatim sections, determinism, tolerant tasks extraction, incomplete-proposal rejection, and traversal-safe writes) is covered by `framework/cli/test/packet.test.js`.
- `loom index` behavior is covered by `framework/cli/test/index.test.js`.
- Template drift (units, CLI wiring on a simulated install, dev-checkout skip) is covered by `framework/cli/test/template-drift.test.js`.
- The postinstall policy and root package wiring are covered by `test/postinstall.test.js`.
