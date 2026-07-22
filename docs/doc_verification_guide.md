# Guía de verificación

> Los comandos exactos que corren `sdd-apply`, `sdd-code-review` y `sdd-verify`.
> Mantené esto preciso — el ciclo de vida depende de esto.

## Comandos

| Propósito | Comando |
|---|---|
| Formato | (sin formatter configurado todavía) |
| Lint / type-check | `node --check <archivo.js>` (por archivo tocado) |
| Tests de feature/dominio | `node --test test/<archivo>.test.js` |
| Regresión completa | `npm test` |
| Regenerar skills tras editar `canonical.md` | `npm run generate` |
| Verificar que las skills no quedaron desincronizadas | `npm run generate:check` |

## Notas

- Correr un test individual: `node --test test/repos.test.js`.
- Cobertura: sin herramienta de cobertura configurada; el criterio es que cada
  módulo de dominio (`src/<area>/`) tenga su `test/<area>.test.js` correspondiente.
- Antes de un PR: `npm test && npm run generate:check`.
