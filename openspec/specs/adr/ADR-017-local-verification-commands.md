---
status: accepted
date: 2026-07-05
ticket: cross-repo-gate-check
# supersedes: ADR-NNN
---

# ADR: Verificación local desde `config.yaml`

## Context

Los repos consumidores ya pueden declarar repos hermanos y comandos de `verification` en `config.yaml`. La necesidad actual es bloquear archives cuando el código real de esos repos no está verificado. Consultar CI remoto agregaría dependencias de red, autenticación, estados asincrónicos y diferencias entre proveedores. Ejecutar los comandos locales declarados usa información que el proyecto ya posee y mantiene el flujo reproducible desde la máquina del maintainer o del agente.

## Decision

`loom gate-check` debe verificar cada repo impactado ejecutando localmente todos los comandos declarados bajo `verification:` en `config.yaml`. No debe consultar GitHub Actions ni otro CI remoto en esta iteración. Si un comando falla, o el repo no existe en disco, el gate falla.

## Consequences

### Positive

- La verificación es determinística respecto del filesystem local y no depende de credenciales o APIs remotas.
- Reutiliza la topología y comandos que el consumidor ya declara.
- Mantiene el alcance pequeño para cubrir rápido el riesgo de archivar specs con repos hermanos rotos.

### Negative

- El maintainer o agente necesita tener los repos impactados clonados localmente.
- La ejecución puede ser más lenta que leer un estado remoto ya calculado por CI.

### Risks

- Un `config.yaml` comprometido puede ejecutar comandos arbitrarios. El riesgo es equivalente al de scripts locales consumer-owned y debe quedar cubierto por la checklist de seguridad y los logs locales en `.specloom/runs/`.

## Alternatives considered

### Consultar CI remoto

Descartada en esta iteración porque agrega autenticación, red, permisos por proveedor y semántica de estados pendientes que no son necesarios para cerrar el riesgo principal.

### Ejecutar un único comando primario por repo

Descartada porque exigiría una nueva convención de prioridad y podría dejar checks declarados sin correr.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: acepta ejecución local de comandos confiables desde `config.yaml`; los logs pueden contener secretos impresos por esos comandos y deben permanecer en `.specloom/`
- data: sin impacto en datos persistidos del producto; genera telemetry local de ejecución
- deployment: sin impacto
- testing: requiere fixtures de config con comandos exitosos, comandos fallidos y paths faltantes
