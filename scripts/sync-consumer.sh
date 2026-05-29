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

if "$CHECK_MODE"; then
  DRIFT=false

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

  if "$DRIFT"; then
    echo ""
    echo "❌ Drift detected. Run: bash ${SUBMODULE_DIR}/scripts/sync-consumer.sh"
    exit 1
  else
    echo "✅ No drift detected — all playbook files are in sync."
    exit 0
  fi

else
  echo "Syncing playbooks from ${SUBMODULE_DIR}..."

  mkdir -p "$SKILLS_DEST"
  for src_dir in "$SKILLS_SRC"/*/; do
    slug=$(basename "$src_dir")
    dest_dir="${SKILLS_DEST}/${slug}"
    mkdir -p "$dest_dir"
    cp "${src_dir}SKILL.md" "${dest_dir}/SKILL.md"
    echo "  ✓ ${dest_dir}/SKILL.md"
  done

  mkdir -p "$COMMANDS_DEST"
  for src_file in "$COMMANDS_SRC"/*.md; do
    cp "$src_file" "${COMMANDS_DEST}/$(basename "$src_file")"
    echo "  ✓ ${COMMANDS_DEST}/$(basename "$src_file")"
  done

  echo ""
  echo "✅ Sync complete. Review with 'git diff' then commit."
fi
