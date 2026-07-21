#!/usr/bin/env bash
# Unified SessionStart hook: Superpowers bootstrap + OpenWolf anatomy injection

set -euo pipefail

# Best-effort cleanup of stale per-session grilling-gate state files (>24h old)
find "${CLAUDE_CWD:-.}/.wolf" -maxdepth 1 -name '_skill-gate-*.json' -mmin +1440 -delete 2>/dev/null || true
find "${CLAUDE_CWD:-.}/.wolf" -maxdepth 1 -name '_writecount-*.json' -mmin +1440 -delete 2>/dev/null || true

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

# --- Superpowers bootstrap: minimal pointer (full SKILL.md was 84KB — injecting it burned context) ---
superpowers_context="<EXTREMELY_IMPORTANT>\nYou have superpowers — specialized skills that unlock behaviors beyond your defaults.\n\nMANDATORY: If there is even a 1% chance a skill applies to your task, you MUST invoke it via the Skill tool. This is not optional.\n\nHow to use:\n- Invoke with the Skill tool: { \\\"skill\\\": \\\"<name>\\\" }\n- Available skills are listed in each turn's system-reminder under 'The following skills are available'\n- Never read skill files manually — always use the Skill tool\n- If a skill matches your task, invoke it BEFORE any other response, including clarifying questions\n\nInstruction priority: User instructions (CLAUDE.md/GEMINI.md/AGENTS.md) > Skills > Default behavior.\n</EXTREMELY_IMPORTANT>"

# --- OpenWolf anatomy injection ---
# Always inject global ~/.claude anatomy first
GLOBAL_ANATOMY_FILE="$HOME/.claude/.wolf/anatomy.md"
global_anatomy_context=""
if [ -f "$GLOBAL_ANATOMY_FILE" ]; then
    global_anatomy_raw=$(cat "$GLOBAL_ANATOMY_FILE" 2>/dev/null || echo "")
    if [ -n "$global_anatomy_raw" ]; then
        global_escaped=$(escape_for_json "$global_anatomy_raw")
        global_anatomy_context="\n\n<GLOBAL_CLAUDE_ANATOMY>\nThis is the anatomy of your ~/.claude config directory — superpowers skills, hooks, memory, and settings live here. Use this map to avoid re-scanning these files:\n\n${global_escaped}\n</GLOBAL_CLAUDE_ANATOMY>"
    fi
fi

# Then check for project-level anatomy relative to current working directory
ANATOMY_FILE="${CLAUDE_CWD:-.}/.wolf/anatomy.md"
anatomy_context=""

if [ -f "$ANATOMY_FILE" ]; then
    anatomy_raw=$(cat "$ANATOMY_FILE" 2>/dev/null || echo "")
    if [ -n "$anatomy_raw" ]; then
        anatomy_escaped=$(escape_for_json "$anatomy_raw")
        anatomy_context="\n\n<PROJECT_ANATOMY>\nThis project has OpenWolf active. The following is the current file map from .wolf/anatomy.md — use it to decide which files are worth opening vs. already understood:\n\n${anatomy_escaped}\n\nCross-reference .wolf/buglog.json before fixing any bugs. Update .wolf/cerebrum.md with new learnings at session end.\n</PROJECT_ANATOMY>"
    fi
else
    anatomy_context="\n\n<OPENWOLF_NOTICE>\nNo .wolf/ directory found in this project. Before any coding work, invoke the wolf-init skill to set up OpenWolf token tracking and file memory.\n</OPENWOLF_NOTICE>"
fi

# --- understand-anything staleness check ---
staleness_msg=$(node "$HOME/.claude/hooks/understand-anything-staleness.js" "${CLAUDE_CWD:-.}" 2>/dev/null || true)
staleness_context=""
if [ -n "$staleness_msg" ]; then
    staleness_escaped=$(escape_for_json "$staleness_msg")
    staleness_context="\n\n<UNDERSTAND_ANYTHING_STALENESS>\n${staleness_escaped}\n</UNDERSTAND_ANYTHING_STALENESS>"
fi

combined_context="${superpowers_context}${global_anatomy_context}${anatomy_context}${staleness_context}"

# Output in Claude Code format
printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$combined_context" | cat

exit 0
