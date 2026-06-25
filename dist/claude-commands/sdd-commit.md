# /sdd-commit — SDD Commit — Commit and Open Pull Request

## Usage

```
/sdd-commit [ticket-slug]
```

## When to run

Después de `/sdd-code-review` (veredicto READY FOR PR) y opcionalmente después de `/sdd-ux-gate` (veredicto READY FOR PR UX).

## Purpose

Create a structured commit for the SDD implementation, push the branch, and open a Pull Request with a reviewer-friendly description generated inline.

> **Requires Copilot agent mode** — this skill runs `git` and `gh` terminal commands.  
> **Requires GitHub CLI** (`gh`) authenticated to the repository.

Do not commit if `code-review-report.md` verdict is `REQUIRES FIXES`.

## Context

Read before committing:

1. `openspec/changes/[ticket-slug]/proposal.md` — feature name and ticket reference
2. `openspec/changes/[ticket-slug]/code-review-report.md` — must have verdict `READY FOR PR`

Then run:
```bash
git status
git diff --stat
```

## Behavior

### 1. Validate pre-conditions

- Read `code-review-report.md`. If verdict is `REQUIRES FIXES`, stop and list the issues. Do not proceed.
- Run `git status` to list all modified files.
- Confirm the current branch name matches `[ticket-slug]`.

### 2. Stage changes

- Stage all files that belong to this feature.
- If unrelated changes are present, stage only feature-related files using `git add [file] [file]`.
- Never stage `.env`, build artifacts (`public/build/`), or files from other features.

### 3. Build commit message

Use Conventional Commits format:

| Prefix | When to use |
|---|---|
| `feat(module):` | New user-facing feature |
| `fix(module):` | Bug fix |
| `refactor(module):` | Refactoring without behavior change |
| `test(module):` | Tests only, no production code |
| `chore(module):` | Tooling, config, no logic change |

Subject line: imperative mood, ≤72 chars, no period at the end.  
Body: what changed and why. Include spec reference.

### 4. Commit and push

```bash
git commit -m "[type]([module]): [subject]

[body paragraph explaining what and why]

Spec: openspec/changes/[ticket-slug]/proposal.md"

git push origin [ticket-slug] --set-upstream
```

### 5. Generate PR description

Before opening the PR, produce the PR description following these rules:

- **Length**: 150–300 words
- **Audience**: human reviewer, not documentation
- **No internal artifacts**: never mention `openspec/changes/`, task briefs, specs, or "AI-generated"
- **Structure** (fixed):

```markdown
# <Short title>

## Summary
<2–3 sentences>

## What Changed
- grouped by area: Backend, Frontend, Tests

## Validation
### Automated
<passing tests>
### Manual
<steps or "None">

## Reviewer Notes
<where to focus>

## Risks
<only real risks, or omit>

## Rollback
<one sentence>
```

Run `git diff main...[branch]` to inspect changes before writing the description.

### 6. Open Pull Request

```bash
gh pr create \
  --title "[type]([module]): [subject]" \
  --body "[PR description from step 5]" \
  --base main
```

### 6. Confirm

Report: list of committed files, commit hash, PR URL.

## Output

- Commit pushed to remote branch
- Pull Request opened (URL reported to user)

## Rules

- Never commit if `code-review-report.md` verdict is `REQUIRES FIXES`.
- Never commit `.env`, secrets, or build artifacts.
- Always generate the PR description inline following the rules in step 5 — never delegate to an external skill.
- Commit message must be in English.
- Do not force-push unless the user explicitly requests it.
