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
#   CREATE_CLAUDE_FILES   default: (interactive)  set to "yes" or "no" to skip prompt for missing Claude base files
#   CREATE_GITHUB_FILES   default: (interactive)  set to "yes" or "no" to skip prompt for missing .github/ files
#   CREATE_OPENSPEC       default: (interactive)  set to "yes" or "no" to skip prompt for missing openspec/ structure

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
#  Upsert managed SDD block inside root CLAUDE.md
# ──────────────────────────────────────────────────────────────────────────────
upsert_claude_sdd_block() {
  local target_file="$1"
  local sdd_template="$2"
  local start_marker="<!-- BEGIN SDD PLAYBOOKS -->"
  local end_marker="<!-- END SDD PLAYBOOKS -->"
  local tmp_file

  if [[ ! -f "$sdd_template" ]]; then
    echo "  ⚠️  Template no encontrado: ${sdd_template}"
    return
  fi

  tmp_file=$(mktemp)

  if grep -qF "$start_marker" "$target_file" && grep -qF "$end_marker" "$target_file"; then
    awk -v start="$start_marker" -v end="$end_marker" -v tpl="$sdd_template" '
      BEGIN { inside = 0 }
      index($0, start) {
        print
        while ((getline line < tpl) > 0) {
          print line
        }
        close(tpl)
        inside = 1
        next
      }
      index($0, end) {
        inside = 0
        print
        next
      }
      !inside { print }
    ' "$target_file" > "$tmp_file"
    mv "$tmp_file" "$target_file"
    echo "  ✓ Updated SDD block in ${target_file}"
  else
    cat "$target_file" > "$tmp_file"
    {
      echo ""
      echo "$start_marker"
      cat "$sdd_template"
      echo "$end_marker"
    } >> "$tmp_file"
    mv "$tmp_file" "$target_file"
    echo "  ✓ Inserted SDD block in ${target_file}"
  fi
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
MANUAL_SDD="docs/manual-sdd-agentic-engineer.md"
SDD_WORKFLOW="docs/sdd-workflow.md"

MISSING_DOCS=()
[[ ! -f "$AGENT_ARCH_DOC" ]]   && MISSING_DOCS+=("agent_architecture.md")
[[ ! -f "$DOC_ARCH" ]]          && MISSING_DOCS+=("doc_architecture.md")
[[ ! -f "$DOC_VERIFICATION" ]]  && MISSING_DOCS+=("doc_verification_guide.md")
[[ ! -f "$MANUAL_SDD" ]]  && MISSING_DOCS+=("manual-sdd-agentic-engineer.md")
[[ ! -f "$SDD_WORKFLOW" ]]  && MISSING_DOCS+=("sdd-workflow.md")

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
    [[ ! -f "$MANUAL_SDD" ]] && cp "${TEMPLATES_SRC}/manual-sdd-agentic-engineer.md" "$MANUAL_SDD" && echo "  ✓ Created ${MANUAL_SDD}"
    [[ ! -f "$SDD_WORKFLOW" ]] && cp "${TEMPLATES_SRC}/sdd-workflow.md" "$SDD_WORKFLOW" && echo "  ✓ Created ${SDD_WORKFLOW}"
    
    echo ""
    echo "  📝 Templates creados. Debes personalizarlos para tu proyecto:"
    echo "     1. Reemplaza los placeholders [TODO] y [YOUR_PROJECT_NAME]"
    echo "     2. Actualiza los comandos con los de tu stack tecnológico"
    echo "     3. Documenta tu estructura de proyecto real"
    echo ""
  else
    echo ""
    echo "  ⚠️  IMPORTANTE: Los SKILLs de Copilot dependen de estos archivos (salvo los asociado a SDD, que son manuales de como usar esta metodologia)."
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
#  Validate OpenSpec base structure (required for SDD workflows)
# ──────────────────────────────────────────────────────────────────────────────
OPEN_SPEC_DIR="openspec/specs"
OPEN_CHANGES_DIR="openspec/changes"
OPEN_SYSTEM_SPEC="openspec/specs/system.md"

MISSING_OPENSPEC=()
[[ ! -d "$OPEN_SPEC_DIR" ]]    && MISSING_OPENSPEC+=("openspec/specs/")
[[ ! -d "$OPEN_CHANGES_DIR" ]] && MISSING_OPENSPEC+=("openspec/changes/")
[[ ! -f "$OPEN_SYSTEM_SPEC" ]] && MISSING_OPENSPEC+=("openspec/specs/system.md")

if [[ ${#MISSING_OPENSPEC[@]} -gt 0 ]]; then
  echo "⚠️  Falta estructura base de OpenSpec en el proyecto:"
  for p in "${MISSING_OPENSPEC[@]}"; do
    echo "   - ${p}"
  done
  echo ""
  echo "   Esta estructura es requerida para ejecutar correctamente el ciclo SDD."
  echo ""

  # Non-interactive: check CREATE_OPENSPEC env var
  if [[ -n "${CREATE_OPENSPEC:-}" ]]; then
    if [[ "${CREATE_OPENSPEC,,}" == "yes" || "${CREATE_OPENSPEC,,}" == "y" ]]; then
      CREATE_OPS=true
    else
      CREATE_OPS=false
    fi
  else
    # Interactive: ask user
    read -rp "¿Deseas que cree la estructura base de OpenSpec? (s/n): " response
    if [[ "${response,,}" == "s" || "${response,,}" == "y" || "${response,,}" == "yes" || "${response,,}" == "sí" ]]; then
      CREATE_OPS=true
    else
      CREATE_OPS=false
    fi
  fi

  if "$CREATE_OPS"; then
    mkdir -p "$OPEN_SPEC_DIR" "$OPEN_CHANGES_DIR"
    OPENSPEC_TEMPLATES="${SUBMODULE_DIR}/templates/openspec"

    [[ ! -f "$OPEN_SYSTEM_SPEC" ]] && cp "${OPENSPEC_TEMPLATES}/system.md" "$OPEN_SYSTEM_SPEC" && echo "  ✓ Created ${OPEN_SYSTEM_SPEC}"
    [[ ! -f "${OPEN_CHANGES_DIR}/.gitkeep" ]] && touch "${OPEN_CHANGES_DIR}/.gitkeep"

    echo ""
    echo "  📝 Base OpenSpec creada. Debes personalizar openspec/specs/system.md con:"
    echo "     1. Contexto y principios de producto"
    echo "     2. Stack tecnológico real"
    echo "     3. Flujos y convenciones de tu proyecto"
    echo ""
  else
    echo ""
    echo "  ⚠️  IMPORTANTE: Sin openspec/specs/ y openspec/changes/ el flujo SDD queda incompleto."
    echo "     Los comandos /sdd-* dependen de esta estructura para planificar y ejecutar features."
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
#  Validate Claude setup (root CLAUDE.md + .claude/settings.json)
# ──────────────────────────────────────────────────────────────────────────────
if "$SYNC_CLAUDE"; then
  CLAUDE_ROOT_MD="CLAUDE.md"
  CLAUDE_SETTINGS=".claude/settings.json"
  CLAUDE_TEMPLATES="${SUBMODULE_DIR}/templates/claude"
  CLAUDE_ROOT_TEMPLATE="${CLAUDE_TEMPLATES}/CLAUDE.md"
  CLAUDE_SDD_TEMPLATE="${CLAUDE_TEMPLATES}/CLAUDE_SDD_BLOCK.md"

  MISSING_CLAUDE=()
  [[ ! -f "$CLAUDE_ROOT_MD" ]] && MISSING_CLAUDE+=("CLAUDE.md (raíz del proyecto)")
  [[ ! -f "$CLAUDE_SETTINGS" ]] && MISSING_CLAUDE+=(".claude/settings.json")

  if [[ ${#MISSING_CLAUDE[@]} -gt 0 ]]; then
    echo "⚠️  Faltan archivos base para Claude Code:"
    for f in "${MISSING_CLAUDE[@]}"; do
      echo "   - ${f}"
    done
    echo ""
    echo "   Claude usa CLAUDE.md en la raíz. settings.json define permisos del agente."
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

      [[ ! -f "$CLAUDE_ROOT_MD" ]] && cp "$CLAUDE_ROOT_TEMPLATE" "$CLAUDE_ROOT_MD" && echo "  ✓ Created ${CLAUDE_ROOT_MD}"
      [[ ! -f "$CLAUDE_SETTINGS" ]] && cp "${CLAUDE_TEMPLATES}/settings.json" "$CLAUDE_SETTINGS" && echo "  ✓ Created ${CLAUDE_SETTINGS}"

      echo ""
      echo "  📝 Claude base creada. Debes personalizar CLAUDE.md con tu contexto de proyecto."
      echo "     El bloque SDD entre marcadores será administrado automáticamente por sync-playbooks.sh"
      echo ""
    else
      echo ""
      echo "  ⚠️  IMPORTANTE: Claude Code necesita CLAUDE.md en raíz y .claude/settings.json."
      echo "     Sin ellos, el agente puede ignorar patrones SDD o ejecutar sin límites correctos."
      echo ""
    fi
  fi

  # Keep SDD guidance in sync without overwriting developer-specific context.
  if [[ -f "$CLAUDE_ROOT_MD" ]]; then
    upsert_claude_sdd_block "$CLAUDE_ROOT_MD" "$CLAUDE_SDD_TEMPLATE"
  fi
fi

echo "✅ Sync complete. Review with 'git diff' then commit."
