---
name: sdd-bootstrap-project
description: "AI-assisted onboarding of an existing repository into SDD: inspect the codebase, propose the project capabilities (browser/http/cli/worker), propose sibling repos for multi-repo topology (repos:), propose document mappings and improved AGENTS.md/docs content, refresh a stale docs/sdd-workflow.md, present a diff, and write ONLY on human approval. Activate when the user says 'sdd-bootstrap-project', 'onboard this repo into SDD', after 'playbook init' leaves capabilities unset or reports ambiguous documents, or after 'playbook doctor' warns that the workflow doc predates the installed methodology."
description_es: "Onboarding asistido por IA de un repositorio existente a SDD: inspeccionar el código, proponer capabilities (browser/http/cli/worker), proponer repos hermanos para la topología multi-repo (repos:), proponer mapeos de documentos y mejoras de contenido para AGENTS.md/docs, refrescar un docs/sdd-workflow.md obsoleto, presentar un diff, y escribir SOLO con aprobación humana."
title_en: "SDD Bootstrap Project — AI-Assisted Onboarding"
title_es: "SDD Bootstrap Project — Onboarding Asistido"
when: "Right after `playbook init` when capabilities are all false, or when `playbook doctor` warns the workflow doc is stale."
output_file: "N/A — proposes a diff (playbook.config.yaml, documents:, docs content); writes only on explicit human approval"
requires_terminal: false
lifecycle_stage: null
produces: []
requires: {}
version: 0.1.0
---

## Purpose

`playbook init` is deliberately conservative: it scaffolds `playbook.config.yaml`
with all capabilities `false` and never adopts an ambiguous document or
rewrites content. This skill does the **AI-assisted** part — capability
detection, semantic doc analysis, and refactoring — but it is
**diff-then-approve**: it proposes, a human decides.

## Behavior

1. **Inspect** the repository: stack, layout, dependencies, existing docs
   (READMEs, `docs/*`, architecture/verification notes in any language), and the
   current `playbook.config.yaml` if present.

2. **Detect and propose capabilities.** `playbook init` leaves `capabilities` all
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

3. **Propose sibling repos for multi-repo topology (`repos:`).** Run the
   sibling detector — the same canonical, tested heuristic this skill applies
   (`detectSiblingRepos` in `src/config/detect-siblings.js`): it lists every
   **git-repo directory next to this one** (the parent directory), with a
   lightweight stack guess (reusing the capability signals above) and naming
   hints (`sharedTokensWithOwn`, `cluster`).

   **Naming affinity is a sort hint, never a filter.** A real hub can be named
   `playbook-ai` while its siblings are plainly named `frontend`/`backend` —
   they share no token, and the detector still lists them. A dev machine's
   parent directory is typically full of **unrelated** repos (other clients,
   old experiments, clones) — never silently include or exclude a candidate
   based on naming alone; every git-repo sibling is a candidate, sorted so the
   likelier ones (shared token with this repo's name, or clustered with
   another candidate — e.g. `myproduct-search` + `myproduct-worker`) surface
   first.

   Present the **full candidate list** (not a pre-filtered subset) with each
   one's detected stack and why it was sorted where it is, and
   `AskUserQuestion` (multi-select) which ones are actually part of this
   project. For each confirmed repo, also ask:
   - Its **verification commands** (`test`, `lint`, `build`, ...) — do not
     guess a command that might not exist; if a `package.json` `scripts` entry
     looks like an obvious match (e.g. `test`), propose it for confirmation,
     never assume it silently.
   - Whether this repo (almost always the one bootstrap is running in) is the
     **SDD hub** (`role: sdd`) — at most one repo may carry this role.

   Skip this step entirely (propose nothing) if the parent directory has no
   git-repo siblings, or if the human says this is a single-repo project.

   **On a re-run, `repos:` already having entries is never a reason to skip
   this step.** `detectSiblingRepos` is stateless — it reflects the current
   filesystem, not what was true at the last bootstrap. Always re-invoke it,
   diff its output against the repos already confirmed in
   `playbook.config.yaml`, and present only the candidates not already
   listed there. Do not re-propose already-confirmed repos as if they were
   new, and do not read a populated `repos:` block as "topology already
   resolved" — that reading is exactly how a sibling repo added after the
   first bootstrap goes undetected.

4. **Propose document mappings** for the logical docs (`system_spec`,
   `agent_architecture`, `architecture`, `verification`, `workflow`) — e.g. map
   `docs/Arquitectura.md` to `architecture`, or an existing agent guide to
   `agent_architecture` — instead of creating duplicates. Keep `agent_architecture`
   (how agents operate) distinct from `architecture` (technical structure); never
   map one file to both. Explain each mapping.

5. **Propose content improvements** (e.g. fill in `AGENTS.md`, tighten
   `docs/doc_architecture.md`, seed `docs/security-checklist.md`'s
   project-specific rows) drawn from the real code.

6. **Detect a stale workflow doc and propose a refresh.** The `workflow` doc
   (default `docs/sdd-workflow.md`) carries a `<!-- sdd-methodology: X.Y -->`
   marker — the same one `playbook doctor` checks. If it is missing, or its
   major is older than the installed methodology (`playbook --version`),
   propose replacing the doc's content with the **canonical current version**:
   - Locate the currently-installed `playbook` package (e.g. resolve the
     `playbook` binary — `which playbook` / its realpath — up to its package
     root, or `npm root -g`) and read its shipped
     `templates/project/docs/sdd-workflow.md`. That file is the methodology's
     generic, canonical workflow doc — never project-specific.
   - Propose a **full replacement**, not a merge: this doc describes the shared
     SDD lifecycle, so it should match the installed methodology exactly.
   - If the existing doc has clearly project-specific additions beyond the
     generic lifecycle description, call them out separately and ask whether to
     preserve them elsewhere (e.g. `AGENTS.md`) instead of silently dropping them.

7. **Present a diff** of every proposed change (config `capabilities:`,
   `repos:`, and `documents:` edits, and any doc edits, including the
   workflow-doc refresh). Do not write yet.

8. **Write only on explicit human approval.** If the human declines, make **no
   changes** — this is a no-op. Apply exactly what was approved, nothing more.
   A partial approval (e.g. capabilities yes, `repos:` no) applies only the
   approved parts.

## Rules

- Never write a file (including `playbook.config.yaml`) before the human approves the diff.
- Never overwrite a document's content without showing the diff first.
- Declining leaves the repository byte-for-byte unchanged.
- Prefer adoption-by-config (point `documents:` at existing files) over creating
  new files or renaming the user's files — except the `workflow` doc's content,
  which is methodology-owned and gets a full refresh proposal when stale, not a
  path remap.
- Naming affinity (`sharedTokensWithOwn`/`cluster`) sorts sibling-repo
  candidates; it never filters them. List every git-repo sibling, even ones
  that look unrelated — a human quickly says no to noise, but a silently
  dropped real sibling is a harder mistake to notice.
- Never guess a `repos.<name>.verification` command; propose a `package.json`
  script as a suggestion when one looks like an obvious match, otherwise ask.
