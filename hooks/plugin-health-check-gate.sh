#!/usr/bin/env bash
# Runs plugin-health-check.js at most once per 24h, gated by a timestamp
# file, since openwolf's daemon cron only supports 4 built-in action types
# (scan_project/consolidate_memory/generate_token_report/ai_task) — a custom
# script action isn't available (confirmed via `openwolf cron --help`), so
# this SessionStart hook stands in for the originally-planned daily cron
# entry. See CLAUDE.md §3 "Plugin registration has no monitoring".
set -euo pipefail

CLAUDE_HOME="${CLAUDE_PROJECT_DIR:-$HOME/.claude}"
GATE_FILE="$CLAUDE_HOME/.wolf/_plugin-health-check-last-run"
NOW=$(date +%s)

if [ -f "$GATE_FILE" ]; then
  LAST=$(cat "$GATE_FILE")
  ELAPSED=$(( NOW - LAST ))
  if [ "$ELAPSED" -lt 86400 ]; then
    exit 0
  fi
fi

mkdir -p "$CLAUDE_HOME/.wolf"
echo "$NOW" > "$GATE_FILE"
node "$CLAUDE_HOME/scripts/plugin-health-check.js" "$CLAUDE_HOME" || true
