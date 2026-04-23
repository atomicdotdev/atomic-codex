#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. Enable hooks feature flag in config.toml
CODEX_CONFIG="$HOME/.codex/config.toml"
if [ -f "$CODEX_CONFIG" ]; then
  if ! grep -q "codex_hooks" "$CODEX_CONFIG" 2>/dev/null; then
    echo "" >> "$CODEX_CONFIG"
    echo "[features]" >> "$CODEX_CONFIG"
    echo "codex_hooks = true" >> "$CODEX_CONFIG"
    echo "  config: enabled codex_hooks feature flag"
  fi
else
  mkdir -p "$HOME/.codex"
  echo "[features]" > "$CODEX_CONFIG"
  echo "codex_hooks = true" >> "$CODEX_CONFIG"
  echo "  config: created config.toml with codex_hooks enabled"
fi

# 2. Install hooks via atomic CLI
if command -v atomic &>/dev/null; then
  echo "Installing hooks..."
  atomic agent enable --agent codex --global 2>/dev/null && echo "  hooks: installed into ~/.codex/hooks.json" || echo "  hooks: using manual install"
else
  echo "Warning: 'atomic' not found on PATH."
  echo "  Install Atomic VCS first, then run: atomic agent enable --agent codex --global"
fi

echo ""
echo "✓ Installed atomic-codex"
echo ""
echo "  To add Atomic to a project:"
echo "    cp $SCRIPT_DIR/AGENTS.md /path/to/your/project/"
echo ""
echo "  Make sure codex_hooks is enabled in ~/.codex/config.toml:"
echo "    [features]"
echo "    codex_hooks = true"
