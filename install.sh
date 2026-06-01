#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CODEX_DIR="$HOME/.codex"
CONFIG_TARGET="$CODEX_DIR/config.toml"
MANIFEST="$SCRIPT_DIR/hooks/codex.atomic-hooks.json"
SKILLS_TARGET="$CODEX_DIR/skills"

HOOKS_STATUS="not installed"

# 1. Enable the Codex `hooks` feature flag in ~/.codex/config.toml
#    (migrating the deprecated `codex_hooks` name if present).
mkdir -p "$CODEX_DIR"
if [ ! -f "$CONFIG_TARGET" ]; then
  printf '[features]\nhooks = true\n' > "$CONFIG_TARGET"
  CONFIG_STATUS="created config.toml"
elif grep -q 'codex_hooks' "$CONFIG_TARGET"; then
  sed -i.bak 's/codex_hooks[[:space:]]*=[[:space:]]*true/hooks = true/' "$CONFIG_TARGET"
  rm -f "$CONFIG_TARGET.bak"
  CONFIG_STATUS="migrated codex_hooks → hooks"
elif ! grep -q 'hooks[[:space:]]*=[[:space:]]*true' "$CONFIG_TARGET"; then
  printf '\n[features]\nhooks = true\n' >> "$CONFIG_TARGET"
  CONFIG_STATUS="enabled hooks feature flag"
else
  CONFIG_STATUS="already enabled"
fi
echo "  config: $CONFIG_STATUS"

# 2. Register hooks by delegating the merge to the atomic binary. The manifest
#    in this repo is the source of truth — when Codex changes its hook schema,
#    edit the manifest and re-publish; no `atomic` rebuild needed.
if command -v atomic &>/dev/null; then
  echo "Installing hooks..."
  if atomic agent enable --hooks "$MANIFEST"; then
    HOOKS_STATUS="registered via atomic agent enable"
  else
    HOOKS_STATUS="enable failed — see output above"
  fi
else
  HOOKS_STATUS="SKIPPED — 'atomic' not on PATH"
  echo "Warning: 'atomic' not found on PATH."
  echo "  Install Atomic VCS first, then run:"
  echo "    atomic agent enable --hooks \"$MANIFEST\""
fi

# 3. Symlink AGENTS.md and skills into ~/.codex/ (live updates on pull).
ln -sf "$SCRIPT_DIR/AGENTS.md" "$CODEX_DIR/AGENTS.md"
echo "  agents: AGENTS.md → ~/.codex/AGENTS.md"

mkdir -p "$SKILLS_TARGET"
skills_linked=0
for skill in atomic-vault atomic-vcs code-intelligence; do
  src="$SCRIPT_DIR/skills/$skill/SKILL.md"
  if [ -f "$src" ]; then
    mkdir -p "$SKILLS_TARGET/$skill"
    ln -sf "$src" "$SKILLS_TARGET/$skill/SKILL.md"
    skills_linked=$((skills_linked + 1))
  fi
done
echo "  skills: $skills_linked symlinked → ~/.codex/skills/"

cat <<EOF

────────────────────────────────────────────────────────────
✓ Installed atomic-codex
────────────────────────────────────────────────────────────

What was installed:
  • Config     ${CONFIG_STATUS}
               → ~/.codex/config.toml ([features] hooks = true)
  • Hooks      ${HOOKS_STATUS}
               → ~/.codex/hooks.json (merged from this repo's manifest by
                 'atomic agent enable --hooks'; hook definitions live in
                 ${MANIFEST})
  • Agents     AGENTS.md symlinked → ~/.codex/AGENTS.md
  • Skills     ${skills_linked} symlinked → ~/.codex/skills/
               (/atomic-vault, /atomic-vcs, /code-intelligence)

Symlinks point back into this checkout:
  ${SCRIPT_DIR}
Keep this directory in place; moving or deleting it breaks the links.

Manual steps to finish:
  1. Per project, copy the agent prompt to the repo root:
       cp "${SCRIPT_DIR}/AGENTS.md" /path/to/your/project/
  2. Ensure the project is an Atomic repo (one-time):
       cd /path/to/your/project && atomic init
  3. Start Codex in that project — hooks fire automatically.

Verify:
  • Config: grep -q "hooks = true" ~/.codex/config.toml && echo OK
  • Hooks:  grep -q "atomic agent hooks codex" ~/.codex/hooks.json && echo OK
  • Skills: ls ~/.codex/skills/

Uninstall:
  ./install.sh is install-only; to remove run:
    node install.js --uninstall
  (or: atomic agent disable --hooks "${MANIFEST}")
────────────────────────────────────────────────────────────
EOF
