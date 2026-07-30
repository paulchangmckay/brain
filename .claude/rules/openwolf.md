---
description: OpenWolf protocol enforcement — active on all files
globs: **/*
---

- Check .wolf/anatomy.md before reading any project file
- Check .wolf/cerebrum.md Do-Not-Repeat list before generating code
- After writing or editing files, update .wolf/anatomy.md and append to .wolf/memory.md
- In a worktree session, the memory.md append happens automatically via hooks (CLAUDE_PROJECT_DIR always targets the main checkout, not the worktree cwd) — only add a manual entry for descriptive detail the terse auto-log line doesn't capture
- After receiving a user correction, update .wolf/cerebrum.md immediately (Preferences, Learnings, or Do-Not-Repeat)
- LEARN from every interaction: if you discover a convention, user preference, or project pattern, add it to .wolf/cerebrum.md. Low threshold — when in doubt, log it.
- BEFORE fixing any bug or error: read .wolf/buglog.json for known fixes
- AFTER fixing any bug, error, failed test, failed build, or user-reported problem: ALWAYS log to .wolf/buglog.json with error_message, root_cause, fix, and tags
- If you edit a file more than twice in a session, that likely indicates a bug — log it to .wolf/buglog.json
- When the user asks to check/evaluate UI design: run `openwolf designqc` to capture screenshots, then read them from .wolf/designqc-captures/
- When the user asks to change/pick/migrate UI framework: read .wolf/reframe-frameworks.md, ask decision questions, recommend a framework, then execute with the framework's prompt
- When editing files in an additional/external working directory, watch for learnings landing in ~/.claude's cerebrum.md/memory.md instead of that project's own .wolf/ files — split proactively rather than letting cross-project content accumulate
