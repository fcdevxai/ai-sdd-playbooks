---
status: implemented
owner: bernardo
last_updated: 2026-07-23
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
- `sdd-apply` and `sdd-verify` must verify `pwd` before running commands from `tasks.md` and must not assume cwd state carried over from a previous step.
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
