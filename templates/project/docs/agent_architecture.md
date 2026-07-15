# Agent architecture

> How AI agents operate in this repo: what to read, how to work each task type,
> which skill to activate, and where the boundaries are. The SDD skills are
> global and the `sdd` CLI drives the lifecycle — this doc is the project-local
> "how we work here" layer on top.

For technical structure (layers, placement), read
[doc_architecture.md](doc_architecture.md). For verification commands and test
strategy, read [doc_verification_guide.md](doc_verification_guide.md). For the
SDD lifecycle and gates, read [sdd-workflow.md](sdd-workflow.md). For stable
product context, read [../AGENTS.md](../AGENTS.md) / [../CLAUDE.md](../CLAUDE.md).

## Pre-implementation checklist

Before writing code:

1. Read the active SDD artifacts for the current phase (`sdd status` / `sdd next`).
2. Confirm the proposal has the approval state the workflow requires.
3. Read `openspec/specs/system.md` and the affected module spec.
4. Read `doc_architecture.md` for placement and `doc_verification_guide.md` for the checks.
5. Identify the exact approved file boundary (including tests).
6. If the requirement or a contract is ambiguous, stop and report it — do not assume.

## Task-type workflows

<tailor these to your project; keep them short and enforceable>

- **Feature** — read the approved proposal/design/tasks → find an existing pattern → failing test first → smallest change that meets the acceptance criteria → run the verification set.
- **Bug fix** — reproduce with a failing test → fix the root cause (no unrelated refactor) → run the regression + affected area.
- **Refactor** — establish a passing baseline → incremental changes, re-run focused tests → no behavior/contract change.

## Skill activation

Let `sdd next` route you; activate the skill for the current phase rather than
recreating its behavior by hand.

| When the task is… | Skill |
|---|---|
| Shaping a user story / new change | `sdd-new` (after `sdd-enrich-us`) |
| Designing the technical contract | `sdd-design` |
| Planning tasks | `sdd-plan` |
| Implementing | `sdd-apply` |
| Reviewing before merge | `sdd-code-review` |
| Verifying / archiving | `sdd-verify` / `sdd-archive` |

<add project-specific domain skills here>

## Boundaries & anti-patterns

Do not:

- implement before reading the active SDD artifacts,
- modify files outside the approved boundary,
- skip a gate or fabricate verification evidence,
- mix unrelated refactoring with feature work,
- assume an undefined contract instead of asking.

<add the boundaries specific to this repo — ownership, integrations, data>
