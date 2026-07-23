---
status: accepted
date: 2026-07-03
ticket: spec-lint-required-check
---

# ADR: Los required status checks nunca filtran con `on.paths`; el filtrado de paths vive dentro del job

## Context

GitHub branch protection permite marcar un workflow como "required status check". Sin embargo, si el workflow declara `on.pull_request.paths`, los PRs cuyo diff no coincide con esos paths **nunca reportan el check** — GitHub no lo marca como "skipped", lo deja en estado "pendiente" indefinidamente. El resultado: cada PR fuera de los paths filtrados queda bloqueado para merge y exige un bypass manual de admin.

specloom quiere poder marcar `spec-lint` como required en `main` (tanto en este repo como en los proyectos consumidores del template) para forzar de verdad que ningún PR de ticket SDD se mergee sin pasar `loom validate`, sin castigar con un bloqueo permanente a los PRs que no tocan `openspec/changes/**` (docs, CI, config).

Las fuerzas en tensión: (a) el check debe reportarse en el 100% de los PRs para que branch protection funcione; (b) no queremos gastar minutos de CI (`npm ci` + validación) en PRs donde no hay nada SDD que validar.

## Decision

- Un workflow destinado a ser required status check **nunca** usa `paths:` (ni `paths-ignore:`) a nivel de trigger (`on.pull_request`).
- El filtrado de paths se implementa como un **paso temprano dentro del job** que inspecciona el diff del PR contra la base (`git diff --name-only <base.sha>...HEAD`) y publica un output booleano.
- Los pasos costosos (setup de toolchain, instalación de dependencias, validación) se condicionan con `if:` sobre ese output. Cuando el diff no aplica, el job termina en **éxito** de inmediato.
- Esta convención aplica a `spec-lint.yml` (repo propio y template) y a cualquier workflow futuro de specloom que aspire a ser required check.

## Consequences

### Positive

- `spec-lint` puede marcarse como required en branch protection sin bloquear PRs no-SDD ni requerir bypass de admin.
- El check aparece en verde en todos los PRs, dando señal explícita ("validado" o "no aplica") en vez de ausencia de señal.
- El costo de CI en PRs no-SDD es mínimo: un checkout + un `git diff`, sin `npm ci` ni validación.

### Negative

- Todo PR ejecuta al menos un checkout con `fetch-depth: 0` (historia completa), un costo pequeño pero no nulo que antes solo pagaban los PRs SDD.
- La lógica de filtrado vive en bash dentro del YAML en vez de declarativa en el trigger — es menos visible a simple vista y debe mantenerse a mano en cada workflow que siga la convención.

### Risks

- Si el patrón del `grep` del paso de filtrado se desalinea con los paths que realmente importan (p. ej. se renombra `openspec/changes/`), el job pasaría en verde sin validar nada. Mitigación: el patrón vive junto a un comentario que explica la convención, y `spec-lint` en el repo de specloom valida el propio template.

## Alternatives considered

### Mantener `on.paths` y no marcar el check como required

Descartada: sin required check, `loom validate` es opt-in y un PR de ticket puede mergearse sin pasar validación — exactamente lo que se quiere impedir.

### Workflow "espejo" que reporta éxito en los paths complementarios

Patrón documentado por GitHub (dos workflows con el mismo nombre de job, uno con `paths` y otro con `paths-ignore` que siempre pasa). Descartada: duplica archivos que deben mantenerse sincronizados a mano en cada cambio de paths, y el modo de fallo (desincronización) es silencioso.

### `dorny/paths-filter` como acción de terceros

Funcionalmente equivalente al paso con `git diff`. Descartada: agrega una dependencia externa de supply chain a los workflows del template por algo que resuelve una línea de git ya disponible en el runner.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: sin impacto — no introduce secretos ni `pull_request_target`; el paso de filtrado solo lee el diff local del PR
- data: sin impacto
- deployment: los proyectos consumidores del template reciben el nuevo comportamiento al actualizar specloom y re-copiar el workflow; branch protection puede entonces marcar `spec-lint` como required
- testing: la validación es estructural (YAML parseable, pasos condicionados); el comportamiento end-to-end se verifica observando el check en PRs reales
