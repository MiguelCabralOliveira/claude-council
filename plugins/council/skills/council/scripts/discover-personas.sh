#!/usr/bin/env bash
# discover-personas.sh — index every Claude Code skill/command on this machine
# Output: JSON object { "<name>": "<absolute path>", ... } on stdout.
#
# Search precedence (later wins for duplicates):
#   1. Plugin marketplaces under ~/.claude/plugins/
#   2. Other project .claude/ dirs anywhere under $HOME (depth-limited)
#   3. User-level ~/.claude/{commands,skills}
#   4. Current project <cwd>/.claude/{commands,skills}
#
# Usage:
#   discover-personas.sh                 # default roots
#   discover-personas.sh /path/A /path/B # extra roots to scan
#
# Notes:
#   - Symlinks are followed.
#   - Names come from filenames: <name>.md for commands, <name>/SKILL.md for skills.
#   - Duplicate names: later sources override earlier ones (project > user > plugin).

set -euo pipefail

cwd="$(pwd)"
home="${HOME:-/Users/$(whoami)}"

declare -a roots
roots+=("$home/.claude/plugins")
# Add additional project roots discovered under $HOME (max-depth 4, skip junk).
while IFS= read -r dir; do
  roots+=("$dir")
done < <(fd -t d -H -I '^\.claude$' "$home" --max-depth 4 \
           --exclude node_modules --exclude .git \
           --exclude Library --exclude .Trash 2>/dev/null || true)

roots+=("$home/.claude")
roots+=("$cwd/.claude")

# Allow extra roots passed as args.
for extra in "$@"; do
  roots+=("$extra")
done

# Collect entries: name<TAB>path
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

for root in "${roots[@]}"; do
  [ -d "$root" ] || continue

  # commands: <root>/commands/*.md (and nested for marketplaces)
  while IFS= read -r f; do
    base="$(basename "$f" .md)"
    printf '%s\t%s\n' "$base" "$f" >> "$tmp"
  done < <(fd -t f -H -L -e md . "$root" 2>/dev/null \
             | grep -E '/commands/[^/]+\.md$' || true)

  # skills: <root>/skills/<name>/SKILL.md (and nested for marketplaces)
  while IFS= read -r f; do
    dir="$(dirname "$f")"
    base="$(basename "$dir")"
    printf '%s\t%s\n' "$base" "$f" >> "$tmp"
  done < <(fd -t f -H -L 'SKILL\.md$' "$root" 2>/dev/null \
             | grep -E '/skills/[^/]+/SKILL\.md$' || true)
done

# Build JSON. Later entries override earlier ones (precedence above).
awk -F'\t' '
  { map[$1] = $2 }
  END {
    printf "{"
    first = 1
    for (k in map) {
      if (!first) printf ","
      first = 0
      gsub(/\\/, "\\\\", map[k]); gsub(/"/, "\\\"", map[k])
      gsub(/\\/, "\\\\", k);      gsub(/"/, "\\\"", k)
      printf "\n  \"%s\": \"%s\"", k, map[k]
    }
    printf "\n}\n"
  }
' "$tmp"
