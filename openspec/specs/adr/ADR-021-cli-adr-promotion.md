---
status: accepted
date: 2026-07-06
ticket: loom-adr-promote
---

# ADR: `loom adr promote` como ejecutor canónico de la promoción de ADRs

## Context

ADR-001 estableció los Architecture Decision Records y el proceso por el cual un draft `adr-*.md` de un change se promueve a `openspec/specs/adr/ADR-NNN-*.md` al archivar. Ese proceso vive hoy 100% como prosa en el paso 5 de `sdd-archive` (sub-pasos 5.1–5.7): status-gate, numeración `ADR-NNN`+1, `git mv` del draft, regeneración de la tabla de `README.md`, supersession frontmatter, cross-reference de seguridad, y verificación de que lo staged coincide con el disco.

La auditoría de tokens 2026-07-05 identificó dos problemas concomitantes: (1) es ~40% del playbook más grande (`sdd-archive`, 10.2KB) — mecánica determinista ejecutada por el agente en cada archive; y (2) es una **clase de bug recurrente**: `git mv` ejecutado justo después de editar el frontmatter de un ADR stagea el contenido *viejo* (el commiteado antes de la edición), no la edición en disco. Ese bug ocurrió 3 veces documentadas, y por eso el playbook acumuló rituales defensivos (`git diff --cached` sobre cada archivo editado, re-leer el archivo en su nueva ruta) que existen solo para atrapar el bug, no para hacer el trabajo.

Fuerza en tensión: los ADRs promovidos son **inmutables** y su directorio es fuente de verdad permanente; automatizar su escritura debe respetar esa inmutabilidad y el status-gate humano (un ADR `proposed` nunca se promueve sin decisión humana previa), pero la mecánica en sí no tiene juicio y no debería depender de que el agente ejecute 7 sub-pasos sin equivocarse.

## Decision

`loom adr promote <ticket> [--dry-run]` es el ejecutor canónico de la promoción de ADRs. Ejecuta la mecánica determinista como una sola secuencia atómica:

- **Status-gate preservado**: si cualquier draft está en `status: proposed`, detiene toda la promoción y no mueve nada. La aprobación (`proposed` → `accepted`/`rejected`) sigue siendo decisión humana previa, fuera del comando. Tanto `accepted` como `rejected` se promueven.
- **Numeración**: mayor `ADR-NNN` existente + 1, zero-pad a 3 dígitos, re-escaneando el directorio como punto de serialización.
- **Move por filesystem, no `git mv`**: el comando escribe/mueve en disco y luego stagea con `git add` los archivos tocados, y verifica que `git diff --cached` coincida con el disco. Al separar la edición del staging y verificarlos como una unidad, la clase de bug `git mv`-stagea-contenido-viejo desaparece de raíz.
- **README derivado**: regenera la tabla de `openspec/specs/adr/README.md` desde el contenido del directorio, preservando la prosa del encabezado. El directorio es la fuente de verdad; el índice es derivado.
- **Supersession**: si un draft declara `supersedes: ADR-NNN`, edita el ADR viejo a `status: superseded` + `superseded_by: ADR-MMM` — la única edición jamás permitida sobre un ADR promovido.
- **El comando no commitea ni pushea**, ni decide clasificación de seguridad. El cross-reference a `docs/security-checklist.md` (paso 5.6) permanece como juicio del agente con confirmación humana: distinguir un Risk de seguridad y redactar la entrada operativa no es mecánica.
- **Git vía spawn con arrays de argumentos**, sin shell — sin superficie de command injection.

Esta decisión extiende ADR-001 sin superseder: el proceso, la inmutabilidad y el status-gate no cambian; solo su ejecución pasa de prosa de playbook a comando verificable.

## Consequences

### Positive

- Elimina la clase de bug git-index (3 ocurrencias) haciendo edición+move+stage atómicos y verificados dentro del comando.
- Adelgaza `sdd-archive` ~40% (de 10.2KB estimado a ~6.5KB): 6 sub-pasos mecánicos + 2 rituales defensivos colapsan a "corre el comando --dry-run, confirma, re-corre".
- La numeración/README/supersession se vuelven testeables (`node --test`) en vez de depender de ejecución manual sin errores.
- `--dry-run` da un punto de revisión humano explícito antes de mutar el directorio inmutable.

### Negative

- El CLI ahora muta el directorio de specs permanentes y el índice git — responsabilidad que antes era del agente; un bug en el comando podría afectar `openspec/specs/adr/` (mitigado por `--dry-run`, tests y el status-gate).
- Acopla el comando al formato del README y del frontmatter de ADRs — cambios a esos formatos deben actualizar el comando.

### Risks

- Un bug en la regeneración del README podría corromper el índice; mitigación: preservar la prosa del encabezado explícitamente, tests de regeneración, y `--dry-run` que muestra el diff antes de aplicar.
- La verificación staged==disco podría dar un falso OK si se implementa mal, re-habilitando el bug histórico; mitigación: es criterio de aceptación con test dedicado que fuerza el fallo.

## Alternatives considered

### Mantener la promoción como prosa en sdd-archive (statu quo)

Descartada: es el 40% del playbook más grande y la fuente de un bug que reapareció 3 veces pese a rituales defensivos acumulados.

### Comando que solo toca filesystem, staging al agente

Descartada: el bug histórico es de *staging* (`git mv` stagea viejo); si el comando no posee el staging, la verificación staged==disco vuelve a ser paso manual y el bug puede reaparecer. Poseer edición+stage+verify como unidad es lo que mata la clase de bug.

### Comando que también commitea/pushea

Descartada: el commit/PR de archive tiene su propio gate (`spec-lint` valida que el diff bajo `openspec/changes/**` sea pura remoción) y pertenece a `sdd-commit`; el comando se detiene en staging verificado para no saltarse ese control.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: el comando escribe solo en `openspec/specs/adr/`, valida el slug traversal-safe, ejecuta git vía spawn con arg arrays (sin shell), y preserva el status-gate humano como barrera; la única edición sobre ADRs promovidos es la supersession frontmatter.
- data: regenera `README.md` (índice derivado) y edita frontmatter de supersession; no cambia el contenido inmutable de los ADRs.
- deployment: llega a consumers vía npm update + `loom sync` (playbook `sdd-archive` regenerado); sin release en este ticket.
- testing: tests `node --test` cubren promoción simple/múltiple, supersession, status-gate `proposed`, `--dry-run` sin efectos, y fallo de verificación staged==disco.
