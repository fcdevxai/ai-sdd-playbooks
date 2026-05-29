# /sdd-commit — SDD Commit — Commit y Abrir Pull Request

## Objetivo

Generar un commit estructurado para la implementación SDD, hacer push y abrir un Pull Request con descripción generada inline para el revisor humano.

## Uso

```
/sdd-commit [ticket-slug]
```

## Cuándo ejecutar

Después de `/sdd-code-review` (veredicto READY FOR PR) y opcionalmente después de `/sdd-ux-gate` (veredicto READY FOR PR UX).

## Instrucciones al agente

1. Lee `openspec/changes/[ticket-slug]/code-review-report.md`. Si el veredicto es `REQUIERE CORRECCIONES`, detente y lista los issues. No continuar.
2. Ejecuta `git status` y `git diff --stat` para ver todos los cambios.
3. Confirma que la rama actual coincide con `[ticket-slug]`.
4. Stagea solo los archivos que pertenecen a esta feature. Nunca stagear `.env`, `public/build/`, ni archivos de otras features.
5. Construye el commit message en Conventional Commits: `feat(module):`, `fix(module):`, etc. Sujeto ≤72 chars, imperativo, sin punto final. Body: qué cambió y por qué.
6. Ejecuta `git commit` y `git push origin [ticket-slug] --set-upstream`.
7. Genera la descripción del PR inline (150-300 palabras, para revisor humano, sin mencionar openspec/ ni "IA"):
   - Secciones: Summary / What Changed / Validation / Reviewer Notes / Risks / Rollback
8. Abre el PR: `gh pr create --title "..." --body "..." --base main`.
9. Reporta: archivos commiteados, hash del commit, URL del PR.

## Checklist

- [ ] `code-review-report.md` con veredicto `READY FOR PR` leído
- [ ] `git status` ejecutado — archivos identificados
- [ ] Solo archivos de esta feature stageados (sin `.env`, sin `public/build/`)
- [ ] Commit message en Conventional Commits, ≤72 chars, imperativo
- [ ] `git push` con `--set-upstream` exitoso
- [ ] Descripción del PR generada inline (150-300 palabras)
- [ ] PR abierto con `gh pr create`
- [ ] URL del PR reportada al usuario

## Formato de reporte

No genera archivo. Reporta al usuario: lista de archivos commiteados, hash del commit y URL del PR.

## Criterio de bloqueo

No commitear si `code-review-report.md` tiene veredicto `REQUIERE CORRECCIONES`. No force-push sin solicitud explícita del usuario.

## Qué NO reemplaza

- La aprobación humana del PR
- La revisión de conflictos de merge con main
- El deploy a producción
