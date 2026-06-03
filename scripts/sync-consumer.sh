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
#   AI_TARGET      default: (interactive)   set to "copilot", "claude", or "both" to skip prompt
#   CREATE_DOCS    default: (interactive)   set to "yes" or "no" to skip prompt for missing docs/ files

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
#  Interactive checkbox selector (requires bash 4.3+ for namerefs)
#  Usage: checkbox_select result_var "Option A" "Option B" ...
#  Populates result_var with an array of selected option strings.
# ──────────────────────────────────────────────────────────────────────────────
checkbox_select() {
  local -n _cb_result="$1"
  shift
  local options=("$@")
  local n=${#options[@]}
  local selected=()
  local current=0

  for ((i = 0; i < n; i++)); do
    selected+=(false)
  done

  _cb_draw() {
    printf "  ¿Qué IA usas para desarrollar?\n"
    printf "  (↑↓ navegar · ESPACIO seleccionar · ENTER confirmar)\n\n"
    for ((i = 0; i < n; i++)); do
      local mark="[ ]"
      [[ "${selected[$i]}" == true ]] && mark="[x]"
      if [[ $i -eq $current ]]; then
        printf "  \e[1;36m▶ %s %s\e[0m\n" "$mark" "${options[$i]}"
      else
        printf "    %s %s\n" "$mark" "${options[$i]}"
      fi
    done
  }

  local total_lines=$((n + 3))   # header lines + options

  tput civis 2>/dev/null || true  # hide cursor
  _cb_draw

  while true; do
    local key seq
    IFS= read -rsn1 key

    if [[ $key == $'\x1b' ]]; then
      IFS= read -rsn2 -t 0.1 seq || true
      case "$seq" in
        '[A') ((current > 0))     && ((current--)) ;;
        '[B') ((current < n - 1)) && ((current++)) ;;
      esac
    elif [[ $key == ' ' ]]; then
      if [[ "${selected[$current]}" == true ]]; then
        selected[$current]=false
      else
        selected[$current]=true
      fi
    elif [[ $key == '' || $key == $'\n' ]]; then
      break
    fi

    # Redraw in place
    printf '\e[%dA\e[J' "$total_lines"
    _cb_draw
  done

  tput cnorm 2>/dev/null || true  # restore cursor
  printf '\n'

  _cb_result=()
  for ((i = 0; i < n; i++)); do
    [[ "${selected[$i]}" == true ]] && _cb_result+=("${options[$i]}")
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

  # Interactive path: checkbox selector
  local choices=()
  checkbox_select choices "GitHub Copilot" "Claude"

  if [[ ${#choices[@]} -eq 0 ]]; then
    echo "⚠️  No seleccionaste ninguna opción. Saliendo."
    exit 0
  fi

  for c in "${choices[@]}"; do
    [[ "$c" == "GitHub Copilot" ]] && SYNC_COPILOT=true
    [[ "$c" == "Claude" ]]         && SYNC_CLAUDE=true
  done
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

echo "✅ Sync complete. Review with 'git diff' then commit."
