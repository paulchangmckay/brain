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

---

## Key Learnings (2026-06-26)

- 2026-06-26: understand-anything incremental updates require PROJECT_ROOT to be a git repo with a HEAD commit. Without one, every run is a full 32-batch rebuild. Once `git init` + baseline commit + `meta.json` patched with real hash, future runs use `git diff <hash>..HEAD` and re-analyze only changed files (1-5 batches typical).
- 2026-06-26: `meta.json` must be explicitly patched with the real commit hash after `git init` — the hash written during analysis is `null` (no repo existed). Run `node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync('.understand-anything/meta.json','utf8'));m.gitCommitHash=$(git rev-parse HEAD);fs.writeFileSync(...)"` immediately after first commit.
- 2026-06-26: `~/.claude` default scan picked up 1,071 files (725 in `plugins/` alone — 3rd-party cache). Must add `plugins/`, `projects/`, `sessions/`, `cache/`, `state/` etc. to `.understandignore` before first scan or results are dominated by ephemeral content.
- 2026-06-26: Large esbuild bundles (8,000–9,100 line JS files in `langsmith-plugin/bundle/`) must be treated as opaque `file` nodes by file-analyzer agents — no tree-sitter extraction. Attempting to extract caused batches 29/30 to hit context limits and fail.
- 2026-06-26: Architecture-analyzer and file-analyzer can disagree on node type prefixes. CI workflow files may be assigned `config:` by the architecture layer but `pipeline:` by file-analyzer. Always run inline validation (ua-inline-validate.cjs) after assembling layers and patch mismatches before saving.

## Do-Not-Repeat (2026-06-26)

- 2026-06-26: Do NOT run understand-anything on `~/.claude` without first auditing `.understandignore` — plugins/ alone contains 725 cached 3rd-party files. Scope exclusions first or the scan is 4× larger than necessary.
- 2026-06-26: Do NOT leave `meta.json` with a null `gitCommitHash` after setting up git — understand-anything will fall back to a full rebuild prompt instead of incrementally diffing. Patch the hash immediately after the first commit.

## Decision Log (2026-06-26)

- 2026-06-26: Registered `langsmith-plugin` and `superpowers` as git submodules (pointing to `langchain-ai/langsmith-claude-code-plugins` and `obra/Superpowers`) rather than gitignoring them. Rationale: submodule pointer commits appear in parent `git diff`, so understand-anything detects when those dirs change and re-analyzes them incrementally.
- 2026-06-26: Custom skills must be directories (`~/.claude/skills/<name>/SKILL.md`), not flat `.md` files. Symlinks to superpowers follow this same pattern — they point to directories, not files. Standalone `.md` files in `skills/` are silently ignored by the skill registry.
- 2026-06-26: To expose an agent-scoped skillset globally without duplicating routing logic, create a thin orchestrator skill (`~/.claude/skills/ba/SKILL.md`) that reads the agent's CLAUDE.md and resolves relative skill paths from the agent directory.

## Do-Not-Repeat (2026-06-26 continued)

- 2026-06-26: Do NOT create skills as standalone `.md` files in `~/.claude/skills/` — the skill registry silently ignores them. Correct structure: `~/.claude/skills/<name>/SKILL.md` (a directory, not a file).

## Key Learnings (2026-06-26, session 2)

- 2026-06-26: `installed_plugins.json` key format is `plugin@marketplace` (e.g. `ba-agent@claude-plugins-official`). This is the OPPOSITE of the `settings.json` `enabledPlugins` format which is `marketplace@plugin` (e.g. `claude-plugins-official@ba-agent`). The two systems use reversed key conventions.
- 2026-06-26: Claude Code 2.1.186 supports only `git-subdir` and `"./"` source types in marketplace.json. The `local` source type is rejected with "source type not supported". Missing source is also rejected. Plugin loader validates the source type BEFORE checking installPath — valid files at installPath do not bypass a bad source.
- 2026-06-26: `claude plugins init <name> --with agents` scaffolds a plugin into `~/.claude/skills/<name>/` that auto-loads as `<name>@skills-dir` without any marketplace registration or install step. This is the correct path for custom local plugins that aren't in an upstream git repo.
- 2026-06-26: YAML frontmatter `description:` values containing `: ` (colon-space, e.g. `"full BA package: Mermaid..."`) must be double-quoted. Unquoted colon-space is parsed as a nested key-value and causes a YAML parse error that silently drops all frontmatter at runtime.

## Do-Not-Repeat (2026-06-26, session 2)

- 2026-06-26: Do NOT manually add entries to `installed_plugins.json` for a plugin that lacks a valid supported source type in its marketplace.json entry. The loader checks source type before using installPath. Use `plugins init` → skills-dir for local plugins instead.
- 2026-06-26: Do NOT write unquoted colon-space sequences in YAML agent frontmatter `description:` fields. Always quote the entire value when it contains `: `.

## Decision Log (2026-06-26, session 2)

- 2026-06-26: Moved ba-agent from `ba-agent@claude-plugins-official` (broken marketplace entry) to `ba-agent@skills-dir` (via `claude plugins init --with agents`). Rationale: skills-dir bypasses the entire marketplace/install/cache/source-type chain; simpler and more robust for a local plugin with no upstream git repo.
- 2026-06-26: Removed `ba-agent@claude-plugins-official` entry from `installed_plugins.json` and disabled the marketplace enabledPlugins key. Rationale: naming conflict with the working skills-dir version would have suppressed it at load time.

## User Preferences (2026-06-27)

- 2026-06-27: Prefers using Anthropic document-skills plugins (`document-skills:pdf`, `:docx`, `:pptx`, `:xlsx`) over calling the underlying libraries (reportlab, docx npm, openpyxl) directly via Bash — use the skill, not the raw library.

## Key Learnings (2026-06-27)

- 2026-06-27: When EnterWorktree creates an isolated branch, edits made via **absolute paths** (e.g., `/Users/paulmckay/.claude/Agents/...`) write to the MAIN working tree, not the worktree. The worktree branch stays clean while changes land on main. To actually isolate work in the feature branch, use relative paths from the worktree directory or `cd <worktree-path>` before editing.
- 2026-06-27: `ba-agent:ba` sub-agent tools are `Bash/Read/Write/WebFetch/TodoWrite` only — it cannot invoke the Skill tool. Any Anthropic plugin skills (`document-skills:*`) must be called at the **parent SKILL.md wrapper level**, not inside the sub-agent.

## Decision Log (2026-06-27)

- 2026-06-27: BA agent enhancement split document work across two levels: Phase 4 (PPTX/DOCX/XLSX/PDF) invoked at `SKILL.md` parent wrapper via Skill tool; Phase 5 (3P updates, FAQs) co-authored interactively inside the sub-agent. This avoids needing Skill tool access inside the sub-agent while keeping the dialogue-driven co-authoring where the BA context is hot.

## Key Learnings (2026-06-27, session 2)

- 2026-06-27: A `skills-dir` skill (SKILL.md) appears immediately in the system-reminder skill list on the SAME TURN it is written — no restart, no register step, no cache flush required. The harness rescans `~/.claude/skills/` on every turn.
- 2026-06-27: For "consulting gate" patterns (read reference doc → output specs → proceed), a Skill is the right primitive over a subagent. Skills stay in the main context window so the looked-up specs are immediately available to the next action; subagents spin up isolated sessions and require hand-off overhead.
- 2026-06-27: Brand skill architecture: source of truth at `~/.claude/brand/brand-guide.md` (structured by output type), gate skill at `~/.claude/skills/brand/SKILL.md`, memory entry in `~/.claude/projects/-Users-paulmckay/memory/user-brand-guide.md`. Brand gate is in CLAUDE.md Process Layer as first row — fires before brainstorming.

## User Preferences (2026-06-27, session 2)

- 2026-06-27: Paul has a defined personal brand (Brand Style Guide v3 — PDF at `/Users/paulmckay/Desktop/personal-brand/`). Every output he creates must be within that brand context. The `/brand` skill and brand-guide.md capture the full system.

## Decision Log (2026-06-27, session 2)

- 2026-06-27: Chose brand SKILL over brand subagent. Rationale: brand lookup is structured reference, not autonomous multi-step work — a skill stays in-context so specs are immediately usable; a subagent adds isolation + session-spinup overhead with no benefit for a ~2k-token reference lookup.
- 2026-06-27: Placed brand gate as the FIRST row in the CLAUDE.md Process Layer table — before brainstorming. Rationale: brand context must be set before any creative or design decision, not after. An output that starts wrong on brand will need rework regardless of how good the brainstorm was.

## Key Learnings (2026-06-27, session 3)

- 2026-06-27: **Single-source-of-truth principle for brand**: Any file that duplicates values from `brand-guide.md` (hex codes, font sizes, weights) — even as a "helpful reminder" — creates a second source of truth that will drift. The only safe pattern is: read the file dynamically at runtime via the brand skill, output a Brand Spec Card, and have all downstream briefs reference the card. No inline duplication.
- 2026-06-27: **Brand/structure separation pattern in document briefs**: Split brief rules into two categories — (1) brand values (colors, fonts, sizes) → say "Apply Brand Spec Card exactly", never hardcode; (2) format-structural constraints (slide count, DXA widths, `No \n in paragraphs`) → live in the skill file, unrelated to brand, safe to hardcode. This separation makes briefs resilient to brand changes.
- 2026-06-27: Sub-agent brand enforcement architecture: (1) brand voice → `~/.claude/Agents/ba-agent/CLAUDE.md` (sub-agent reads it); (2) brand visual specs → brand gate in parent `~/.claude/skills/ba-agent/SKILL.md` (brand skill can't be invoked in sub-agent). Never try to invoke brand skill from inside a sub-agent.

## Do-Not-Repeat (2026-06-27, session 3)

- 2026-06-27: Do NOT hardcode brand values (hex codes, font names, sizes) in any file other than `~/.claude/brand/brand-guide.md`. Even in document briefs where it feels like a "helpful reminder," it creates drift the moment brand-guide.md is updated. Always reference the Brand Spec Card dynamically.

## Decision Log (2026-06-27, session 3)

- 2026-06-27: Wired brand into ba-agent at the **parent SKILL.md level** (not inside the sub-agent). Rationale: sub-agents can't invoke the Skill tool — they're limited to Bash/Read/Write/WebFetch/TodoWrite. Brand visual specs belong at the parent level; brand voice belongs in the agent's CLAUDE.md.
- 2026-06-27: Removed hardcoded brand values from ba-agent/SKILL.md immediately after adding them (same session). Recognised the drift risk: "Apply Brand Spec Card" + brand bullet points = two sources of truth. Fix: keep only the "Apply Brand Spec Card" instruction + format-structural rules that are not brand values.
