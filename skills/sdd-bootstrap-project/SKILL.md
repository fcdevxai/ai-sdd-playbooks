---
name: sdd-bootstrap-project
description: "AI-assisted onboarding of an existing repository into SDD: inspect the codebase, propose the project capabilities (browser/http/cli/worker), propose document mappings and improved AGENTS.md/docs content, present a diff, and write ONLY on human approval. Activate when the user says 'sdd-bootstrap-project', 'onboard this repo into SDD', or after 'sdd init' leaves capabilities unset or reports ambiguous documents."
lifecycle_stage: null
produces: []
requires: {}
version: 2.0.0
---

## Purpose

`sdd init` is deliberately conservative: it scaffolds `sdd.config.yaml` with all
capabilities `false` and never adopts an ambiguous document or rewrites content.
This skill does the **AI-assisted** part — capability detection, semantic doc
analysis, and refactoring — but it is **diff-then-approve**: it proposes, a human
decides.

## Behavior

1. **Inspect** the repository: stack, layout, dependencies, existing docs
   (READMEs, `docs/*`, architecture/verification notes in any language), and the
   current `sdd.config.yaml` if present.

2. **Detect and propose capabilities.** `sdd init` leaves `capabilities` all
   `false`, which would make `sdd-runtime-gate` skip everything. Propose the real
   ones from concrete signals (never guess silently). Heuristics:
   - **browser** — a frontend dependency (`react`, `vue`, `@angular/core`,
     `svelte`, `next`, `nuxt`, `astro`, `solid-js`, `preact`), an `index.html`,
     or Playwright present.
   - **http** — a server framework (`express`, `fastify`, `koa`, `@nestjs/core`,
     `hapi`, `next`), a `composer.json` (PHP web app), or a Python web framework
     (`fastapi`/`flask`/`django`).
   - **cli** — a `bin` field in `package.json`.
   - **worker** — a queue/broker dependency (`bullmq`, `bull`, `kafkajs`,
     `amqplib`, Pub/Sub, SQS) or `celery`.

   Present the proposed `capabilities:` block with the **signal** behind each
   `true` (e.g. "browser: found `react`"). If a capability can't be inferred,
   leave it `false` and say so. Reminder: `http: true` alone is not `elevated`;
   `cli`/`worker` are experimental adapters that block when enabled.

3. **Propose document mappings** for the logical docs (`system_spec`,
   `architecture`, `verification`, `workflow`) — e.g. map `docs/Arquitectura.md`
   to `architecture` — instead of creating duplicates. Explain each mapping.

4. **Propose content improvements** (e.g. fill in `AGENTS.md`, tighten
   `docs/architecture.md`) drawn from the real code.

5. **Present a diff** of every proposed change (config `capabilities:` and
   `documents:` edits, and any doc edits). Do not write yet.

6. **Write only on explicit human approval.** If the human declines, make **no
   changes** — this is a no-op. Apply exactly what was approved, nothing more.

## Rules

- Never write a file (including `sdd.config.yaml`) before the human approves the diff.
- Never overwrite a document's content without showing the diff first.
- Declining leaves the repository byte-for-byte unchanged.
- Prefer adoption-by-config (point `documents:` at existing files) over creating
  new files or renaming the user's files.
