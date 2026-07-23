---
status: accepted
date: 2026-07-03
ticket: template-drift-detection
---

# ADR: Modelo de ownership de templates — managed vs consumer-owned

## Context

`loom init` copia templates del paquete al repo consumidor una sola vez y nunca pisa archivos existentes (por diseño, para no destruir customizaciones). Pero los templates copiados tienen dos naturalezas opuestas que el sistema no distinguía:

- Archivos que el consumidor **debe** editar (`CLAUDE.md`, `config.yaml`, `docs/*`, `system.md` — llenos de TODOs de scaffolding): divergir del template es el uso correcto.
- Archivos que deben **seguir** al template (workflows de CI como `spec-lint.yml`): divergir significa quedarse con una versión vieja, y el drift puede romper cosas reales — caso concreto: un consumidor con el `spec-lint.yml` viejo (filtro `paths:` a nivel de trigger) que lo marque como required status check rompe su branch protection (ADR-004) sin ningún aviso.

Sin esta distinción, un check de drift de templates es imposible: o grita en cada archivo customizado (inútil por ruido) o calla en los workflows obsoletos (inútil por omisión).

## Decision

- Cada entrada de `INIT_TEMPLATE_MANIFEST` y `CODEX_TEMPLATE_MANIFEST` declara su ownership: `managed` o `consumer-owned` (default si se omite: `consumer-owned`, el caso seguro).
- **managed**: el archivo del consumidor debe ser idéntico al template del paquete. Drift o ausencia = error real (exit 1 en `loom sync --check --target templates|all`). Inicialmente: `github/workflows/spec-lint.yml` y `github/workflows/archive-cleanup.yml`.
- **consumer-owned**: se scaffoldea para ser customizado. Divergencia y ausencia se reportan solo como información, nunca fallan el check.
- Entradas del manifest sin archivo en el disco del consumidor se reportan siempre como "new in template" (con la severidad de su clase).
- Un archivo managed nunca puede tener TODOs de customización en su template; si un template necesita customización del consumidor, es consumer-owned por definición.
- Todo template nuevo que se agregue al manifest debe declarar su clase explícitamente en el PR que lo agrega.

## Consequences

### Positive

- El drift check tiene señal limpia: exit 1 solo significa "tienes un archivo centralmente mantenido obsoleto o faltante".
- Los consumidores se enteran de workflows nuevos o corregidos al correr un solo comando, en vez de descubrirlo cuando algo se rompe.
- La clasificación queda auto-documentada en el manifest, junto al código que la usa.

### Negative

- Los archivos managed pierden la posibilidad de customización local: un consumidor que edite su `spec-lint.yml` verá el check fallar hasta revertir o hasta que el cambio se haga upstream en el template.
- Cada template nuevo exige una decisión de clasificación consciente (fricción pequeña y deliberada).

### Risks

- Clasificar mal un archivo como managed obliga a los consumidores a un archivo que en realidad necesitaban adaptar; la salida es reclasificarlo (cambio de manifest, no de API). El caso inverso (managed marcado como owned) degrada a silencio, el status quo actual.

## Alternatives considered

### Todo informativo, sin clase managed

Descartada: reproduce el problema original — el consumidor con `spec-lint.yml` roto ve una línea informativa más entre decenas de divergencias esperadas y la ignora. Sin exit code no hay gate posible en CI del consumidor.

### Hash/marker de "no customizado" en vez de clasificación estática

Comparar contra el template *de la versión que se instaló* (guardando hashes) permitiría detectar "customizado vs solo desactualizado" en archivos owned. Descartada por complejidad: requiere estado persistente en el consumidor; la clasificación estática resuelve el caso que duele (workflows) sin estado.

### Sobrescribir automáticamente los managed en `init`/`sync`

Descartada en este ticket: pisar archivos del consumidor exige semántica de apply cuidadosa (backups, dry-run); queda como evolución futura sobre esta misma clasificación.

## Impact

- backend: sin impacto
- frontend: sin impacto
- security: sin impacto directo; el check solo lee disco local
- data: sin impacto
- deployment: los consumidores adoptan el check al actualizar el paquete; ningún cambio retroactivo en sus archivos
- testing: la clasificación y el check quedan cubiertos por tests unitarios sobre fixtures de consumidor en `framework/cli/test/`
