#!/usr/bin/env bash
# usage: ./install.sh [TARGET_DIR]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$PWD}"
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"

if [ "$TARGET" = "$SCRIPT_DIR" ]; then
  echo "error: 配布先がこのリポジトリ自身です。" >&2
  exit 1
fi

copy_dir() {
  rsync -a --exclude='.DS_Store' --exclude='.git' "$1"/ "$2"/
}

copy_dir "$SCRIPT_DIR/claude" "$TARGET/.claude"

copy_dir "$SCRIPT_DIR/codex" "$TARGET/.codex"
cp "$SCRIPT_DIR/codex/AGENTS.md" "$TARGET/AGENTS.md"

touch "$TARGET/.gitignore"
for e in .my-boot/ .claude/ .codex/ AGENTS.md; do
  grep -qxF "$e" "$TARGET/.gitignore" || echo "$e" >> "$TARGET/.gitignore"
done

echo "done."
