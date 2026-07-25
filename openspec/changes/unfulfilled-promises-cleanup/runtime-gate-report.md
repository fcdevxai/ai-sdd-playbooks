---
schema: runtime-gate-report
schema_version: 1
change_id: unfulfilled-promises-cleanup
status: not_applicable
updated: 2026-07-24
adapters:
  browser: { status: not_applicable }
  http: { status: not_applicable }
  cli: { status: not_applicable, reason_code: NOT_RELEVANT_TO_CHANGE }
  worker: { status: not_applicable }
---
# Runtime Gate Report — Cerrar las promesas incumplidas del CLI, la distribución y las specs

## browser — not_applicable
`playbook.config.yaml` declares `browser: false`. No UI surface in this project.

## http — not_applicable
`playbook.config.yaml` declares `http: false`. No HTTP surface in this project.

## worker — not_applicable
`playbook.config.yaml` declares `worker: false`. No background workers in this project.

## cli — not_applicable (NOT_RELEVANT_TO_CHANGE)
`playbook.config.yaml` declares `cli: true` (experimental adapter — would normally
block with `ADAPTER_NOT_IMPLEMENTED` when relevant), but `proposal.md` declares
`runtime_relevant_capabilities: []`, explicitly excluding it for this change. Per
the excluded-capability rule, this is `not_applicable`, not `blocked`.

The proposal's own constraint states the exclusion does not exempt this change
from evidence, since it modifies observable CLI behavior: "debe traer al menos
un test que falle contra el código previo y registrar en `runtime-gate-report.md`
la invocación real antes y después." That negative-test requirement is already
satisfied per-task (each task's TDD loop required a red test against the
pre-change code — see `tasks.md` Execution Report). The real before/after
invocation evidence follows, gathered by driving the actual CLI against
disposable scratch targets via the `PLAYBOOK_CLAUDE_SKILLS_DIR` /
`PLAYBOOK_AGENTS_SKILLS_DIR` env overrides (built for exactly this — CI/tests
never touch the real home directory).

### Evidence 1 — link mode goes from invisible to reported (AC-7, AC-8)

Before this change, `install --link` did not exist and `doctor` had no concept
of a linked install. After:

```
$ playbook install --link --yes   # (scratch target)
playbook install — methodology 0.1.0
  mode: link (dev-only — symlinks to this checkout)
  → claude (Claude Code): <scratch>/rtgate-claude
  → agents (GitHub Copilot + Codex): <scratch>/rtgate-agents

$ playbook doctor   # (same scratch target)
  ✓ healthy
  note: Claude Code install is linked to /home/berna/compare_sdd/lablab-playbook-ai-v2 — content verified by symlink resolution, not by digest
  note: GitHub Copilot + Codex install is linked to /home/berna/compare_sdd/lablab-playbook-ai-v2 — content verified by symlink resolution, not by digest
```

### Evidence 2 — hand-modified installed `SKILL.md` goes from silent to a blocking problem (AC-6)

```
$ playbook install --yes   # copy mode (scratch target)
$ playbook doctor
  ✓ healthy

$ echo "TAMPERED CONTENT" >> <scratch>/rtgate2-claude/sdd-apply/SKILL.md

$ playbook doctor
  ✗ Claude Code install: sdd-apply/SKILL.md content differs from what `playbook install` recorded — re-run `playbook install`
```

Before this change (no manifest, no digest verification), this tamper would
have produced no diagnostic at all. After, `doctor` reports a blocking problem
naming the exact skill and file, with the remedy.

### Evidence 3 — dangling symlink after a moved/deleted checkout (AC-8, EC-1)

```
$ ln -sf /nonexistent/checkout/skills/sdd-apply/SKILL.md <scratch>/rtgate-claude/sdd-apply/SKILL.md
$ playbook doctor
  ✗ Claude Code install is missing core skill sdd-apply (<scratch>/rtgate-claude)
  ✗ Claude Code install has invalid skill sdd-apply: no SKILL.md
  ✗ Claude Code install: sdd-apply/SKILL.md is a dangling symlink (source moved or deleted) — re-run `playbook install --link`
$ echo "exit: $?"
exit: 0
```

No unhandled exception; exit 0; clear remedy.

### Evidence 4 — postinstall message-only signal (AC-10)

```
$ node scripts/postinstall.cjs
playbook-ai 0.1.0 installed.
Run `playbook install` to (re)install the global Agent Skills.
$ echo "exit: $?"
exit: 0
```

Two lines, names `playbook install`, exits 0.

All scratch target directories used above were removed after evidence
collection; nothing outside them (including the real `~/.claude/skills` /
`~/.agents/skills` used by this dogfooding checkout) was touched.
