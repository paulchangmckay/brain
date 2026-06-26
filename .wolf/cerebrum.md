# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-06-24

## User Preferences

- 2026-06-24: Wants to understand the "why" behind recommendations before implementation — explain rationale first, then act
- 2026-06-24: Prefers ranked/prioritized lists over exhaustive surveys; wants highest-impact items called out clearly
- 2026-06-24: Invests in foundational tooling deliberately — foundational work before feature work is a conscious choice, not a distraction
- 2026-06-25: Consolidate over proliferate — absorb unique value from overlapping tools into existing ones rather than installing both. If two skills cover the same concept, merge, don't add.
- 2026-06-25: Superpowers gate philosophy must be honored — enhance existing gates by adding agent spawning inside them, never by adding competing commands that cover the same phases.
- 2026-06-25: Combined skill design: auto-always for internal/Claude-facing targets (cerebrum), conditional+approval-gated for shared/team targets (CLAUDE.md).
- 2026-06-25: User wants to understand impact on functionality before accepting config changes to background services — explain the separation of concerns clearly before asking for approval.

## Key Learnings

- **Project:** .claude
- 2026-06-24: Superpowers skills use the "pi" plugin format, NOT Claude Code's native plugin format. They live in `~/.claude/superpowers/skills/` but are NOT auto-discovered by the Skill tool. Must be symlinked into `~/.claude/skills/` to be invocable.
- 2026-06-24: `settings.json` does NOT support a top-level `mcpServers` key (schema rejects it). User-level MCP servers go in `~/.claude/mcp_servers.json` as a flat server map (no wrapper key).
- 2026-06-24: `NotificationReceived` is NOT a valid Claude Code hook type. For macOS completion notifications, use `osascript` in the Stop hook with `async: true`.
- 2026-06-24: SessionStart hook `matcher` field should be removed entirely to fire on all trigger types including `resume`. The pattern `startup|clear|compact` silently skips resumed sessions.
- 2026-06-24: `pre-read-check.js` was reading `_session.json` to detect re-reads but never writing to it — dedup warnings never accumulated. Fix: write the read path back to `_session.json` after checking.
- 2026-06-25: `enabledPlugins` key format in settings.json is `"marketplace-name@plugin-name": true` (e.g., `"claude-plugins-official@security-guidance": true`).
- 2026-06-25: security-guidance hooks use `${CLAUDE_PLUGIN_ROOT}` variable — must be manually wired into settings.json with resolved absolute paths when enabling marketplace (non-cached) plugins, as the harness may not resolve this variable for plugins not in the install cache.
- 2026-06-25: Superpowers files in `~/.claude/superpowers/` are third-party — direct edits will be overwritten on package update. The plan file at `~/.claude/plans/why-don-t-i-have-logical-gem.md` documents all diffs for re-application after updates.
- 2026-06-25: Of superpowers/openwolf/gbrain, only gbrain actively checks for upstream updates. Superpowers is a git clone with no auto-pull; openwolf is a global npm package with no polling. Only gbrain's LaunchAgent autopilot pings the package registry each 600s cycle.
- 2026-06-25: gbrain `~/.gbrain/config.json` `self_upgrade.mode` controls version-check behavior only (`"notify"` | `"off"`). Setting `"off"` stops the registry ping but has zero effect on autopilot knowledge processing (embedding, links, timeline, backlinks).

## Do-Not-Repeat

- 2026-06-25: Do NOT build new agents or Claude Code tooling under `~/` — always default to `~/.claude/` so it sits within the user's tracked codebase. User had to correct this mid-session when ba-agent was created at `~/ba-agent/` instead of `~/.claude/Agents/ba-agent/`.
- 2026-06-25: Do NOT skip test/sample files mentioned in a spec document. If a spec includes a test brief or example input, create it as a file in `templates/` during the build — don't assume it will be added separately. User had to ask for it.

## Do-Not-Repeat (pre-existing)

- 2026-06-24: Do NOT add `mcpServers` as a top-level key in `settings.json` — it's not in the schema and will cause a validation error. Use `~/.claude/mcp_servers.json` instead.
- 2026-06-24: Do NOT assume superpowers skills are invocable via `Skill("superpowers:skillname")` — they must first be symlinked (or copied) into `~/.claude/skills/` for Claude Code's skill registry to discover them.
- 2026-06-25: Do NOT install two skills/plugins that cover the same concept — pick one home and consolidate. Audit for overlap before installing anything new.
- 2026-06-25: Do NOT enable security-guidance via `enabledPlugins` without also manually wiring its hooks into settings.json — the `${CLAUDE_PLUGIN_ROOT}` variable in hooks.json won't resolve automatically for marketplace plugins not in the install cache.

## Decision Log

- 2026-06-24: Symlinked superpowers skills into `~/.claude/skills/` rather than copying them. Rationale: symlinks auto-pick-up updates when the superpowers package is updated; copies would drift silently.
- 2026-06-24: Used `osascript` Glass sound in Stop hook for completion notifications instead of trying `NotificationReceived`. Rationale: NotificationReceived is not a documented Claude Code hook type; osascript is reliable and native on macOS.
- 2026-06-25: Absorbed skill-development (plugin-dev) into writing-skills rather than installing both. Rationale: avoid duplicating directory anatomy + progressive disclosure across two loaded skills.
- 2026-06-25: Wired feature-dev agents (code-explorer, code-architect, code-reviewer) into superpowers gates via surgical SKILL.md edits rather than using /feature-dev command. Rationale: /feature-dev duplicates the entire superpowers gate sequence.
- 2026-06-25: Edited superpowers skill files directly (not via copies in ~/.claude/skills/). Accepted update-overwrite risk; plan file documents all diffs for re-application.
- 2026-06-25: Combined session-reflect + revise-claude-md into a single two-phase skill. Phase 1 (cerebrum) auto-always; Phase 2 (CLAUDE.md) conditional + approval-gated. Did NOT install claude-md-management plugin as it would create a competing audit flow.
- 2026-06-25: Set gbrain `self_upgrade.mode: "off"` in `~/.gbrain/config.json`. User wants version frozen to avoid surprise behavior changes; core knowledge processing unaffected.
- 2026-06-25: Created `~/.claude/Agents/` as a dedicated parent folder for custom Claude Code agents (starting with ba-agent). Keeps agents separate from skills and organized for future additions. Pattern: `~/.claude/Agents/<agent-name>/` with its own CLAUDE.md, skills/, templates/, outputs/, scripts/.


---
## Compaction event: 2026-06-26T03:22:37Z
Context window was compacted here. Review the session and capture any key findings, decisions, or patterns that should persist.
