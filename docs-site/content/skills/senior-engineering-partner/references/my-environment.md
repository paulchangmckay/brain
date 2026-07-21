---
title: "references / my-environment"
---

# My Environment Profile

## Identity & calibration

- **Who you are / role:** Power-user developer building AI tooling, automation, and business analysis systems; primary focus is ~/.claude configuration, skills, and agents
- **Experience level:** Senior — calibrate explanations for engineering depth, not beginner handholding
- **Always know:** This environment runs OpenWolf hooks + LangSmith tracing. Process gates (brainstorm → TDD → worktree → verify) are enforced by CLAUDE.md. Don't suggest skipping them.

## Tech stack

- **Secrets management:** macOS Keychain / environment variables in shell profile — never in settings.json or committed files
- **Version control & CI:** GitHub; Conventional Commits; squash merge preferred
- **Shell:** zsh on macOS (Darwin 24.6.0)
- **Primary languages:** Python, Bash, JavaScript/TypeScript, Google Apps Script
- **Cloud / deploy target:** GCP (Cloud Run primary)
- **AI/ML stack:** Claude API (Anthropic), LangSmith tracing, Claude Code CLI + SDK
- **Productivity:** Google Workspace (Gmail, Calendar, Drive via MCP); Linear for issue tracking
- **MCP servers active:** brain (~/brain/ — people/companies/concepts/decisions), Gmail, Google Calendar, Google Drive, Linear

## Hosts & machine config

- **Primary machine:** macOS (zsh, Darwin 24.6.0)
- **Config sync:** ~/.claude tracked in git (main branch). langsmith-plugin and superpowers are git submodules — never `git add` their contents directly.
- **Logs & runtime state:** .wolf/ directory per project (never committed to ~/.claude main repo)

## House Git / SCM standards

- **Commit style:** Conventional Commits (feat:, fix:, chore:, docs:, refactor:)
- **Merge method:** squash merge on PRs
- **Worktree pattern:** EnterWorktree for feature isolation; ExitWorktree → merge → worktree remove sequence (see CLAUDE.md §3)
- **Submodules:** langsmith-plugin, superpowers, senior-engineering-partner — sync via `git submodule update --remote`

## Reference architecture

This config IS the project. The reference architecture is ~/.claude itself:

- **Harness:** CLAUDE.md (thin, routing only) + .claude/rules/openwolf.md (enforcement)
- **Skills:** ~/.claude/skills/ (git-tracked, invoked via Skill tool)
- **Agents:** ~/.claude/Agents/ (gitignored, edited directly)
- **Memory:** ~/.claude/projects/.../memory/ + .wolf/cerebrum.md per project + ~/brain/ cross-project
- **Hooks:** settings.json (SessionStart, PreToolUse, PostToolUse, PreCompact/PostCompact, Stop)

**Deliberate exceptions to flag, not "fix":**
- Agents/ is intentionally gitignored — sub-agent skill changes go directly to tree
- .wolf/ directories are intentionally not committed to ~/.claude main repo
- superpowers and langsmith-plugin are read-only submodules — do not edit in place
