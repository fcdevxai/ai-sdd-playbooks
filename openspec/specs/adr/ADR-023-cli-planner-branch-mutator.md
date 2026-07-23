---
status: accepted
date: 2026-07-08
ticket: multi-repo-commit-orchestration
---

# ADR: la CLI planifica multi-repo; `prepare-repos` es el único mutador (solo branches)

## Context

ADR-020 estableció `config.yaml repos` como sustrato de ejecución multi-repo, pero hasta hoy los únicos consumidores lo usan para *ejecutar comandos* (`gate-check`, `run --repo`) o *leer* (`changed-files --repo`). El cierre end-to-end de un change que toca varios repos (commit/push/PR por repo) no existe: `sdd-commit` es single-repo.

Al diseñar esa capacidad aparece una decisión difícil de revertir: ¿cuánto estado git debe *mutar* specloom en los repos hermanos? El modelo histórico del CLI es planificador + telemetría; el único mutador existente es `loom adr promote`, y solo actúa en el propio repo SDD (rename + `git add`, argv sin shell, con verificación de staged-vs-disk). Hacer que specloom haga `checkout -b`, `add`, `commit`, `push` en working trees ajenos sería un salto de superficie y de riesgo (secretos, force-push accidental, mezcla de features).

La fuerza en tensión: máxima automatización para el agente vs. mantener el modelo planner-only auditable que sostienen ADR-018/020/021.

## Decision

specloom **planifica**; el agente y `gh` **ejecutan**. En concreto:

- `loom repo-plan <ticket>` y `loom commit-plan <ticket>` son **read-only**: no tocan git ni el filesystem de ningún repo. Emiten un plan determinista y (en `commit-plan`) un PR payload por repo.
- El **único** comando que muta es `loom prepare-repos <ticket>`, y su mutación se limita a **preparación de branch**: crear `[ticket-slug]` desde la base resuelta si no existe, o cambiar a `[ticket-slug]` si ya existe.
- `prepare-repos` **nunca** hace checkout destructivo, `git add`, `git commit`, `git push`, ni `--force`. Si un repo tiene un blocker (p.ej. dirty en branch equivocada), lo salta y lo reporta; no lo muta.
- staging/commit/push por repo los ejecuta el agente siguiendo el plan; specloom **nunca** invoca `gh` (los PRs los abre gh/el agente con el payload). Excepción acotada: el merge-check read-only de `sdd-archive` (`gh pr view --json state`).
- Todas las operaciones git usan argv sin shell, igual que `adr promote` y `gate-check`.

Extiende ADR-020 (no lo reemplaza): el formato y el trust model de `repos` no cambian; se amplían los consumidores con una regla clara de mutación.

## Consequences

### Positive

- Cierra el hueco real (implementación en repo hermano quedaba sin commit) sin convertir a specloom en un motor de git sobre working trees ajenos.
- La superficie mutadora nueva es mínima y testeable en aislamiento (solo creación/cambio de branch).
- El agente conserva control de staging/commit/push, donde vive el juicio de "qué es un commit correcto".

### Negative

- El agente sigue ejecutando git a mano para staging/commit/push; specloom no lo automatiza de punta a punta.
- Introduce igualmente un mutador nuevo (`prepare-repos`) que actúa fuera del repo SDD, ampliando la superficie respecto al statu quo planner-only estricto.

### Risks

- Un `prepare-repos` mal implementado podría cambiar de branch sobre un working tree dirty y arriesgar pérdida de contexto; mitigación: rechaza mutar cualquier repo con blocker (dirty/branch equivocada/git ambiguo) y se documenta como surface en docs/security-checklist.md.
- El agente podría ignorar los blockers del plan y forzar git a mano; mitigación: los playbooks instruyen detenerse ante blockers, pero la barrera última sigue siendo el juicio humano/CI.

## Alternatives considered

### specloom stagea/commitea/pushea en repos hermanos

Descartada: máxima automatización pero rompe el modelo planner-only, multiplica el riesgo de commitear secretos o hacer force-push desde el CLI, y complica enormemente el testing (mutación de múltiples working trees reales).

### 100% planner, cero mutación (ni branches)

Descartada: dejaría toda la preparación de branch al agente vía git crudo, que es justo la fricción frágil que ADR-020 quiso eliminar para `run`. Preparar branch de forma segura y determinista es una primitiva que vale la pena centralizar.

## Impact

- backend: sin impacto (specloom no tiene backend; aplica a los repos del consumer)
- frontend: sin impacto
- security: nuevo surface mutador (`prepare-repos` cambia branch en repos hermanos) documentado en docs/security-checklist.md; sin force-push; git por argv sin shell; sin `gh` en runtime salvo merge-check read-only
- data: sin impacto
- deployment: sin impacto
- testing: agrega tests de preparación de branch (crear/cambiar) y de negativa a mutar repos con blocker
