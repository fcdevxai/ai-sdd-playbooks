---
name: sdd-bootstrap-project
description: "AI-assisted onboarding of an existing repository into SDD: inspect the codebase and docs, propose document mappings and improved AGENTS.md/docs content, present a diff, and write ONLY on human approval. Activate when the user says 'sdd-bootstrap-project', 'onboard this repo into SDD', or after 'sdd init' reports ambiguous documents."
lifecycle_stage: null
produces: []
requires: {}
version: 2.0.0
---

## Purpose

`sdd init` is deliberately conservative: it never adopts an ambiguous document
and never rewrites content. This skill does the **AI-assisted** part — the
semantic analysis and refactoring — but it is **diff-then-approve**: it proposes,
a human decides.

## Behavior

1. **Inspect** the repository: stack, layout, existing docs (READMEs, `docs/*`,
   architecture/verification notes in any language), and the current
   `sdd.config.yaml` if present.
2. **Propose document mappings** for the logical docs (`system_spec`,
   `architecture`, `verification`, `workflow`) — e.g. map `docs/Arquitectura.md`
   to `architecture` — instead of creating duplicates. Explain each mapping.
3. **Propose content improvements** (e.g. fill in `AGENTS.md`, tighten
   `docs/architecture.md`) drawn from the real code.
4. **Present a diff** of every proposed change (config `documents:` edits and any
   doc edits). Do not write yet.
5. **Write only on explicit human approval.** If the human declines, make **no
   changes** — this is a no-op. Apply exactly what was approved, nothing more.

## Rules

- Never write a file (including `sdd.config.yaml`) before the human approves the diff.
- Never overwrite a document's content without showing the diff first.
- Declining leaves the repository byte-for-byte unchanged.
- Prefer adoption-by-config (point `documents:` at existing files) over creating
  new files or renaming the user's files.
