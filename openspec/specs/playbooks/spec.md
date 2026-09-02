---
status: implemented
owner: bernardo
last_updated: 2026-09-02
---

# Playbooks and Agent Skill Metadata

> **Inherited from specloom**, adapted for `playbook-ai`. Command names shown as `loom <x>` map to `playbook <x>`, and the runtime dir is `.specloom/`. The live CLI and playbooks are the authority on current behavior. See `CREDITS` and `ADR-026`.

## Purpose

The SDD playbooks in `framework/playbooks/*/canonical.md` are the canonical workflow definitions for specloom. They render to agent-facing formats such as Claude commands and Agent Skills.

## Canonical source of truth

- `framework/playbooks/[slug]/canonical.md` is the source of truth for each SDD workflow.
- Generated Agent Skills must not be hand-edited. Regenerate them from the canonical playbooks with `node framework/scripts/sync.js --target skills`.
- `.claude/skills/<slug>/SKILL.md` and `.agents/skills/<slug>/SKILL.md` use the same Agent Skills format and must remain byte-identical for the same slug.

## Render targets

- `node framework/scripts/sync.js` defaults to the Agent Skills target and writes `.claude/skills/<slug>/SKILL.md` plus `.agents/skills/<slug>/SKILL.md`. See ADR-013.
- `node framework/scripts/sync.js --target commands` writes only Claude slash commands.
- `node framework/scripts/sync.js --target skills` writes Agent Skills to both `.claude/skills/<slug>/SKILL.md` and `.agents/skills/<slug>/SKILL.md`.
- `node framework/scripts/sync.js --target all` writes both command and skill outputs.
- Unknown sync targets fail fast.

## Project initialization

- `node framework/cli/loom.js init` defaults to the Claude context scaffold (`CLAUDE.md`, `.claude/settings.json`, and the standard SDD project templates) and generates Agent Skills by default. It does not generate `.claude/commands` unless a command target is selected explicitly through a flow such as `--agent all`. See ADR-013.
- `node framework/cli/loom.js init --agent codex` scaffolds `AGENTS.md` and generated Agent Skills for both `.claude/skills` and `.agents/skills`; it must not scaffold `CLAUDE.md` or `.claude/commands`.
- `node framework/cli/loom.js init --agent all` scaffolds both Claude and Codex surfaces.
- Unknown agent values fail fast.

## Agent Skill trigger contract

- The `description` frontmatter field is the trigger contract for Agent Skills.
- `description` must be a short semantic activation contract that includes the skill purpose, lifecycle context, explicit `sdd-*` skill name, relevant artifact names, and compact natural-language trigger intent in English and Spanish. See ADR-014.
- Spanish trigger coverage must live in `description`, not only in `description_es`, because Agent Skill matching reads `description` as the primary activation signal.
- `description_es` may remain as localized supporting metadata, but it must stay aligned with `description`.
- Systematic long trigger lists and exhaustive accent-variant duplication are not required; tests enforce that descriptions stay short while retaining explicit skill identity and bilingual trigger intent.

## Generated output invariants

- Running `node framework/scripts/sync.js --check --target skills` must report no drift after any playbook description change.
- Generated `SKILL.md` frontmatter must remain valid YAML even when descriptions contain quotes, accented characters, slashes, artifact names, or long prose.
- The playbook body contains workflow instructions; "when to use" activation signals belong in `description` because the body is loaded only after the skill has triggered.

## Retry-cap convention

See ADR-011 for the decision context and trade-offs behind these limits.

- Playbooks with retry loops must define explicit numeric caps in the canonical text instead of "retry until it works".
- The cap never means silent abort or forced success; it means stop/report with the current state and evidence, then wait for human direction.
- `sdd-apply` caps TDD retries per task at 2 red attempts; the 3rd red result stops the loop, reports the task state plus the last `.specloom/runs/<run-id>/full.log`, and never marks the task complete.
- `sdd-new` and `sdd-commit` cap the fix -> `loom validate` -> re-run loop at 3 failed iterations; the 4th failed iteration stops and reports the remaining validate issues.
- The cap bounds *how many times*, not *what*. **ADR-031** adds the scope dimension ADR-011 left open: a loop iteration may regenerate a **derived** artifact (`playbook packet` for a stale `context-packet.md`) but must never mutate a **human-signed** one — `proposal.md`, `design.md`, `tasks.md`, an `adr-*.md` draft, or a gate report — to make `validate` pass. Anything not named regenerable counts as signed, and a forbidden fix stops immediately **without consuming an iteration**. See "Retry-loop scope and the pwd/cap restoration" below.
- `sdd-enrich-us` caps clarification at 4 Q&A rounds; a 5th unresolved round stops, summarizes the remaining open decisions, and asks whether to continue.
- Security rules remain stronger than retry caps. In particular, `sdd-apply` must never mark complete a task tied to a security consideration while its negative test is still red.

## Cross-repo gate-check convention

- Every `sdd-new` proposal template includes a `## Impacted repos` section.
- `## Impacted repos` lists repo names from `config.yaml` `repos`, one per bullet, when a feature needs cross-repo verification before archive.
- An empty `## Impacted repos` section means no cross-repo gate applies for that ticket.
- `sdd-archive` must run `loom gate-check <ticket-slug>` during precondition validation and before any write to `openspec/specs/`.
- If `loom gate-check` exits non-zero, `sdd-archive` stops and reports the failing repo, command, exit code, or missing path. It must not update permanent specs until the gate passes.
- If `loom gate-check` reports a no-op because `config.yaml`/`repos`/`## Impacted repos` are absent or empty, `sdd-archive` continues with its normal single-repo archive flow.
- `sdd-verify` and `sdd-archive` also confirm the per-repo delivery breakdown via `playbook status --json`'s `delivery.per_repo` (see `openspec/specs/cli/spec.md`, "Multi-repo delivery aggregation", ADR-027): no impacted repo may be unmerged, even though the aggregate only reaches `merged` when every repo does.

## cwd-safe command convention

See ADR-011 for the decision context and trade-offs behind this rule.

- Commands written by `sdd-ff` into `tasks.md` and `context-packet.md` must be executable from the repository root without a preceding `cd`.
- Prefer root-relative paths or command flags such as `-C` and `--prefix` over shell chains that depend on inherited cwd.
- `sdd-apply` and `sdd-verify` must verify `pwd` before running commands from `tasks.md` **or `context-packet.md`** — post `token-saving-parity` the verification commands come from the packet — and must not assume cwd state carried over from a previous step. Wired in **both** playbooks as of change `convention-drift-verify-commit`; `sdd-verify` carries the check at each of its two command-running points (feature commands and regression commands), since the cwd is not carried between them.
- For older change folders whose commands still depend on `cd`, `sdd-apply` and `sdd-verify` treat the cwd check as a defensive fallback rather than retroactively rewriting the ticket.

## Non-goals

- Agent Skill trigger metadata does not change Claude slash-command behavior.
- The project does not use a custom trigger parser; it relies on Agent Skills semantic matching through `description`.
- Optional `agents/openai.yaml` metadata is not required for the current SDD skills.

## Context packet convention

See ADR-010 for the full reasoning. `sdd-ff` generates `openspec/changes/[ticket-slug]/context-packet.md` immediately after `tasks.md`, in the same step.

- The packet has 7 fixed sections: `Ticket`, `Acceptance criteria`, `Constraints and non-goals`, `Security considerations`, `Files touched`, `Verification commands`, `Full sources`.
- `Acceptance criteria` and `Security considerations` are verbatim copies from `proposal.md` — never paraphrased or summarized.
- `sdd-code-review`, `sdd-security-gate`, `sdd-ux-gate`, `sdd-commit`, and `sdd-verify` read `context-packet.md` instead of re-reading `proposal.md`+`tasks.md` in full when it exists; they still read `system.md` in full when their checklist requires it.
- `sdd-apply` is excluded — it always reads the full sources, since it needs the complete detail to write code.
- If `context-packet.md` does not exist (a change created before this convention), the five consumer playbooks fall back silently to the full sources — no error, no warning.
- If a consumer detects the packet visibly contradicts the current `proposal.md`/`tasks.md`, it must prefer the full sources and note the discrepancy in its output.
- The packet is optional but structurally validated when present: `validatePacket` in `framework/cli/lib.js` requires all 7 sections to exist and be non-empty, mirroring `validateDesign`.

## Section-first permanent spec context

- `sdd-ff`, `sdd-code-review`, `sdd-security-gate`, `sdd-ux-gate`, `sdd-commit`, and `sdd-verify` are section-first consumers for permanent spec context.
- When one of those playbooks needs `openspec/specs/system.md` or a domain spec, it should use `.specloom/index/spec-index.json` to locate the relevant section and then read only that section unless full-file context is explicitly required.
- If `.specloom/index/spec-index.json` is missing, the playbook instructs the agent to run `loom index` before reading permanent specs.
- If `loom index` fails, the playbook instructs the agent to fall back to full reads and report the failure reason in its output.
- `sdd-apply` is excluded and continues to require full reads because it implements from complete spec context.
- `sdd-archive` is excluded and continues to require full reads before editing permanent source-of-truth files.
- The index is navigation metadata only; it must not be treated as a source of section body content.

## Token-efficient reads wired into the gate/verify/commit playbooks

Wired in change `wire-token-and-security-policy`. The `playbook changed-files`
and `playbook spec-read` commands already existed and were tested, but no
playbook invoked them (grep over `skills/` = 0), so the savings never happened.
These directives connect the already-ported commands to the playbook prose;
generated `SKILL.md` files carry them (Principle 1 — regenerate, never hand-edit).
Content tests in `test/skill-contract.test.js` blind the wiring against a future
merge silently disconnecting it.

- **diff-first (changed files).** `sdd-code-review`, `sdd-security-gate`, and
  `sdd-runtime-gate` instruct `playbook changed-files <change-id> --diff` first,
  and full-read a file only when the diff touches authorization/ownership/input
  or is insufficient to judge. `sdd-security-gate` **retains its explicit right
  to full-read any file on a sensitive surface** (routes/controllers,
  authorization middleware, database queries, anything handling user input) —
  diff-first is the default, never a limit on security judgment.
- **section-first (specs) via `spec-read`.** `sdd-code-review`,
  `sdd-security-gate`, `sdd-runtime-gate`, `sdd-verify`, and `sdd-commit` instruct
  `playbook spec-read <file>#<anchor>` to read only the relevant section; if the
  anchor is absent, they fall back to full-read and report why. This is the CLI
  command form of the "Section-first permanent spec context" convention above.
- `sdd-apply` and `sdd-archive` are excluded from both directives — they need the
  complete context to implement / to edit permanent source-of-truth files.

## Token-saving parity: packet consumers + spec-index discovery completed

Fixed in change `token-saving-parity`. The packet/spec-index design described
above ("Context packet convention", "Section-first permanent spec context")
had been only partially implemented after the specloom merge (ADR-026):
`sdd-commit` and `sdd-runtime-gate` did not actually read `context-packet.md`
(0 mentions in their canonical text — they re-read `proposal.md`+`tasks.md` in
full), two `spec-read` examples (`sdd-verify`, `sdd-commit`) pointed at
`proposal.md#...`/`tasks.md#...` — targets `spec-read` cannot read (see the CLI
spec's "Spec section reads" confinement to `openspec/specs/`) — and none of the
five section-first playbooks invoked `playbook spec-index` for anchor
discovery, so `.specloom/index/` never got created in a consumer project.

- `sdd-commit` and `sdd-runtime-gate` now read `context-packet.md` instead of
  the full `proposal.md`+`tasks.md`, completing the five designed consumers.
- The two misdirected `spec-read` examples now point at a permanent spec
  (`openspec/specs/system.md#code-conventions`); both playbooks state
  explicitly that proposal/tasks content comes from the packet, never from
  `spec-read`.
- All five section-first playbooks (`sdd-code-review`, `sdd-security-gate`,
  `sdd-runtime-gate`, `sdd-verify`, `sdd-commit`) now instruct `playbook
  spec-index` to build the index when discovering an unknown anchor, falling
  back to full-read + reporting the reason on failure — completing the
  discovery step "Section-first permanent spec context" above already
  prescribed but no playbook actually invoked.
- `test/skill-contract.test.js` carries content assertions for all of the
  above, so a future merge cannot silently disconnect any of it again (same
  enforcement pattern as the bootstrap re-run and `detect-siblings` fixes
  below).

## Bootstrap re-run: config as diff baseline, not completion signal

Fixed in change `bootstrap-repos-diff-on-rerun` (see ADR-028 for the full
decision and alternatives considered). Reported from real dogfooding: a
consumer project bootstrapped once, later added a new sibling repo, re-ran
`sdd-bootstrap-project`, and the new repo was never proposed.

- `detectSiblingRepos` (`src/config/detect-siblings.js`) is stateless — it
  reflects the current filesystem on every call, not what was true at the
  last bootstrap. It is invoked through `playbook detect-siblings` (see
  ADR-029) — the skill never runs the JS function directly.
- `sdd-bootstrap-project` paso 3 (sibling-repo detection) always re-invokes
  `playbook detect-siblings`, even on a re-run where `repos:` in
  `playbook.config.yaml` already has entries, and diffs its output against
  those already-confirmed repos, presenting only the new candidates.
- A populated `repos:` block is never, by itself, a reason to skip
  re-detection — reading it as "topology already resolved" is exactly the
  failure mode this fix closes.
- Scope is additive only: detecting repos removed or renamed after the
  first bootstrap is explicitly out of scope. The same re-run pattern in
  `sdd-bootstrap-project`'s other steps (capabilities, document mappings) is
  a separate decision, to be made only if that gap is independently
  confirmed (ADR-028).
- `test/skill-contract.test.js` carries a content assertion tying this
  instruction to the generated `SKILL.md`, so a future merge cannot silently
  disconnect it again.

## Skills invoke capabilities via `playbook` commands, never internal source references

Fixed in change `cli-detect-siblings` (see ADR-029 for the full decision and
alternatives considered). Prior to this fix, `sdd-bootstrap-project` paso 3
told the executing agent to run "`detectSiblingRepos` in
`src/config/detect-siblings.js`" — an internal JS function with no CLI wrapper,
forcing the agent to run arbitrary source by hand or eyeball the parent
directory. This was part of why the ADR-028 bootstrap re-run bug was so easy to
introduce: the fix said "re-invoke the detector" without a clean way to invoke it.

- A skill MUST invoke a capability through a stable `playbook <command>`, never
  by naming an internal source function or file path as the thing to execute.
- If a capability a skill needs is implemented in `src/` but has no CLI surface,
  a thin CLI command is added to expose it before the skill is wired to it —
  see `playbook detect-siblings` (`src/cli/repos.js`), a read-only wrapper over
  the unchanged `detectSiblingRepos`.
- An internal function/file reference in skill prose is allowed only as
  explanatory context (e.g. "the same heuristic as `detectSiblingRepos`"),
  never as the invocation mechanism.
- This is the same class of gap already closed for `spec-read`/`changed-files`
  (`wire-token-and-security-policy`) and generalizes to the remaining wiring
  gaps catalogued in the workspace migration plan (e.g. wiring
  `playbook spec-index` for discovery).
- `test/skill-contract.test.js` carries a content assertion tying
  `sdd-bootstrap-project` to `playbook detect-siblings`, so a future merge
  cannot silently disconnect it again.

## Security thread across `sdd-enrich-us` and `sdd-verify`

Repaired in change `wire-token-and-security-policy`. The thread that seeds and
then re-checks `SEC-N` security considerations had broken at both ends.

- **enrich seeds the SEC-N.** `sdd-enrich-us` lists "Security and data
  sensitivity" as a **mandatory** decision dimension to close before drafting the
  requirement — which data, permissions, or external input the feature touches
  and how each is protected. Its answers seed the proposal's `SEC-N` entries;
  it is never skipped, even when the closed answer is "no sensitive surface".
- **verify re-checks the SEC-N against merged code.** `sdd-verify` re-runs each
  `SEC-N`'s negative test against the **merged** code (never trusting the
  pre-merge `security-report.md`), emits a `## Security considerations` table in
  `verification-report.md`, and marks `status: failed` on any `SEC-N` lacking
  post-merge evidence. The report's security section is enforced by
  `playbook validate` — see the CLI spec's "Verification-report body validation".

## Canonical contract authoring belongs to `sdd-design`

Wired in change `contract-first-authoring` (see **ADR-030** for the full decision,
the two rejected alternatives, and the accepted risks). `README.md` promised that a
hub-owned API contract is authored in `openspec/specs/contracts/openapi.yaml`
"loom-first, during `sdd-plan`, feature by feature", but no playbook implemented it
(`grep -i 'openapi|contract-drift'` over `skills/` = 0). The contract in this repo
existed only because a human hand-wrote it, and `playbook init` does not scaffold
one. The earlier change `restore-contract-first` had already made the *verification*
half operational (`playbook contract-drift`, its config block, a CI template, 7
tests), which sharpened the gap rather than closing it: the hub could detect drift
against a contract nothing in the lifecycle ever wrote, so the canonical contract
would end up reverse-engineered from the implementation — the inversion
`source_of_truth: loom-first` exists to prevent.

- **`sdd-design` owns the authoring, `sdd-plan` must not.** When the proposal
  declares `impact.public_contract: true` **and** the project declares
  `contract.path_in_loom`, `sdd-design` adds or updates the feature's endpoints in
  that file as part of producing `design.md`. It is step 2 of `## Behavior` —
  before security refinement, so risk is classified against concrete endpoints.
- **Why the design stage.** `computeDesignRequired` (`src/lifecycle/impact.js`)
  returns true when *any* `proposal.impact.*` is true, so `public_contract: true`
  guarantees the design stage exists — the usual "design may be skipped" objection
  does not apply to this trigger. And `design.md` is the only pre-implementation
  artifact whose `status: approved` a **human** must set; `tasks.md` has no
  approval gate. A public contract shared across repositories gets the strongest
  gate the pre-implementation lifecycle has, not the weakest.
- **One sign-off, one set of endpoints.** The canonical contract and `design.md`'s
  `## Public contracts / interfaces` describe the same endpoints and are reviewed
  together. A mismatch is a design defect, not a formatting detail.
- **Path from config, contained to the repo.** The write target comes from
  `contract.path_in_loom` and is never hardcoded; there is no default fallback
  (`playbook contract-drift` exits `USAGE` when the key is absent). The resolved
  path must stay inside the project root — if it escapes, the step stops and
  reports instead of writing.
- **Contract-first stays opt-in.** With `impact.public_contract: true` but no
  `contract.path_in_loom`, the step is skipped and the skill says so explicitly. It
  never invents a path.
- **Create when absent.** When the configured path does not exist, `sdd-design`
  creates it with the minimal skeleton (`openapi`, `info`, `paths`) plus this
  feature's endpoints. Nothing else creates it — not `playbook init`, not bootstrap.
- **No secrets in the contract.** The authoring step forbids secrets, real tokens,
  and PII in `example`, `description`, or `servers`: the contract is a versioned
  artifact shared with every consumer repo, so a leak there is effectively
  permanent.
- **`contract-drift` is a detector, not the authoring mechanism.** It runs in the
  implementing repo's CI and detects nothing useful against `paths: {}`.
- `test/skill-contract.test.js` carries content assertions for all of the above —
  including a guard that `sdd-plan` never mentions `openapi`, and the negative half
  of the secrets rule (the skill text itself carries no credential-shaped literal)
  — so a future merge cannot silently disconnect any of it, the same enforcement
  pattern as the packet, `spec-index`, bootstrap re-run, and `detect-siblings`
  wirings above.

## Contract consumption wired into `sdd-plan` and `sdd-apply`

Fixed in change `contract-first-consumption` (see **ADR-038** for the
provider/consumer role decision and **ADR-039** for the three-condition
authoring trigger; both complement ADR-030 without superseding it). The
authoring half above made the canonical contract get written; nothing made it
get *read back*. Verified on `main` before this change: of 13 skills, only
`sdd-design` mentioned the contract — `sdd-plan` and `sdd-apply` had zero
mentions, and `context-packet.md` carried nothing about it. The result was
author-then-implement-from-memory, with `contract-drift` (when installed)
catching divergence only after the fact.

- **Guard tightened to three conditions.** `sdd-design`'s authoring guard now
  reads `impact.public_contract: true` **and** `contract.path_in_loom` **and**
  `capabilities.http: true` — the third condition stops a CLI-only change from
  triggering OpenAPI authoring just because `path_in_loom` happens to be
  configured (this repo's own case). Both skip cases (`http: false`; `http:
  true` but a non-HTTP public contract) declare the reason in `design.md`'s
  `## Public contracts / interfaces` — never silent. `playbook.config.yaml` is
  now read in `sdd-design`'s `## Context`, since the guard depends on it.
- **`sdd-plan` plans against the contract.** When `contract.path_in_loom`
  exists and the change touches the API, `sdd-plan` plans tasks against the
  contract's declared endpoints — reading by path from the hub, never copying
  it into the repo. If the path is declared but the file doesn't exist, it
  reports and continues without inventing endpoints (only `sdd-design`
  creates the contract).
- **`sdd-apply` reads it per role.** Provider and consumer have different
  obligations: the provider must fulfill the contract as its spec; the
  consumer reads it for what's available to call, including error codes to
  handle. `sdd-apply` states explicitly that declaring `provided_by` does not
  install `contract-drift` in that repo's CI — it stays a manual template
  step, so a declared role doesn't imply verified conformity.
- **Roles live in `contract:`, validated against `repos:`.** See the CLI
  spec's "Contract roles and consumption (ADR-038, ADR-039)" for the
  `provided_by`/`consumed_by` schema, the `validate` advisory notice, and the
  packet's `sources.contract` staleness wiring — this section covers the
  skill-prose half, that one the CLI/schema half.
- `test/skill-contract.test.js` carries content assertions for all of the
  skill-prose wiring above, so a future merge cannot silently disconnect it
  again.

## Retry-loop scope and the pwd/cap restoration

Fixed in change `convention-drift-verify-commit` (see **ADR-031** for the retry-loop
scope decision, its three rejected alternatives, and the accepted risks; ADR-011
remains in force and is not superseded). Two conventions ADR-011 had already decided
and named explicitly never reached the executing prompts:

- **`pwd` in `sdd-verify`.** ADR-011's `## Decision` names "`sdd-apply` **and
  `sdd-verify`**", and the cwd-safe section above said the same, but `grep -c pwd`
  over `skills/sdd-verify/canonical.md` returned **0** while `sdd-apply` had 2. Now
  wired at both of `sdd-verify`'s command-running points plus its `## Rules`.
- **Retry cap in `sdd-commit`.** ADR-011 names "`sdd-new` **and `sdd-commit`**", but
  `sdd-commit` step 1 read "Run `playbook validate` — stop on any violation": there
  was no loop at all. Restoring it therefore **introduced behavior**, not just text —
  `sdd-commit` no longer stops on a stale `context-packet.md`, it regenerates and
  retries.
- The restored text replicates specloom's **guard language**, not only the number:
  "don't reason about the reports yourself" and "at the 4th failed attempt, stop …
  without further blind edits". A cap without that guard invites exactly the blind
  iteration it exists to prevent.
- **A retry budget never overrides a security rule.** `sdd-commit` must never make
  `validate` pass by weakening a gate report's `status`, least of all
  `security-report.md`. This is the delivery-stage analogue of ADR-011's rule that
  the TDD cap can never mark a task complete while its security negative test is
  red, and it reinforces `sdd-commit`'s "Do not commit around a blocking finding".
- `test/skill-contract.test.js` carries content assertions for all of the above,
  including the **negative** half of the security rule (the skill text itself
  contains no instruction to write or flip a report status) and a guard that
  `sdd-apply` and `sdd-new` keep the conventions this change replicated **from** —
  if a source is deleted, the convention silently goes half-wired again.

### A content assertion proves presence, not reachability

The most valuable finding of this change came from its own `sdd-code-review`, and it
qualifies the enforcement pattern every wiring section above relies on:

> A content test verifies that an instruction **is present**. It does not verify that
> the instruction is **reachable** — that no earlier section of the same prompt
> contradicts or short-circuits it.

`sdd-commit`'s `## Preconditions (self-check)` said "`playbook validate` passes" and
"If any fail, stop and report". Preconditions are read **before** `## Behavior`, so
the straightforward reading ("validate fails → stop") made the new capped loop
**unreachable**, with every content assertion green. Shipped, the change would have
been a no-op that looked complete. The precondition now defers explicitly to step 1,
and an assertion requires that deference so the contradiction cannot return silently.

- **When wiring a new instruction into a playbook, re-read the sections the agent
  reads before reaching it** — typically `## Preconditions (self-check)`,
  `## Context` and `## Rules` — and confirm none of them negates it. Fix any
  contradiction in the same change and assert it.
- The three wirings merged before this one (`context-packet.md` in the five
  section-first playbooks, `playbook detect-siblings` in `sdd-bootstrap-project`,
  and canonical-contract authoring in `sdd-design`) were checked against this rule
  and are all reachable — verified, not assumed.

## The `cli` runtime adapter is excluded — with a stated criterion

Decided in change `delivery-state-branch-independence` (see **ADR-032** for the
alternatives and the accepted risk). `playbook-ai` declares `capabilities.cli: true`
— it *is* a CLI — and the `cli` adapter is **experimental**, so it `blocks` with
`ADAPTER_NOT_IMPLEMENTED` for any change that declares it relevant. Four consecutive
changes excluded it via `runtime_relevant_capabilities: []`, each re-justifying the
exclusion in its own proposal; for those four the justification was easy because none
of them touched `src/` at all. The fifth one did, and could not honestly reuse it.

An exclusion repeated five times with no stated criterion is a control decaying into
a formality. So the exclusion stands, and the criterion is now written down:

- **`cli` is excluded by default in this repository.** A change declares
  `runtime_relevant_capabilities: []` (or omits `cli`), and the runtime gate records
  the adapter as `not_applicable` pointing at this section — never as an unexplained
  omission.
- **Exclusion is not exemption from evidence.** When a change modifies observable CLI
  behavior, its `runtime-gate-report.md` MUST record real behavioral evidence: the
  actual invocation and its output **before and after** the change. The adapter is
  `not_applicable`; the evidence is not optional.
- **Unit tests carry the correctness burden.** A change to CLI behavior must have at
  least one test that **fails against the pre-change code**. That is the substantive
  gate; the recorded invocation corroborates it, it does not replace it.
- **The recorded invocation is a point-in-time capture, not a regression suite.** It is
  not re-run on later changes. What is re-run by `npm test` and CI is the unit test
  above, which is why rule 3 is not optional either.
- **The exclusion is not permanent.** If a change ever needs coverage that unit tests
  plus a recorded invocation cannot give — an interactive flow, or behavior across a
  real multi-repo topology — the harness gets implemented under its own change, rather
  than blocking that one.
- `worker` needs no criterion **in this repository**: `capabilities.worker: false`,
  so its adapter is `not_applicable` for the ordinary reason. Its support level
  for *consumer* projects is decided separately below — it is no longer
  experimental like `cli`.

## The `worker` runtime adapter is supported, with no declared dependency

Decided in change `runtime-gate-worker-supported` (see **ADR-041** for the
alternatives and the accepted risks). Until this change, `worker` was
**experimental** like `cli`: whenever a consumer project declared
`worker: true` and a change declared it relevant, the adapter `block`ed with
`ADAPTER_NOT_IMPLEMENTED` unconditionally — it could never emit `passed`,
regardless of evidence quality. A real consumer project
(`liacopilot/playbook-sdd`, change `lia-early-warning-detection`) hit exactly
that deadlock: `browser`/`http` fully passed, real tests covering the worker,
and the runtime gate still structurally unable to reach `passed`.

`worker` is promoted to **supported**, using the same no-declared-dependency
model `http` already uses (not the declared-MCP model `browser` uses via
`playwright-mcp`): no queue/worker runtime is universal enough to name as a
single dependency the way Playwright covers browsers, and naming one would
exclude most real projects.

- **No new project-side configuration.** `playbook.config.yaml` gains no new
  field. The agent running `sdd-runtime-gate` inspects the project's own
  code/tests to find how it actually enqueues and processes jobs, and drives
  that mechanism for real.
- **Real-evidence checklist**, analogous to `http`'s: a real trigger, real
  processing by the real consumer, an observed side effect matching intent, a
  verified retry/dead-letter path, and (when the proposal marks it relevant)
  idempotency under duplicate delivery. `blocked` keeps the existing reason
  codes (`DEPENDENCY_UNAVAILABLE` / `INSUFFICIENT_EVIDENCE`) — no new one was
  introduced.
- **Safety rule (SEC-001).** Evidence-gathering must never fire a real
  irreversible external effect (a real payment, a real email/SMS, a real
  third-party call). The project's own test/sandbox double for that effect
  must be used; with none available, the finding is `blocked`, never a
  fabricated `passed`. Referenced from both `sdd-runtime-gate`'s top-level
  `## Rules` and its detailed `worker` section, so the rule survives even if a
  reader only reaches the section that renders first.
- **`playbook-ai` cannot dogfood this adapter** (`capabilities.worker: false`
  here, honestly — see the bullet above). Verified instead through unit tests
  of the pure planning functions and content checks on the generated skill
  text; the first real exercise of the adapter happens in a consumer project.
- **`cli` is unaffected.** ADR-032's criterion stands exactly as written —
  this decision does not reopen it.
