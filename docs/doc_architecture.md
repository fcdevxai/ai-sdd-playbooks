# Arquitectura

> Referencia de arquitectura del proyecto. `sdd-enrich-us`, `sdd-design` y
> `sdd-plan` leen esto antes de proponer o planificar trabajo.

## Capas

```
bin/playbook.js → src/cli/*.js → módulos de dominio (abajo) → schemas/*.json
```

| Capa | Responsabilidad | NO debe hacer |
|---|---|---|
| `src/cli/` | Parsear args, invocar el motor, formatear salida (`--json`/texto) | Lógica de negocio del motor |
| `src/lifecycle/` | Motor de estado PURO (sin fs/red) | Leer archivos o llamar git/gh |
| `src/config/` `src/schema/` | IO de config/lock + validación ajv y de secciones | Decidir el próximo paso del ciclo |
| `src/adapters/` `src/github/` `src/security/` | Descriptores de runtime-gate, delivery en vivo, clasificación de riesgo | — |
| `src/adr/` `src/tokens/` `src/repos/` | ADRs, eficiencia de tokens, multi-repo (todos opcionales/aditivos) | Romper el modelo single-repo si no se usan |
| `src/generator/` | `canonical.md` → `SKILL.md` | Escribir fuera de `skills/<name>/` |

## Módulos

Ver la tabla completa en [openspec/specs/system.md](../openspec/specs/system.md#layer-architecture).

## Modelo de datos

No hay base de datos. El "modelo de datos" es el conjunto de artefactos por
change bajo `openspec/changes/<change-id>/`, descriptos en
`schemas/*.schema.json`.
