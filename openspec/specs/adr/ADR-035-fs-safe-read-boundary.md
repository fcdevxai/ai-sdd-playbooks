---
schema: adr
status: accepted
date: '2026-07-24'
ticket: unfulfilled-promises-cleanup
---

# ADR: `src/util/fs-safe.js` es también la frontera de las lecturas derivadas de configuración

## Context

`src/util/fs-safe.js` centraliza las escrituras destructivas: sobrescribir exige un
token de confirmación por archivo, y `init`/`--fix`/bootstrap pasan por ahí. Su
docstring lo dice explícitamente ("every destructive write funnels through here").
Las **lecturas** quedaron fuera de ese encuadre, y hoy sólo dos módulos lo importan:
`src/cli/init.js` y `src/cli/doctor.js`.

El caso concreto que lo expone es `contract-drift`: toma `contract.path_in_loom` de la
config y lee `` `${cwd}/${canonicalPath}` `` sin validar contención, así que un
`path_in_loom: ../../../algo` se lee hoy sin objeción. La severidad base es baja —la
config está commiteada, y quien la controla ya controla el repo—, pero dejó de ser sólo
lectura: desde la decisión de authoring del contrato, un skill **escribe** en esa misma
ruta. Y `docs/security-checklist.md` ya declara esa ruta como superficie sensible con la
exigencia textual de que "debe quedar contenida al repo" — una exigencia que ningún
código verifica.

El contraste útil es que la validación en este repo es **inconsistente, no ausente**:
`playbook packet` sí valida su entrada con `isSafeSlug` en cuatro call sites. La
diferencia no responde a un criterio, sino a qué comando se escribió después de qué
discusión.

Las fuerzas en tensión: agregar el chequeo en el call site es de una línea y resuelve
este bug hoy; ponerlo en `fs-safe` cuesta un poco más y establece dónde va a vivir la
próxima vez, que es justamente lo que hoy no existe.

## Decision

- `fs-safe` expone un resolvedor de rutas contenidas: dada una raíz y una ruta de
  configuración, devuelve la ruta absoluta resuelta o falla cuando escapa de la raíz
  (`..`, ruta absoluta a otro árbol, o symlink que salga).
- Todo consumo de una ruta **provista por configuración** —lectura o escritura— pasa por
  ahí. La regla es la ruta de origen, no la operación: una lectura derivada de config
  tiene el mismo tratamiento que una escritura.
- `contract-drift` es el primer llamador: resuelve `contract.path_in_loom` con ese helper
  y falla con un error claro cuando la ruta escapa del repo.
- Las rutas internas del propio paquete (por ejemplo `PACKAGE_ROOT` + un nombre de
  skill) no requieren el helper: su origen es el código, no la configuración del
  consumer.

## Consequences

### Positive

- La exigencia que el checklist de seguridad ya declaraba pasa a estar verificada por
  código en vez de por prosa.
- El repo gana un lugar único y obvio donde va esta clase de chequeo, lo que hace más
  barato aplicarlo en el próximo comando que reciba una ruta de config.
- Cierra la inconsistencia entre `packet` (que valida) y `contract-drift` (que no lo
  hacía) con un criterio explícito, no por imitación caso a caso.

### Negative

- Amplía el alcance de un módulo cuyo docstring hoy habla sólo de escrituras: hay que
  reescribir ese encuadre para que el nombre no engañe.
- Un llamador que necesite deliberadamente leer fuera de la raíz tendrá que decirlo de
  forma explícita en vez de hacerlo por omisión.

### Risks

- Falsos positivos si un consumer legítimo apunta el contrato a un árbol hermano — caso
  no soportado hoy de todos modos, ya que la resolución concatena y falla. Si aparece la
  necesidad real, es un change aparte con su propia decisión.
- Cobertura parcial: este change convierte un solo llamador. Los demás consumos de rutas
  de config siguen como están hasta que alguien los toque, así que la convención existe
  antes que su aplicación completa.

## Alternatives considered

### Validar en el call site de `contract-drift` y nada más

Descartada: arregla el bug y deja la decisión sin domicilio. El próximo comando que lea
una ruta de config va a volver a decidir de cero, que es exactamente cómo se llegó a que
`packet` valide y `contract-drift` no.

### Un módulo nuevo separado de `fs-safe`

Descartada: dos módulos para la misma preocupación —qué rutas puede tocar el CLI— con la
frontera partida por el tipo de operación. `fs-safe` ya es el lugar donde se buscaría.

### Dejarlo documentado como riesgo aceptado

Descartada porque ya está documentado como exigencia, no como riesgo: el checklist afirma
que la ruta debe quedar contenida. La opción honesta era cumplirlo o borrar la afirmación,
y borrarla empeora la postura de seguridad ahora que esa ruta además se escribe.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: control nuevo y real — una ruta de contrato fuera del repo deja de ser
  legible; cierra la exigencia declarada en `docs/security-checklist.md`
- data: sin cambios de artefactos
- deployment: sin impacto
- testing: cobertura del resolvedor (ruta relativa válida, `..` que escapa, ruta absoluta
  a otro árbol) y del rechazo con error claro en `contract-drift`
