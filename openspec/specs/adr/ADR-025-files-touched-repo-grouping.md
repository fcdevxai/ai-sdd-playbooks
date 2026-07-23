---
status: accepted
date: 2026-07-08
ticket: multi-repo-commit-orchestration
---

# ADR: `## Files touched` agrupado por nombre lógico repo-relativo como fuente del mapeo archivo→repo

## Context

El plan multi-repo debe decidir, para cada archivo del change, a qué repo pertenece, y por repo qué archivos son "relacionados" (declarados por la spec) vs "no relacionados" (modificados pero no declarados). Hoy `## Files touched` existe en `context-packet.md` como lista plana de paths con backticks (`extractPacketFilesTouched` en lib.js), y `loom packet` la deriva de `tasks.md` ("Files to create/modify"). Esa lista plana no dice a qué repo pertenece cada path.

Dos convenciones posibles para expresar el repo:

1. Paths relativos al repo SDD (`../athly-frontend/src/...`) y mapear por prefijo del `path` de config.
2. Agrupar por nombre lógico de repo con rutas repo-relativas (`frontend: src/...`).

La fuerza en tensión: cercanía a lo existente (paths planos) vs. determinismo del mapeo (sin adivinar prefijos que pueden colisionar o no matchear exacto).

## Decision

La fuente de verdad del mapeo archivo→repo es `## Files touched` **agrupado por nombre lógico de repo**, con rutas **repo-relativas**:

```
## Files touched
- loom: openspec/changes/<slug>/proposal.md
- frontend: src/app/auth/login.component.ts
- backend: src/main/java/.../AuthController.java
```

Reglas normativas:

- Cada bullet tiene la forma `- <repo-name>: <ruta-repo-relativa>`. `<repo-name>` debe existir en `config.yaml repos` (allowlist, igual que `run --repo`/`gate-check`).
- La ruta es relativa al root de ese repo; se resuelve a path absoluto vía `repos[<name>].path`. No se infiere el repo por prefijo de path.
- "Relacionado" para un repo = ruta declarada en `## Files touched` para ese repo. Un archivo modificado en el working tree pero no declarado ⇒ `unrelatedFiles`; un declarado ausente/no modificado ⇒ `expectedButMissing`.
- `loom packet` y la extracción de `tasks.md` ("Files to create/modify") pasan a producir/entender esta forma agrupada; una lista plana legacy (sin prefijo de repo) se interpreta como perteneciente al repo SDD, preservando retrocompatibilidad con packets existentes.

## Consequences

### Positive

- Mapeo determinista sin heurística de prefijos; el nombre lógico ya es el allowlist de config y aparece en `## Impacted repos`.
- La clasificación relacionado/no-relacionado/ausente cae directo de la lista declarada, habilitando los blockers `undeclared_files_modified` y `expected_files_absent` sin adivinar.
- Consistencia: el mismo nombre lógico se usa en `## Impacted repos`, `config.yaml`, `run --repo`, `gate-check` y ahora `## Files touched`.

### Negative

- Cambia el formato de `## Files touched` respecto a la lista plana actual; `loom packet`, `extractPacketFilesTouched` y las plantillas de tasks/packet deben actualizarse.
- Exige que la spec/tasks nombren el repo por archivo, algo más de disciplina al redactar.

### Risks

- Packets legacy con lista plana podrían mapearse silenciosamente al repo SDD cuando en realidad tocaban un hermano; mitigación: la regla legacy es explícita (plano ⇒ repo SDD) y documentada, y los nuevos packets siempre llevan prefijo; un archivo `../` en una lista plana se trata como no declarado (se reporta), no como pertenencia adivinada.
- Un `<repo-name>` mal escrito rompe el mapeo; mitigación: se valida contra el allowlist de config con error claro, igual que `run --repo`.

## Alternatives considered

### Paths relativos al repo SDD (`../athly-frontend/...`) mapeados por prefijo

Descartada: frágil si dos repos comparten prefijo o si el path declarado no matchea exacto el `path` de config; reintroduce rutas relativas frágiles que ADR-011/020 evitan.

### Soportar ambas convenciones

Descartada: más lógica de parsing y más casos de ambigüedad/test por poco beneficio; una convención canónica (con la regla legacy plano⇒SDD como único caso de compatibilidad) es más simple y auditable.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: refuerza SEC de no inferir implementación fuera de scope (un repo no declarado nunca entra al plan) y el mapeo determinista evita stagear en el repo equivocado
- data: sin impacto
- deployment: sin impacto
- testing: agrega tests de parsing agrupado, allowlist de repo-name, clasificación relacionado/no-relacionado/ausente, y compat legacy plano⇒repo SDD
