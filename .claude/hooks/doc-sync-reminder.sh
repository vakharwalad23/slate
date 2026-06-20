#!/bin/sh
# Stop-hook nudge only: never spawns an agent, never blocks. Exit 0 always.
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
status=$(git status --porcelain 2>/dev/null || true)
echo "$status" | grep -Eq '(apps|packages|helpers)/' || exit 0
echo "$status" | grep -Eq 'docs/' && exit 0
echo "[doc-sync] source changed but docs/ untouched — consider running /doc-sync"
exit 0
