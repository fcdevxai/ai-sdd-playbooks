---
status: accepted
date: 2026-07-08
ticket: multi-repo-commit-orchestration
---

# ADR: repo SDD explícito en `config.yaml` + campos `default_base` y `protected_paths`

## Context

Hoy `config.yaml repos` (ADR-015/016/020) lista solo los repos **hermanos**; el repo SDD (el hub Loom) es implícito, resuelto por `consumerRoot`. Con la convención de mapeo archivo→repo agrupado por nombre lógico (ver ADR compañero), el plan multi-repo necesita nombrar al repo SDD igual que a los demás para poder listar sus `## Files touched` y su branch/base.

Además, dos necesidades del plan no tienen dónde vivir en el schema actual:

- **Base branch por repo**: no asumir `main`. La verdad es `origin/HEAD`, pero un repo sin remote resoluble (offline, recién clonado) necesita un fallback declarado.
- **Rutas protegidas por repo**: además del denylist built-in de secretos/build, cada repo puede tener paths propios que nunca deben stagearse.

La fuerza en tensión: mantener `config.yaml` retrocompatible (los consumers existentes como athly-loom no deben romperse) vs. darle al plan la información que necesita.

## Decision

Extender `config.yaml repos` de forma **aditiva y retrocompatible**:

- El repo SDD se declara como una entrada más bajo `repos:`, con `path: "."` y `role: sdd`. `role` es un campo reservado opcional; su ausencia significa repo hermano normal. Como máximo un repo puede tener `role: sdd`. Si ningún repo lo declara, el repo SDD sigue siendo implícito (`consumerRoot`) y se inyecta en el plan con un nombre reservado por defecto — sin romper consumers previos.
- `repos.<name>.default_base` (opcional, string): base branch a usar cuando `origin/HEAD` no resuelve. No sobreescribe a `origin/HEAD` cuando este existe.
- `repos.<name>.protected_paths` (opcional, lista de globs): paths que nunca se stagean para ese repo; se **suman** al denylist built-in (`.env`, `.env.*`, `*.pem`, `*.key`, `openspec/specs/**`, `dist/`, `build/`, `node_modules/`, `target/`), nunca lo reemplazan.

Ningún campo nuevo es obligatorio: un `config.yaml` existente sigue siendo válido y produce el mismo comportamiento que hoy salvo por las capacidades nuevas que dependan de ellos.

## Consequences

### Positive

- El repo SDD deja de ser un caso especial: aparece en el plan con nombre, base y branch como cualquier otro repo.
- `default_base` cubre el caso master-vs-main y el offline sin heurística frágil.
- `protected_paths` da control por-repo sobre qué no commitear, encima de una base segura por defecto.

### Negative

- Amplía el schema de `config.yaml` y la superficie de parsing/validación (tres campos nuevos, una restricción de unicidad de `role: sdd`).
- Dos formas de resolver la base (remote vs config) exigen un orden de precedencia claro y testeado para no confundir al usuario.

### Risks

- Un `role: sdd` duplicado o un `path` de repo SDD mal puesto (`../otro`) podría desalinear todo el plan; mitigación: validar unicidad de `role: sdd` y que su path resuelva al consumerRoot, con error claro si no.
- `protected_paths` con un glob demasiado amplio podría bloquear archivos legítimos; es fail-safe (bloquea de más, nunca de menos) y se reporta el path exacto que disparó el bloqueo.

## Alternatives considered

### Repo SDD implícito con nombre reservado fijo (no declarable)

Descartada como default: el usuario no podría nombrarlo (athly ya lo llama "loom") ni darle `protected_paths`/`default_base` por la misma vía uniforme. Se conserva como fallback retrocompatible cuando nadie declara `role: sdd`.

### Resolver base branch solo por probe main/master (statu quo de changed-files)

Descartada como fuente primaria: no refleja el default real del remote y falla justo en el caso master-vs-main que motiva el ticket. El probe se mantiene como último fallback.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: `protected_paths` refuerza la prevención de commit de secretos (fail-safe, aditivo al denylist built-in); `config.yaml` sigue siendo config confiable con el trust model de ADR-020
- data: sin impacto
- deployment: sin impacto
- testing: agrega tests de parsing aditivo/retrocompat, unicidad de `role: sdd`, precedencia de base branch, y suma de protected_paths + denylist built-in
