---
slug: sdd-commit
title_en: "SDD Commit — Commit and Open Pull Request"
title_es: "SDD Commit — Commit y Abrir Pull Request"
description: "Create a Conventional Commits commit, push the branch, and open a GitHub Pull Request with an inline-generated PR description. Activate when the user says \"sdd-commit\", \"commit and open PR\", \"push and PR\", or asks to commit the SDD implementation and open a pull request. Requires Copilot agent mode with terminal access and authenticated GitHub CLI."
description_es: "Genera un commit estructurado, hace push y abre un Pull Request con descripción inline. Requiere gh CLI autenticado."
when_es: "Después de `/sdd-code-review` (veredicto READY FOR PR) y opcionalmente después de `/sdd-ux-gate` (veredicto READY FOR PR UX)."
output_file: ""
verdict_pass: ""
verdict_fail: ""
requires_terminal: true
---

## Purpose

Create a structured commit for the SDD implementation, push the branch, and open a Pull Request with a reviewer-friendly description generated inline.

> **Requires Copilot agent mode** — this skill runs `git` and `gh` terminal commands.  
> **Requires GitHub CLI** (`gh`) authenticated to the repository.

Do not commit if `code-review-report.md` verdict is `REQUIRES FIXES`.

---

## Context

Read before committing:

1. `openspec/changes/[ticket-slug]/proposal.md` — feature name and ticket reference
2. `openspec/changes/[ticket-slug]/code-review-report.md` — must have verdict `READY FOR PR`

Then run:
```bash
git status
git diff --stat
```

---

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

---

## Output

- Commit pushed to remote branch
- Pull Request opened (URL reported to user)

---

## Rules

- Never commit if `code-review-report.md` verdict is `REQUIRES FIXES`.
- Never commit `.env`, secrets, or build artifacts.
- Always generate the PR description inline following the rules in step 5 — never delegate to an external skill.
- Commit message must be in English.
- Do not force-push unless the user explicitly requests it.

<!-- END_SKILL -->

---

## Objetivo

Generar un commit estructurado para la implementación SDD, hacer push y abrir un Pull Request con descripción generada inline para el revisor humano.

---

## Instrucciones

1. Lee `openspec/changes/[ticket-slug]/code-review-report.md`. Si el veredicto es `REQUIERE CORRECCIONES`, detente y lista los issues. No continuar.
2. Ejecuta `git status` y `git diff --stat` para ver todos los cambios.
3. Confirma que la rama actual coincide con `[ticket-slug]`.
4. Stagea solo los archivos que pertenecen a esta feature. Nunca stagear `.env`, `public/build/`, ni archivos de otras features.
5. Construye el commit message en Conventional Commits: `feat(module):`, `fix(module):`, etc. Sujeto ≤72 chars, imperativo, sin punto final. Body: qué cambió y por qué.
6. Ejecuta `git commit` y `git push origin [ticket-slug] --set-upstream`.
7. Genera la descripción del PR inline (150-300 palabras, para revisor humano, sin mencionar openspec/ ni "IA"):
   - Secciones: Summary / What Changed / Validation / Reviewer Notes / Risks / Rollback
8. Abre el PR: `gh pr create --title "..." --body "..." --base main`.
9. Reporta: archivos commiteados, hash del commit, URL del PR.

---

## Checklist

- [ ] `code-review-report.md` con veredicto `READY FOR PR` leído
- [ ] `git status` ejecutado — archivos identificados
- [ ] Solo archivos de esta feature stageados (sin `.env`, sin `public/build/`)
- [ ] Commit message en Conventional Commits, ≤72 chars, imperativo
- [ ] `git push` con `--set-upstream` exitoso
- [ ] Descripción del PR generada inline (150-300 palabras)
- [ ] PR abierto con `gh pr create`
- [ ] URL del PR reportada al usuario

---

## Formato de reporte

No genera archivo. Reporta al usuario: lista de archivos commiteados, hash del commit y URL del PR.

---

## Criterio de bloqueo

No commitear si `code-review-report.md` tiene veredicto `REQUIERE CORRECCIONES`. No force-push sin solicitud explícita del usuario.

---

## Qué NO reemplaza

- La aprobación humana del PR
- La revisión de conflictos de merge con main
- El deploy a producción
