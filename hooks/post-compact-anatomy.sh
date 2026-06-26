#!/usr/bin/env bash
# PostCompact hook: re-injects OpenWolf anatomy after context compaction.
# Anatomy injected at SessionStart is lost after compaction — this restores it.

set -euo pipefail

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

GLOBAL_ANATOMY_FILE="$HOME/.claude/.wolf/anatomy.md"
global_anatomy_context=""
if [ -f "$GLOBAL_ANATOMY_FILE" ]; then
    global_anatomy_raw=$(cat "$GLOBAL_ANATOMY_FILE" 2>/dev/null || echo "")
    if [ -n "$global_anatomy_raw" ]; then
        global_escaped=$(escape_for_json "$global_anatomy_raw")
        global_anatomy_context="\n\n<GLOBAL_CLAUDE_ANATOMY>\nContext was compacted — anatomy re-injected. This is the map of your ~/.claude config directory:\n\n${global_escaped}\n</GLOBAL_CLAUDE_ANATOMY>"
    fi
fi

ANATOMY_FILE="${CLAUDE_CWD:-.}/.wolf/anatomy.md"
anatomy_context=""
if [ -f "$ANATOMY_FILE" ]; then
    anatomy_raw=$(cat "$ANATOMY_FILE" 2>/dev/null || echo "")
    if [ -n "$anatomy_raw" ]; then
        anatomy_escaped=$(escape_for_json "$anatomy_raw")
        anatomy_context="\n\n<PROJECT_ANATOMY>\nContext was compacted — project anatomy re-injected from .wolf/anatomy.md:\n\n${anatomy_escaped}\n\nCross-reference .wolf/buglog.json before fixing bugs. Update .wolf/cerebrum.md with new learnings at session end.\n</PROJECT_ANATOMY>"
    fi
fi

combined_context="${global_anatomy_context}${anatomy_context}"

if [ -n "$combined_context" ]; then
    printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "PostCompact",\n    "additionalContext": "%s"\n  }\n}\n' "$combined_context"
fi

exit 0
