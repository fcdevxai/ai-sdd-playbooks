#!/usr/bin/env bash
# sync-consumer.sh — Copy generated playbook files into the consuming project.
#
# Run this from the ROOT of the consuming project (not from inside the submodule).
#
# Usage:
#   bash .ai-sdd-playbooks/scripts/sync-consumer.sh
#   bash .ai-sdd-playbooks/scripts/sync-consumer.sh --check
#
# Environment variables (override defaults):
#   SKILLS_DEST    default: .ai/skills      (set to .github/skills if not using symlink)
#   COMMANDS_DEST  default: .claude/commands
#   SUBMODULE_DIR  default: .ai-sdd-playbooks
#   AI_TARGET          default: (interactive)   set to "copilot", "claude", or "both" to skip prompt
#   CREATE_DOCS        default: (interactive)   set to "yes" or "no" to skip prompt for missing docs/ files
#   CREATE_CLAUDE_FILES  default: (interactive)  set to "yes" or "no" to skip prompt for missing .claude/ files
#   CREATE_GITHUB_FILES  default: (interactive)  set to "yes" or "no" to skip prompt for missing .github/ files

set -euo pipefail

SUBMODULE_DIR="${SUBMODULE_DIR:-.ai-sdd-playbooks}"
SKILLS_SRC="${SUBMODULE_DIR}/dist/github-skills"
COMMANDS_SRC="${SUBMODULE_DIR}/dist/claude-commands"
SKILLS_DEST="${SKILLS_DEST:-.ai/skills}"
COMMANDS_DEST="${COMMANDS_DEST:-.claude/commands}"

CHECK_MODE=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_MODE=true
fi

# ──────────────────────────────────────────────────────────────────────────────
#  Interactive multi-select menu
#  Returns space-separated selections (e.g., "1 2" if both selected)
# ──────────────────────────────────────────────────────────────────────────────
interactive_ai_select() {
  echo "" >&2
  echo "¿Qué IA usas para desarrollar?" >&2
  echo "" >&2
  echo "  1) GitHub Copilot" >&2
  echo "  2) Claude" >&2
  echo "  3) Ambos" >&2
  echo "" >&2
  
  while true; do
    read -rp "Selecciona una opción (1, 2 o 3): " choice >&2
    case "$choice" in
      1)
        echo "copilot"
        return
        ;;
      2)
        echo "claude"
        return
        ;;
      3)
        echo "both"
        return
        ;;
      *)
        echo "Opción inválida. Por favor selecciona 1, 2 o 3." >&2
        ;;
    esac
  done
}

# ──────────────────────────────────────────────────────────────────────────────
#  Resolve which targets to sync (sets SYNC_COPILOT / SYNC_CLAUDE)
# ──────────────────────────────────────────────────────────────────────────────
SYNC_COPILOT=false
SYNC_CLAUDE=false

resolve_ai_target() {
  # Non-interactive path: AI_TARGET env var
  if [[ -n "${AI_TARGET:-}" ]]; then
    case "${AI_TARGET,,}" in
      copilot) SYNC_COPILOT=true ;;
      claude)  SYNC_CLAUDE=true ;;
      both)    SYNC_COPILOT=true; SYNC_CLAUDE=true ;;
      *)
        echo "❌ AI_TARGET inválido: '${AI_TARGET}'. Valores aceptados: copilot | claude | both"
        exit 1
        ;;
    esac
    return
  fi

  # Interactive path: simple menu selector
  local selection
  selection=$(interactive_ai_select)
  
  case "$selection" in
    copilot) SYNC_COPILOT=true ;;
    claude)  SYNC_CLAUDE=true ;;
    both)    SYNC_COPILOT=true; SYNC_CLAUDE=true ;;
  esac
}

# ──────────────────────────────────────────────────────────────────────────────
#  Validations (shared by all modes)
# ──────────────────────────────────────────────────────────────────────────────
if [[ ! -d "$SUBMODULE_DIR" ]]; then
  echo "❌ Submodule ${SUBMODULE_DIR} not found. Run:"
  echo "   git submodule update --init --remote ${SUBMODULE_DIR}"
  exit 1
fi

if [[ ! -d "$SKILLS_SRC" ]]; then
  echo "❌ ${SKILLS_SRC} not found."
  echo "   Run: cd ${SUBMODULE_DIR} && npm ci && node scripts/sync.js"
  exit 1
fi

# ──────────────────────────────────────────────────────────────────────────────
#  --check mode (CI anti-drift) — respects AI_TARGET; defaults to both
# ──────────────────────────────────────────────────────────────────────────────
if "$CHECK_MODE"; then
  # In CI, default to checking both unless AI_TARGET narrows the scope.
  CHECK_COPILOT=true
  CHECK_CLAUDE=true
  if [[ -n "${AI_TARGET:-}" ]]; then
    CHECK_COPILOT=false
    CHECK_CLAUDE=false
    case "${AI_TARGET,,}" in
      copilot) CHECK_COPILOT=true ;;
      claude)  CHECK_CLAUDE=true ;;
      both)    CHECK_COPILOT=true; CHECK_CLAUDE=true ;;
    esac
  fi

  DRIFT=false

  if "$CHECK_COPILOT"; then
    for src_dir in "$SKILLS_SRC"/*/; do
      slug=$(basename "$src_dir")
      dest_file="${SKILLS_DEST}/${slug}/SKILL.md"
      if [[ ! -f "$dest_file" ]]; then
        echo "DRIFT: missing ${dest_file}"
        DRIFT=true
      elif ! diff -q "${src_dir}SKILL.md" "$dest_file" > /dev/null 2>&1; then
        echo "DRIFT: ${dest_file} differs from canonical"
        DRIFT=true
      fi
    done
  fi

  if "$CHECK_CLAUDE"; then
    for src_file in "$COMMANDS_SRC"/*.md; do
      dest_file="${COMMANDS_DEST}/$(basename "$src_file")"
      if [[ ! -f "$dest_file" ]]; then
        echo "DRIFT: missing ${dest_file}"
        DRIFT=true
      elif ! diff -q "$src_file" "$dest_file" > /dev/null 2>&1; then
        echo "DRIFT: ${dest_file} differs from canonical"
        DRIFT=true
      fi
    done
  fi

  if "$DRIFT"; then
    echo ""
    echo "❌ Drift detected. Run: bash ${SUBMODULE_DIR}/scripts/sync-consumer.sh"
    exit 1
  else
    echo "✅ No drift detected — all playbook files are in sync."
    exit 0
  fi
fi

# ──────────────────────────────────────────────────────────────────────────────
#  Sync mode — ask the user which AI to target, then copy
# ──────────────────────────────────────────────────────────────────────────────
resolve_ai_target

echo "Syncing playbooks from ${SUBMODULE_DIR}..."
echo ""

if "$SYNC_COPILOT"; then
  mkdir -p "$SKILLS_DEST"
  for src_dir in "$SKILLS_SRC"/*/; do
    slug=$(basename "$src_dir")
    dest_dir="${SKILLS_DEST}/${slug}"
    mkdir -p "$dest_dir"
    cp "${src_dir}SKILL.md" "${dest_dir}/SKILL.md"
    echo "  ✓ [Copilot] ${dest_dir}/SKILL.md"
  done

  # Ensure .github/skills → .ai/skills symlink exists so GitHub Copilot can find the skills
  if [[ "$SKILLS_DEST" != ".github/skills" ]]; then
    mkdir -p .github
    if [[ -L ".github/skills" ]]; then
      : # symlink already exists — leave it
    elif [[ -d ".github/skills" ]]; then
      echo "  ⚠️  .github/skills ya existe como directorio real (no como symlink)."
      echo "     Si quieres que apunte a ${SKILLS_DEST}, elimínalo manualmente y vuelve a ejecutar el script."
    else
      ln -s "../${SKILLS_DEST}" ".github/skills"
      echo "  ✓ [Copilot] .github/skills → ${SKILLS_DEST} (symlink creado)"
    fi
  fi
fi

if "$SYNC_CLAUDE"; then
  mkdir -p "$COMMANDS_DEST"
  for src_file in "$COMMANDS_SRC"/*.md; do
    cp "$src_file" "${COMMANDS_DEST}/$(basename "$src_file")"
    echo "  ✓ [Claude]  ${COMMANDS_DEST}/$(basename "$src_file")"
  done
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
#  Validate required docs/ files exist
# ──────────────────────────────────────────────────────────────────────────────
AGENT_ARCH_DOC="docs/agent_architecture.md"
DOC_ARCH="docs/doc_architecture.md"
DOC_VERIFICATION="docs/doc_verification_guide.md"

MISSING_DOCS=()
[[ ! -f "$AGENT_ARCH_DOC" ]]   && MISSING_DOCS+=("agent_architecture.md")
[[ ! -f "$DOC_ARCH" ]]          && MISSING_DOCS+=("doc_architecture.md")
[[ ! -f "$DOC_VERIFICATION" ]]  && MISSING_DOCS+=("doc_verification_guide.md")

if [[ ${#MISSING_DOCS[@]} -gt 0 ]]; then
  echo "⚠️  Faltan archivos necesarios en docs/:"
  for doc in "${MISSING_DOCS[@]}"; do
    echo "   - docs/${doc}"
  done
  echo ""
  echo "   Estos archivos son requeridos para que los SKILLs funcionen correctamente."
  echo ""
  
  # Non-interactive: check CREATE_DOCS env var
  if [[ -n "${CREATE_DOCS:-}" ]]; then
    if [[ "${CREATE_DOCS,,}" == "yes" || "${CREATE_DOCS,,}" == "y" ]]; then
      CREATE_THEM=true
    else
      CREATE_THEM=false
    fi
  else
    # Interactive: ask user
    read -rp "¿Deseas que cree templates base para estos archivos? (s/n): " response
    if [[ "${response,,}" == "s" || "${response,,}" == "y" || "${response,,}" == "yes" || "${response,,}" == "sí" ]]; then
      CREATE_THEM=true
    else
      CREATE_THEM=false
    fi
  fi

  if "$CREATE_THEM"; then
    mkdir -p docs
    
    # Copy template files from submodule
    TEMPLATES_SRC="${SUBMODULE_DIR}/templates/docs"
    
    [[ ! -f "$AGENT_ARCH_DOC" ]]  && cp "${TEMPLATES_SRC}/agent_architecture.md" "$AGENT_ARCH_DOC" && echo "  ✓ Created ${AGENT_ARCH_DOC}"
    [[ ! -f "$DOC_ARCH" ]]         && cp "${TEMPLATES_SRC}/doc_architecture.md" "$DOC_ARCH" && echo "  ✓ Created ${DOC_ARCH}"
    [[ ! -f "$DOC_VERIFICATION" ]] && cp "${TEMPLATES_SRC}/doc_verification_guide.md" "$DOC_VERIFICATION" && echo "  ✓ Created ${DOC_VERIFICATION}"
    
    echo ""
    echo "  📝 Templates creados. Debes personalizarlos para tu proyecto:"
    echo "     1. Reemplaza los placeholders [TODO] y [YOUR_PROJECT_NAME]"
    echo "     2. Actualiza los comandos con los de tu stack tecnológico"
    echo "     3. Documenta tu estructura de proyecto real"
    echo ""
  else
    echo ""
    echo "  ⚠️  IMPORTANTE: Los SKILLs de Copilot dependen de estos 3 archivos."
    echo "     Sin ellos, los agentes no tendrán el contexto necesario para"
    echo "     tomar decisiones correctas sobre tu proyecto."
    echo ""
    echo "     Crea manualmente:"
    echo "       - docs/agent_architecture.md"
    echo "       - docs/doc_architecture.md"
    echo "       - docs/doc_verification_guide.md"
    echo ""
  fi
fi

# ──────────────────────────────────────────────────────────────────────────────
#  Validate .github/ SDD files (only when Copilot is selected)
# ──────────────────────────────────────────────────────────────────────────────
if "$SYNC_COPILOT"; then
  GITHUB_FILES=(
    ".github/CODEOWNERS"
    ".github/PULL_REQUEST_TEMPLATE.md"
    ".github/ISSUE_TEMPLATE/user-story.md"
    ".github/workflows/archive-cleanup.yml"
    ".github/workflows/spec-lint.yml"
  )

  MISSING_GITHUB=()
  for f in "${GITHUB_FILES[@]}"; do
    [[ ! -f "$f" ]] && MISSING_GITHUB+=("$f")
  done

  if [[ ${#MISSING_GITHUB[@]} -gt 0 ]]; then
    echo "⚠️  Faltan archivos SDD en .github/:"
    for f in "${MISSING_GITHUB[@]}"; do
      echo "   - ${f}"
    done
    echo ""
    echo "   Estos archivos habilitan el flujo SDD en GitHub (CI, PR template, issue template)."
    echo ""

    # Non-interactive: check CREATE_GITHUB_FILES env var
    if [[ -n "${CREATE_GITHUB_FILES:-}" ]]; then
      if [[ "${CREATE_GITHUB_FILES,,}" == "yes" || "${CREATE_GITHUB_FILES,,}" == "y" ]]; then
        CREATE_GITHUB=true
      else
        CREATE_GITHUB=false
      fi
    else
      # Interactive: ask user
      read -rp "¿Deseas que cree templates base para estos archivos? (s/n): " response
      if [[ "${response,,}" == "s" || "${response,,}" == "y" || "${response,,}" == "yes" || "${response,,}" == "sí" ]]; then
        CREATE_GITHUB=true
      else
        CREATE_GITHUB=false
      fi
    fi

    if "$CREATE_GITHUB"; then
      GITHUB_TEMPLATES="${SUBMODULE_DIR}/templates/github"
      mkdir -p .github/ISSUE_TEMPLATE .github/workflows

      [[ ! -f ".github/CODEOWNERS" ]]                      && cp "${GITHUB_TEMPLATES}/CODEOWNERS" ".github/CODEOWNERS"                                          && echo "  ✓ Created .github/CODEOWNERS"
      [[ ! -f ".github/PULL_REQUEST_TEMPLATE.md" ]]        && cp "${GITHUB_TEMPLATES}/PULL_REQUEST_TEMPLATE.md" ".github/PULL_REQUEST_TEMPLATE.md"              && echo "  ✓ Created .github/PULL_REQUEST_TEMPLATE.md"
      [[ ! -f ".github/ISSUE_TEMPLATE/user-story.md" ]]    && cp "${GITHUB_TEMPLATES}/ISSUE_TEMPLATE/user-story.md" ".github/ISSUE_TEMPLATE/user-story.md"      && echo "  ✓ Created .github/ISSUE_TEMPLATE/user-story.md"
      [[ ! -f ".github/workflows/archive-cleanup.yml" ]]   && cp "${GITHUB_TEMPLATES}/workflows/archive-cleanup.yml" ".github/workflows/archive-cleanup.yml"    && echo "  ✓ Created .github/workflows/archive-cleanup.yml"
      [[ ! -f ".github/workflows/spec-lint.yml" ]]         && cp "${GITHUB_TEMPLATES}/workflows/spec-lint.yml" ".github/workflows/spec-lint.yml"                && echo "  ✓ Created .github/workflows/spec-lint.yml"

      echo ""
      echo "  📝 Templates creados. Debes personalizar:"
      echo "     1. .github/CODEOWNERS              → reemplaza @tech-lead con el handle real"
      echo "     2. .github/PULL_REQUEST_TEMPLATE.md → añade comandos de test/lint de tu stack"
      echo "     3. .github/workflows/spec-lint.yml  → añade los paths de código fuente de tu proyecto"
      echo ""
    else
      echo ""
      echo "  ⚠️  IMPORTANTE: Sin estos archivos el flujo SDD en GitHub estará incompleto."
      echo "     - Sin spec-lint.yml    → los PRs no validan estructura de specs"
      echo "     - Sin archive-cleanup  → las proposals obsoletas no generan alertas"
      echo "     - Sin PR template      → los desarrolladores no tienen checklist SDD"
      echo ""
    fi
  fi
fi

# ──────────────────────────────────────────────────────────────────────────────
#  Validate .claude/ config files (only when Claude is selected)
# ──────────────────────────────────────────────────────────────────────────────
if "$SYNC_CLAUDE"; then
  CLAUDE_MD=".claude/CLAUDE.md"
  CLAUDE_SETTINGS=".claude/settings.json"

  MISSING_CLAUDE=()
  [[ ! -f "$CLAUDE_MD" ]]       && MISSING_CLAUDE+=("CLAUDE.md")
  [[ ! -f "$CLAUDE_SETTINGS" ]] && MISSING_CLAUDE+=("settings.json")

  if [[ ${#MISSING_CLAUDE[@]} -gt 0 ]]; then
    echo "⚠️  Faltan archivos de configuración de Claude en .claude/:"
    for f in "${MISSING_CLAUDE[@]}"; do
      echo "   - .claude/${f}"
    done
    echo ""
    echo "   Estos archivos son necesarios para que Claude Code funcione correctamente."
    echo ""

    # Non-interactive: check CREATE_CLAUDE_FILES env var
    if [[ -n "${CREATE_CLAUDE_FILES:-}" ]]; then
      if [[ "${CREATE_CLAUDE_FILES,,}" == "yes" || "${CREATE_CLAUDE_FILES,,}" == "y" ]]; then
        CREATE_CLAUDE=true
      else
        CREATE_CLAUDE=false
      fi
    else
      # Interactive: ask user
      read -rp "¿Deseas que cree templates base para estos archivos? (s/n): " response
      if [[ "${response,,}" == "s" || "${response,,}" == "y" || "${response,,}" == "yes" || "${response,,}" == "sí" ]]; then
        CREATE_CLAUDE=true
      else
        CREATE_CLAUDE=false
      fi
    fi

    if "$CREATE_CLAUDE"; then
      mkdir -p .claude
      CLAUDE_TEMPLATES="${SUBMODULE_DIR}/templates/claude"

      [[ ! -f "$CLAUDE_MD" ]]       && cp "${CLAUDE_TEMPLATES}/CLAUDE.md" "$CLAUDE_MD"       && echo "  ✓ Created ${CLAUDE_MD}"
      [[ ! -f "$CLAUDE_SETTINGS" ]] && cp "${CLAUDE_TEMPLATES}/settings.json" "$CLAUDE_SETTINGS" && echo "  ✓ Created ${CLAUDE_SETTINGS}"

      echo ""
      echo "  📝 Templates creados. Debes personalizar .claude/CLAUDE.md con:"
      echo "     1. Nombre y descripción de tu proyecto"
      echo "     2. Stack tecnológico específico"
      echo "     3. Módulos del sistema"
      echo "     4. Convenciones de código del proyecto"
      echo "     (El settings.json ya tiene permisos base seguros para SDD)"
      echo ""
    else
      echo ""
      echo "  ⚠️  IMPORTANTE: Claude Code necesita estos archivos para operar correctamente."
      echo "     Sin ellos, el agente no tendrá contexto del proyecto ni restricciones de seguridad."
      echo ""
      echo "     Crea manualmente:"
      echo "       - .claude/CLAUDE.md      (contexto del proyecto para el agente)"
      echo "       - .claude/settings.json  (permisos allow/deny del agente)"
      echo ""
    fi
  fi
fi

echo "✅ Sync complete. Review with 'git diff' then commit."
