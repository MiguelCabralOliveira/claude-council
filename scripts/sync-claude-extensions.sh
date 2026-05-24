#!/usr/bin/env bash
# Scans $HOME for .claude/commands and .claude/skills directories and
# symlinks each entry into ~/.claude/commands and ~/.claude/skills so they
# become user-level (available in every Claude Code session).
#
# Excludes node_modules, ~/.claude itself, and the plugin cache.
# Idempotent: prunes broken symlinks; never overwrites real files.
# Safe to run on machines without Claude Code installed: it just creates
# the dirs and exits with nothing to do.

set -euo pipefail

USER_CLAUDE="$HOME/.claude"
DEST_CMDS="$USER_CLAUDE/commands"
DEST_SKILLS="$USER_CLAUDE/skills"

mkdir -p "$DEST_CMDS" "$DEST_SKILLS"

# Need `fd` for the scan. If absent, exit quietly so this hook never breaks
# `npm run dev` for teammates who haven't installed it.
if ! command -v fd >/dev/null 2>&1; then
  echo "sync-claude-extensions: 'fd' not found, skipping scan (install via: brew install fd)" >&2
  exit 0
fi

# Prune broken symlinks first
for dest in "$DEST_CMDS" "$DEST_SKILLS"; do
  for link in "$dest"/* "$dest"/.[!.]*; do
    [ -e "$link" ] || [ -L "$link" ] || continue
    if [ -L "$link" ] && [ ! -e "$link" ]; then
      echo "prune broken: $link"
      rm -f "$link"
    fi
  done
done

link_entries() {
  local src_dir="$1" dest_dir="$2" kind="$3"
  [ -d "$src_dir" ] || return 0
  for entry in "$src_dir"/*; do
    [ -e "$entry" ] || continue
    local name
    name="$(basename "$entry")"
    local target="$dest_dir/$name"
    # Don't clobber a real (non-symlink) file/dir
    if [ -e "$target" ] && [ ! -L "$target" ]; then
      echo "skip (exists, not symlink): $target"
      continue
    fi
    ln -sfn "$entry" "$target"
    echo "link $kind: $name -> $entry"
  done
}

while IFS= read -r claude_dir; do
  link_entries "$claude_dir/commands" "$DEST_CMDS" "cmd"
  link_entries "$claude_dir/skills" "$DEST_SKILLS" "skill"
done < <(
  fd -t d -H -u '^\.claude$' "$HOME" 2>/dev/null \
    | grep -v '/node_modules/' \
    | grep -v "^$USER_CLAUDE/\?$" \
    | grep -v "^$USER_CLAUDE$" \
    | grep -v "$USER_CLAUDE/plugins/"
)
