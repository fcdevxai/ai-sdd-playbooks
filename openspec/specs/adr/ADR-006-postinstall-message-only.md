---
status: superseded
date: '2026-07-03'
ticket: template-drift-detection
superseded_by: ADR-040
---

# ADR: El postinstall de specloom es message-only — nunca lee, escribe, conecta ni falla

## Context

Tras `npm update specloom`, los artefactos generados (`.claude/commands/`, skills) y los templates copiados (workflows CI) del consumidor quedan silenciosamente obsoletos si nadie corre `loom sync` / el drift check. Se necesita una señal automática en el momento del update.

npm ejecuta el script `postinstall` de una dependencia en cada install del consumidor. Eso lo convierte en el punto de señal natural — y a la vez en superficie de supply-chain: código del paquete corriendo automáticamente en cada máquina y CI de cada consumidor. Un postinstall que hace trabajo real (leer el repo del consumidor, correr el check, escribir archivos) es más útil pero también más lento, más frágil (puede romper `npm install` en CI) y más difícil de auditar.

Relación con ADR-002: su sección Impact registró como propiedad de seguridad "sin scripts de instalación (`postinstall`/`prepare`) que ejecuten código arbitrario al instalar", y un test (`root-package.test.js`) la aseguraba. Este ADR **enmienda esa propiedad sin superseder ADR-002** — la decisión central de ADR-002 (distribución como dependencia git privada) queda intacta; lo que cambia es el invariante de lifecycle scripts, que pasa de "ninguno" a "exactamente uno, message-only, gateado por test estructural". `prepare` sigue prohibido.

## Decision

- specloom declara un `postinstall` en el `package.json` raíz (el que instala el consumidor vía `github:lablab-outplacement/specloom`).
- Política inmutable del script, en orden de prioridad sobre cualquier utilidad futura:
  1. **Nunca escribe** — cero operaciones de escritura a filesystem.
  2. **Nunca lee el repo del consumidor** — no inspecciona archivos fuera del propio paquete.
  3. **Nunca hace red.**
  4. **Nunca falla** — exit 0 incondicional, incluso ante errores internos (`try/catch` global). Un `npm install` jamás se rompe por specloom.
- Su único efecto es imprimir un mensaje corto (≤3 líneas): versión instalada + recordatorio de correr `npx specloom sync --check --target all`.
- Esta política está asegurada por test estructural en la suite del paquete; relajarla requiere un ADR que supersea a este.
- Limitación aceptada y documentada: con `npm install --ignore-scripts` (común en CI endurecido) no hay señal — el README documenta el flujo manual como fuente de verdad.

## Consequences

### Positive

- El desarrollador ve el recordatorio exactamente en el momento del update, sin configurar nada.
- Superficie de supply-chain mínima y auditable en segundos: un script que solo hace `console.log`.
- Cero riesgo de romper installs o CI de consumidores.

### Negative

- La señal es pasiva: quien no lee la salida de npm (o usa `--ignore-scripts`) no la recibe. El check sigue siendo responsabilidad del consumidor.
- Un script postinstall, aunque inocuo, aparece en auditorías de dependencias y puede requerir allowlisting en organizaciones que bloquean lifecycle scripts.

### Risks

- Deriva de alcance: la tentación futura de "ya que corre, que haga el check". Mitigación: la política es normativa en este ADR y está gateada por test estructural; cambiarla exige supersession explícita.

## Alternatives considered

### Postinstall que ejecuta el drift check

Más útil, pero corre en cada install (incluido CI del consumidor), agrega latencia, lee el repo del consumidor automáticamente y multiplica los modos de fallo de `npm install`. Descartada: el costo de confiabilidad supera el beneficio sobre un mensaje.

### Sin postinstall, solo documentación

Cero superficie, pero reproduce el problema: la señal depende de que el humano recuerde leer el README en el momento justo. Descartada como opción única; la documentación existe además del mensaje.

### Hook `prepare`/`preinstall` o script sugerido para el package.json del consumidor

`prepare` no corre para dependencias git con artefactos ya construidos de forma predecible entre versiones de npm, y pedirle al consumidor que instale su propio hook es opt-in con la misma fragilidad que la documentación. Descartadas.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: superficie nueva de supply-chain (lifecycle script npm) acotada por la política message-only y su test estructural; registrar en docs/security-checklist.md al archivar
- data: sin impacto — no lee ni transmite datos del consumidor
- deployment: el script debe estar incluido en la whitelist `files` del package.json raíz para llegar al consumidor
- testing: test estructural que asegura la política (sin fs write, sin red, exit 0 incondicional)
