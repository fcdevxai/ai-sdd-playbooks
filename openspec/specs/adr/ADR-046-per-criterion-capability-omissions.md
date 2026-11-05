---
schema: adr
status: accepted
date: '2026-11-04'
ticket: runtime-coverage-per-criterion-capabilities
---

# ADR: Omisiones explícitas de capacidades por criterio en la cobertura de runtime

## Context

ADR-043 §5 («Complete runtime coverage») exige que todo AC, EC y SEC esté mapeado a evidencia
de runtime o declarado no-runtime con motivo, y que toda capacidad habilitada de todo
repositorio impactado tenga un adaptador `passed` o una exclusión validada. La spec permanente
`openspec/specs/cli/spec.md` repite la misma regla, formulada a nivel de adaptador.

La implementación (`validateRuntimeCoverage` en `src/lifecycle/runtime-coverage.js`) agrega una
exigencia más fuerte, fijada por la prueba
`repository-specific capability applicability excludes unrelated workspaces`: cada par
criterio/repositorio mapeado debe mapear **todas** las capacidades habilitadas de ese
repositorio. En repositorios con más de una capacidad (por ejemplo `http` y `worker`), un
criterio que solo se ejercita por HTTP exige igualmente un recibo de `worker`.

Las salidas que deja esa regla son dos, y ninguna sirve: citar recibos que no corresponden al
criterio (evidencia que no es evidencia) o dejar de declarar capacidades reales del
repositorio, con lo que la parte asíncrona deja de exigirse. El change
`lia-institutional-token-validation` del Hub LIA quedó `blocked` en `sdd-runtime-gate` por esta
regla con la evidencia real ya reunida (issue fcdevxai/ai-sdd-playbooks#34).

La intención de la regla actual es legítima: impedir que un criterio declare cobertura por una
superficie e ignore en silencio otra superficie habilitada del mismo repositorio.

## Decision

1. La completitud de capacidades se exige **a nivel de adaptador**, como dice ADR-043 §5: toda
   capacidad habilitada de todo repositorio impactado necesita un adaptador `passed` con recibos
   ligados a su cobertura, o `not_applicable` con exclusión validada.
2. A nivel de criterio, un par criterio/repositorio mapeado puede dejar sin mapear una capacidad
   habilitada de ese repositorio **solo** mediante una omisión explícita con motivo no vacío,
   declarada en el plan (`tasks.md`), que una persona revisa en el pull request antes del merge.
3. Una capacidad habilitada sin mapear y sin omisión explícita sigue siendo un error.
4. Una omisión es válida solo si el par criterio/repositorio está mapeado, la capacidad está
   habilitada en ese repositorio, la misma capacidad no está también mapeada para ese par y no
   hay otra omisión idéntica.
5. Una omisión nunca sustituye la exigencia por adaptador: un adaptador omitido en todos los
   criterios solo puede cerrarse con una exclusión a nivel de adaptador.
6. Las entradas multi-repo de `runtime_coverage` se siguen leyendo como repositorios ×
   capacidades. Mapear una capacidad que un repositorio no tiene sigue siendo un error, y su
   mensaje indica partir la entrada por repositorio.
7. El recibo de cada fila de cobertura sigue perteneciendo al repositorio de la fila.

## Consequences

### Positive
- Los gates de runtime pueden sellarse con evidencia verdadera en repositorios con varias capacidades.
- Se conserva la protección contra omisiones silenciosas: omitir requiere decisión escrita.
- La implementación queda alineada con el texto de ADR-043 §5 y de la spec del CLI.

### Negative
- Quien planifica debe escribir un motivo por cada capacidad que no aplica a un criterio.
- Cambia una prueba que hoy fija la regla más estricta.

### Risks
- Motivos de relleno («no aplica») aceptados por descuido. El ciclo no tiene un paso de
  aprobación propio para `tasks.md`: el control humano es la revisión del pull request que lo
  contiene, antes del merge y después de los gates. Se mitiga con esa revisión y con el hash del
  handoff manifest. La veracidad del motivo no es verificable por
  máquina; se registra como riesgo aceptado en `docs/security-checklist.md`.

## Alternatives considered

### Exigencia solo por adaptador
Descartada: es la lectura literal de ADR-043, pero elimina la decisión escrita por criterio, que
es lo que protege contra omisiones silenciosas.

### Mantener la regla y documentarla
Descartada: deja como única salida citar recibos no relacionados o renunciar a declarar
capacidades reales.

### Aplicar cada capacidad solo a los repositorios que la tienen
Descartada: acepta en silencio mapas ambiguos en entradas multi-repo.

### Exclusión por fila en el reporte del gate
Descartada: la decisión de qué no aplica pertenece al plan (`tasks.md`), que una persona revisa
en el pull request, no al reporte que redacta el agente que recoge la evidencia.

## Impact

- backend: `src/lifecycle/runtime-coverage.js` (regla por criterio y mensaje multi-repo)
- frontend: no impact
- security: relaja un chequeo fail-closed solo mediante declaración explícita y validada; la exigencia por adaptador no cambia
- data: no impact (sin persistencia; la forma del campo se decide en ADR-047)
- deployment: release `0.12.0`
- testing: se ajusta la prueba que fija la regla actual y se agregan casos de omisión
