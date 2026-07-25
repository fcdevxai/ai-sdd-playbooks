---
schema: adr
status: accepted
date: '2026-07-24'
ticket: unfulfilled-promises-cleanup
---

# ADR: `tasks.md` debe declarar la línea `Regression`, y `packet` avisa cuando falta

## Context

El context packet extrae los comandos de verificación de `tasks.md` buscando etiquetas
exactas: `Format`, `Lint/type-check`, `Feature tests`, `Regression`. Esos comandos son lo
que los cuatro gates que leen el packet usan para verificar el change. La extracción avisa
**sólo cuando la lista queda vacía**: si encontró tres de cuatro, no dice nada.

Eso ya falló dos veces, en silencio. El `tasks.md` de un ciclo no tenía línea
`Regression`, así que su packet nunca llevó `npm test` y el comando de regresión no llegó
a ninguno de los gates. En otro ciclo pasó lo mismo por escribir la etiqueta en castellano
(`Regresión`). En los dos casos el ciclo cerró en verde: nada estaba roto, simplemente la
regresión no se verificó a través del packet.

La asimetría importa: `Format` o `Lint/type-check` ausentes son una molestia menor —el
gate igual corre las herramientas del proyecto—, pero la regresión ausente es la
diferencia entre "verificamos que no rompimos nada" y "no lo verificamos y nadie se
enteró".

Las fuerzas en tensión: el CLI puede avisar, pero llega tarde —el packet ya está generado
y si nadie lee el warning, el comando se pierde igual—; y la instrucción en el skill
previene el problema, pero es un prompt, y un prompt puede no seguirse. Ninguna de las dos
alcanza sola.

## Decision

- **Convención**: el `tasks.md` de un change declara una entrada `Regression` con el
  comando de regresión del proyecto. Es la etiqueta que el packet extrae, así que su
  ausencia no es un detalle de formato sino un comando que no llega a los gates.
- `sdd-plan` instruye declararla explícitamente, y un test de contenido fija esa
  instrucción para que un merge futuro no pueda borrarla en silencio.
- `playbook packet` emite un **warning** cuando la entrada `Regression` no aparece, aunque
  haya extraído otros comandos.
- El warning es **advisory**: no cambia el exit code ni hace fallar `playbook validate`.
  Los packets ya generados sin esa línea siguen siendo válidos — este change no invalida
  artefactos existentes.
- Las etiquetas siguen siendo en inglés, como el resto de los encabezados que las
  herramientas machean, aunque la prosa del `tasks.md` esté en el idioma del proyecto.

## Consequences

### Positive

- La pérdida silenciosa pasa a tener dos barreras en momentos distintos: una que la
  previene al planificar y otra que la reporta al generar el packet.
- El warning nombra un problema concreto y accionable, en vez del actual "la lista quedó
  vacía", que sólo aparece en el caso extremo.
- Es el primer wiring nuevo que se estrena con las skills vivas, así que su efecto real se
  observa en este mismo ciclo en vez de quedar para el siguiente.

### Negative

- Un warning más en la salida de un comando que se corre en cada ciclo; si se vuelve
  ruidoso, pierde fuerza.
- La instrucción en el skill es un prompt: no hay garantía mecánica de que se siga. Lo que
  el test fija es que la instrucción **esté**, no que se obedezca.

### Risks

- Cobertura ilusoria: declarar la línea con un comando que no ejercita la regresión de
  verdad satisface la convención sin dar la propiedad. Ningún chequeo puede distinguirlo
  desde acá — queda para el code review.
- Punto ciego conocido de esta clase de enforcement: un test de contenido verifica que el
  texto está, no que sea **alcanzable**. Al insertar la instrucción hay que releer las
  secciones que el agente lee antes (`Preconditions`, `Context`, `Rules`) y confirmar que
  ninguna la contradiga.

## Alternatives considered

### Sólo el warning del CLI

Descartada como única medida: avisa después de generado el packet y no previene nada. Es
reparar el síntoma dejando la causa —que nadie pidió la línea al planificar— intacta.

### Sólo la instrucción en `sdd-plan`

Descartada: sin el warning, la única red es que el prompt se siga. Cuando no se sigue, la
pérdida vuelve a ser silenciosa, que es precisamente lo que este change viene a cerrar.

### Hacer que `playbook validate` falle sin la línea

Descartada: invalidaría packets ya generados y convertiría una omisión de tokens en un
bloqueo del ciclo. El modo de falla que se está cerrando es "se verificó menos de lo que
parecía", no "el artefacto es inválido".

### Aceptar etiquetas en castellano además de las inglesas

Descartada acá: ampliar el vocabulario de extracción es una decisión sobre el formato de
`tasks.md` que merece su propia discusión, y multiplica las variantes a machear. La
convención de mantener los encabezados que las herramientas leen en inglés ya existe en el
resto del proyecto.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: sin impacto — no toca datos, permisos ni entrada externa
- data: sin cambios de esquema; el `context-packet.md` generado puede incluir un comando
  más cuando antes se perdía
- deployment: sin impacto
- testing: cobertura del warning cuando falta `Regression` habiendo otros comandos, de que
  no altera el exit code ni `validate`, y test de contenido de la instrucción en `sdd-plan`
