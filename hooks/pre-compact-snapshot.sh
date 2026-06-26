#!/usr/bin/env bash
# PreCompact hook: stamps a compaction event in .wolf/cerebrum.md and reminds
# Claude to preserve key session findings before context is wiped.

set -euo pipefail

CEREBRUM="${CLAUDE_CWD:-.}/.wolf/cerebrum.md"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

if [ -f "$CEREBRUM" ]; then
    printf '\n\n---\n## Compaction event: %s\nContext window was compacted here. Review the session and capture any key findings, decisions, or patterns that should persist.\n' "$TIMESTAMP" >> "$CEREBRUM"
fi

printf '{"hookSpecificOutput":{"hookEventName":"PreCompact","additionalContext":"[OpenWolf] Context about to compact. Before continuing: write any key findings, bug discoveries, or architectural decisions from this session to .wolf/cerebrum.md so they survive the compact."}}\n'

# BA Agent session log — write summary to ~/brain/ba-sessions/ if a session is in progress
BA_CONTEXT="$HOME/.claude/Agents/ba-agent/outputs/context.json"
if [ -f "$BA_CONTEXT" ]; then
  PROCESS=$(python3 -c "import json; d=json.load(open('$BA_CONTEXT')); print(d.get('process_name','unknown'))" 2>/dev/null || echo "unknown")
  ARTIFACTS=$(ls "$HOME/.claude/Agents/ba-agent/outputs/" 2>/dev/null | grep -v -E '\.gitkeep|context\.json|observe-log' | tr '\n' ' ')
  GAPS=$(python3 -c "import json; d=json.load(open('$BA_CONTEXT')); print(', '.join(d.get('tool_gaps',[])) or 'none')" 2>/dev/null || echo "unknown")
  BA_LOG_DIR="$HOME/brain/ba-sessions"
  mkdir -p "$BA_LOG_DIR"
  SLUG=$(echo "$PROCESS" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')
  LOG_FILE="$BA_LOG_DIR/$(echo "$TIMESTAMP" | cut -c1-10)-${SLUG}.md"
  cat > "$LOG_FILE" <<BAEOF
## BA Agent session — $TIMESTAMP
- Process documented: $PROCESS
- Artifacts produced: $ARTIFACTS
- Gaps noted: $GAPS
BAEOF
fi

exit 0
