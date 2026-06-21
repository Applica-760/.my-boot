#!/usr/bin/env bash
# usage: ./install.sh [TARGET_DIR]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$PWD}"
mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"

if [ "$TARGET" = "$SCRIPT_DIR" ]; then
  echo "error: The distribution destination is this repository itself." >&2
  exit 1
fi

copy_dir() {
  rsync -a --exclude='.DS_Store' --exclude='.git' "$1"/ "$2"/
}

deploy_managed() {
  local src="$1" dst="$2" start="$3" end="$4" starts ends first last tmp
  starts="$(grep -cFx "$start" "$src" || true)"
  ends="$(grep -cFx "$end" "$src" || true)"
  first="$(grep -nFx "$start" "$src" | cut -d: -f1 || true)"
  last="$(grep -nFx "$end" "$src" | cut -d: -f1 || true)"

  if [ "$starts" -ne 1 ] || [ "$ends" -ne 1 ] || [ "$first" -ge "$last" ]; then
    echo "error: invalid managed markers: $src" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$dst")"
  if [ ! -e "$dst" ]; then
    cp "$src" "$dst"
    return
  fi

  starts="$(grep -cFx "$start" "$dst" || true)"
  ends="$(grep -cFx "$end" "$dst" || true)"
  first="$(grep -nFx "$start" "$dst" | cut -d: -f1 || true)"
  last="$(grep -nFx "$end" "$dst" | cut -d: -f1 || true)"

  if [ "$starts" -gt 1 ] || [ "$ends" -gt 1 ] || [ "$starts" -ne "$ends" ] \
    || { [ "$starts" -eq 1 ] && [ "$first" -ge "$last" ]; }; then
    echo "error: invalid managed markers: $dst" >&2
    exit 1
  fi

  tmp="$(mktemp "${dst}.XXXXXX")"
  if [ "$starts" -eq 0 ]; then
    { cat "$src"; printf '\n'; cat "$dst"; } > "$tmp"
  else
    awk -v src="$src" -v start="$start" -v end="$end" '
      $0 == start { while ((getline line < src) > 0) print line; skip = 1; next }
      $0 == end { skip = 0; next }
      !skip
    ' "$dst" > "$tmp"
  fi
  mv "$tmp" "$dst"
}

merge_settings() {
  python3 - "$1" "$2" <<'PY'
import json
import sys
from pathlib import Path

src, dst = map(Path, sys.argv[1:])
common = json.loads(src.read_text())
dst.parent.mkdir(parents=True, exist_ok=True)

if not dst.exists():
    dst.write_text(json.dumps(common, indent=2, ensure_ascii=False) + "\n")
    raise SystemExit

project = json.loads(dst.read_text())
original = json.dumps(project, sort_keys=True)
src_allow = common.get("permissions", {}).get("allow", [])
dst_allow = project.setdefault("permissions", {}).setdefault("allow", [])
project["permissions"]["allow"] = list(dict.fromkeys(dst_allow + src_allow))

if "hooks" in common:
    project["hooks"] = {**project.get("hooks", {}), **common["hooks"]}

if json.dumps(project, sort_keys=True) != original:
    dst.write_text(json.dumps(project, indent=2, ensure_ascii=False) + "\n")
PY
}

rsync -a --exclude='.DS_Store' --exclude='.git' \
  --exclude='CLAUDE.md' --exclude='settings.json' \
  "$SCRIPT_DIR/.claude"/ "$TARGET/.claude"/
deploy_managed \
  "$SCRIPT_DIR/.claude/CLAUDE.md" "$TARGET/.claude/CLAUDE.md" \
  '<!-- hub:managed:start -->' '<!-- hub:managed:end -->'
merge_settings "$SCRIPT_DIR/.claude/settings.json" "$TARGET/.claude/settings.json"

copy_dir "$SCRIPT_DIR/.codex" "$TARGET/.codex"
deploy_managed \
  "$SCRIPT_DIR/AGENTS.md" "$TARGET/AGENTS.md" \
  '<!-- hub:managed:start -->' '<!-- hub:managed:end -->'
cp "$SCRIPT_DIR/.mcp.json" "$TARGET/.mcp.json"

deploy_managed \
  "$SCRIPT_DIR/.gitignore" "$TARGET/.gitignore" \
  '# hub:managed:start' '# hub:managed:end'

if command -v codegraph &>/dev/null || [ -x "$TARGET/node_modules/.bin/codegraph" ]; then
  echo "Building CodeGraph index..."
  codegraph init "$TARGET" || true
fi

echo "done."
