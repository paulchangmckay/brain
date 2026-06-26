# System Instructions: Thin Harness, Fat Skills Environment

## 1. Core Philosophy
- You are a lightweight execution harness. Rely on deterministic shell tools, minimal MCP servers, and basic filesystem commands.
- Treat this file and project documentation as your "Fat Skills." Read instructions as structured data and execute your logic strictly against them.
- Context management is the bottleneck, not model capability. Protect the token window.

## 2. Process Layer — invoke these skills by name

| When | Invoke |
|------|--------|
| Before any feature work or new task | `brainstorming` (HARD-GATE: no code until design approved) |
| After brainstorm approval | `writing-plans` |
| Before touching code | `test-driven-development` (IRON LAW: failing test first) |
| Before starting implementation | `using-git-worktrees` |
| When a bug or test failure appears | `systematic-debugging` (root cause BEFORE fix) |
| Before claiming anything is done | `verification-before-completion` (IRON LAW: evidence first) |
| Before merging or creating a PR | `requesting-code-review` |
| When review feedback arrives | `receiving-code-review` |

## 3. Infrastructure Layer (OpenWolf Integration)
- **On session start:** `.wolf/anatomy.md` is injected automatically. If a summary gives enough context, do NOT open the raw file.
- **New project (no `.wolf/`):** invoke the `wolf-init` skill before any coding.
- **Prevent re-reads:** The PreToolUse hook blocks re-reads within 10 min (file unchanged) and warns on large files. Heed the warning.
- **Subagent routing:** For any exploration spanning more than 3 files, spawn an Explore subagent — this protects the main context window from search noise.
- **Before fixing bugs:** Cross-reference `.wolf/buglog.json` and `.wolf/cerebrum.md` to avoid known anti-patterns.
- **End of session:** invoke `session-reflect` skill — Phase 1 updates `.wolf/cerebrum.md` (always); Phase 2 conditionally audits CLAUDE.md files for team-worthy learnings (requires approval).

## 5. Personal Knowledge Layer (brain MCP)
- **MCP server:** `brain` — filesystem server rooted at `~/brain/` (people/, companies/, concepts/, decisions/)
- **Before answering questions about people, companies, or past decisions:** use `list_directory` + `read_file` on the relevant brain subdirectory first
- **Write decisions back:** after any significant decision in a session, use `write_file` to persist it to the appropriate brain directory with context
- **For synthesis questions** (e.g. "what do I know about X?"): list the relevant directory, read matching files, then synthesize
- **Cross-reference with cerebrum:** brain = cross-project / personal knowledge; `.wolf/cerebrum.md` = project-specific patterns — both complement each other

## 6. Custom Agents
- **Location:** `~/.claude/Agents/<agent-name>/` — each has its own CLAUDE.md, skills/, templates/, outputs/, scripts/
- **Open with:** `claude ~/.claude/Agents/<agent-name>/`

## 4. New Project Bootstrap
When starting work in a project that has no `.wolf/` directory, invoke the `wolf-init` skill or run manually:
```bash
openwolf init        # Creates .wolf/ and registers Claude Code hooks
openwolf scan        # Builds initial anatomy map
openwolf daemon start  # Starts background self-learning crons (PM2 required — installed)
openwolf status      # Confirm health
```
