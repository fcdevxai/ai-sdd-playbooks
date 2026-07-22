<!-- sdd-methodology: 0.1 -->
# Flujo de trabajo SDD

La metodología es global; este proyecto solo guarda su propio contexto. Claude
Code usa `~/.claude/skills`; GitHub Copilot y Codex comparten `~/.agents/skills`.
Dejá que el CLI conduzca: corré `playbook next` en cualquier momento para
obtener el único próximo paso válido.

## Ciclo de vida

```
sdd-enrich-us (pre-proceso)
  → sdd-new → [aprobación humana]
  → sdd-design (si es requerido) → sdd-plan
  → sdd-apply → sdd-code-review
  → sdd-security-gate → sdd-runtime-gate
  → sdd-commit → [CI] → [merge]
  → sdd-verify → sdd-archive
```

`playbook status` muestra dos dimensiones: el **lifecycle** metodológico y el
estado de **delivery** de GitHub. `playbook next` las combina en una sola acción.

## Prerrequisitos de runtime

Las skills de SDD se comparten por filesystem, pero las herramientas de runtime
no. Claude Code, GitHub Copilot y Codex necesitan su propia configuración de
MCP/herramientas.

- `capabilities.browser: true` implica que `sdd-runtime-gate` necesita un MCP
  de Playwright disponible en el runtime activo. Si falta, el adapter browser
  queda `blocked` con `DEPENDENCY_UNAVAILABLE`; nunca se simula evidencia de UI.
- `addons.confluence: true` implica que las skills del add-on de Confluence
  necesitan un MCP de Atlassian autenticado en el runtime activo antes de
  publicar o comentar en Confluence.
- `playbook doctor` reporta esto como notas de "runtime readiness". No instala
  ni autentica servidores MCP.

## Reglas

- Solo un humano fija `proposal.status: approved` (y `design.status: approved`).
- Los campos machine-readable (status, impact, security, capabilities) se
  mantienen en inglés — es el contrato que valida `playbook validate`.
- Nunca te saltees un gate; un hallazgo bloqueante bloquea el change hasta resolverse.
