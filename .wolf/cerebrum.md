# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-08-16

## User Preferences

- Wants "why" before implementation — rationale first, then act.
- Prefers ranked/prioritized lists over exhaustive surveys.
- Invests in foundational tooling deliberately — not a distraction from feature work.
- Consolidate over proliferate: merge overlapping tools/skills/gates into existing ones. When installing a third-party skill/plugin, wire it into CLAUDE.md's Process Layer table so it's actually used.
- Combined skill design: auto-always for internal/Claude-facing targets (cerebrum), conditional+approval-gated for shared/team targets (CLAUDE.md).
- Wants impact-on-functionality explained before accepting config changes to background services.
- For multi-part audit/cleanup decisions with trade-offs, consistently picks the "Recommended" option (confirmed 4x) — safe to lead with a strong recommendation.
- Prefers Anthropic document-skills plugins over calling underlying libraries directly.
- Has a defined personal brand (Brand Style Guide v3) — every output goes through `/brand`; never hardcode brand values elsewhere.
- Prefers `/ba` flow keep the doc-type prompt (all/pptx/docx+pdf/skip).
- Wants print-quality PNGs (≥2300px, `--scale 3`) as default for BA diagram renders.

## Key Learnings

### Project: .claude — Skills, Plugins, Config
- Superpowers skills live in `~/.claude/superpowers/skills/` but must be symlinked into `~/.claude/skills/` to be invocable (bug-195, fixed 2026-07-27). New symlinks, `claude plugin install`/`mcp add`, and hook/settings.json edits are NOT live until session restart, including inside worktrees. Same-session workaround: Read the skill file directly, or call the SDK/CLI directly for MCP.
- Plugin enable state lives only in `settings.json`'s `enabledPlugins` — a matching `settings.local.json` entry is silently inert. Always use `claude plugin enable <name>`.
- `settings.json` has no top-level `mcpServers` key — use `~/.claude/mcp_servers.json`. Auto-mode classifier blocks direct `Edit` on `settings.json` — hand the user the exact snippet instead of retrying.
- `CLAUDE_CWD` is never assigned — always resolves to default. Use `CLAUDE_PROJECT_DIR`.
- YAML frontmatter `description:` containing `: ` must be quoted; custom skills must be directories (`skills/<name>/SKILL.md`) — flat `.md` files are silently ignored.
- `openwolf cron` only supports 4 built-in action types — use a lifecycle hook with a timestamp-gate file for custom scripts.
- `.wolf/memory.md` is a shared, live log across concurrent sessions — verify authorship via `git log`/`gh pr list`, don't assume by timestamp.
- Browser automation: use the `playwright` MCP server (WebFetch doesn't hit localhost), not `html-export`'s own pipeline, for interactive verification.

### Git / Worktree / Submodule Patterns
- Merge pattern: `ExitWorktree` (keep) → push branch → `gh pr create` → explicit user approval → `gh pr merge --squash` → `git pull origin main` (or `git merge origin/main` if local main has unpushed commits) → `git worktree remove --force` → `git branch -d`. `gh pr merge` can fail on branch-protection `strict` checks even when `mergeable: MERGEABLE` — fix via `git merge origin/<base>`, push, retry. Confirm landing with `gh pr view --json state,mergedAt`, not just "CI green."
- Right after `EnterWorktree`: it branches from `origin/<default>`, not local main, so unpushed local-main commits are invisible — `git rebase main` inside the worktree first. Absolute-path edits still write to the MAIN working tree — use relative paths or `cd` in. `docs/superpowers/plans/` is gitignored — copy plan files in manually. `git worktree remove` needs `--force` even for merged branches. `EnterWorktree` only targets the session's primary repo; use plain `git worktree add` for a secondary project.
- Fresh worktrees don't auto-initialize submodules — check `git -C <submodule> branch --show-current`, run `git submodule update --init` if empty. To move a commit from a worktree's submodule clone to main: branch it in the source clone, `git fetch <path> <branch>`, `git branch -f local-customizations FETCH_HEAD` (automated by `scripts/submodule-transfer.sh`). Third-party submodule `origin` isn't the user's fork — never push, use the local backup branch.
- Dispatched subagents (and global-install CLIs like `npx skills add --global`) can silently escape worktree isolation via absolute paths — give explicit relative-path instructions plus `pwd`/`git branch --show-current` checks before/after every write, and independently re-verify commits from the controller side.
- Merge-time conflicts: capture stash SHA before merging, reapply by exact SHA (never bare `pop`); resolve append-only logs by concatenation, regenerated inventories via `--ours` + rescan. `.wolf/buglog.json` ID collisions across branches: dedup on a content key (`timestamp+error_message+file`), confirm one side is a strict superset programmatically.

### Process / Tooling
- `node --test` needs explicit file paths, not bare directories.
- PreToolUse "did someone else write this" hooks need their baseline updated by a companion PostToolUse hook, never self-recorded in PreToolUse.
- Any hook-built filesystem path from a harness-supplied identifier needs strict allowlist sanitization before `resolve()`/`join()` — path traversal risk otherwise.
- `pipx`/`pip` can silently backtrack to a very old package version when an unpinned install's extras lack wheels for the current Python — verify actually-installed version, not just exit code.

## Do-Not-Repeat

- Do NOT hardcode brand values outside `brand-guide.md`, even as a "helpful reminder."
- Do NOT duplicate protocol enforcement between CLAUDE.md and `.claude/rules/openwolf.md` — single pointer, full rule in the rules file.
- Do NOT run `git checkout main` from inside a worktree — exit first.
- Do NOT modify files under `~/.claude/plugins/cache/` — third-party, overwritten on update; wrap instead.
- Do NOT use grep `--exclude-dir=<basename>` to exclude a submodule path repo-wide — matches basename anywhere. Read paths from `.gitmodules`, filter by full-path prefix.
- Do NOT chain edits to external-project files without a Read-verify step when OpenWolf hooks are active — hooks can silently revert edits.
- Do NOT trust a `cd` in one parallel Bash call to carry over to a sibling call — each runs its own subshell.
- Do NOT retry `Write` (full-file replace) against a file another live session is actively appending to — use targeted `Edit` scoped to untouched lines.
- Do NOT build agents/tooling under `~/` — always under `~/.claude/`.
- Do NOT skip test/sample files mentioned in a spec — create them during the build.
- Do NOT use `$CLAUDE_PROJECT_DIR` to resolve a script's own path inside a hook registered in `~/.claude/settings.json` — that config is user-scope and the hook fires for every project's sessions, not just `~/.claude`'s. `CLAUDE_PROJECT_DIR` resolves to whatever project is currently active, breaking the hook everywhere else. Use `$HOME/.claude/...` (settings.json command) and resolve any sibling paths from `CLAUDE_CONFIG_DIR`/`os.homedir()` inside the script instead — matches existing precedent in `hooks/session-start.sh`. Caught by a final-review subagent on the adhd-caveman hook (PR toward issue #56), not by planning or task review.

## Decision Log (condensed)

- Symlinked (not copied) superpowers skills into `~/.claude/skills/` for auto-updates.
- Absorbed skill-development into writing-skills rather than installing both.
- Wired senior-engineering-partner as a **reference library only**; added Project Tier (0/1/2) table to CLAUDE.md for maturity-scaled rigor.
- Wired lint/secret-scan gate as a tracked local `.githooks/pre-commit` — Tier 0, survives cloning, warn-and-skip on missing tools.
- Added `github-issue-first` and `issue-backlog-cycle` as dedicated global skill files.
- Escalated `grilling` to a hard `PreToolUse`/`PostToolUse` hook pair blocking `writing-plans` without it.
- Installed all 13 `taste-skill` variants per explicit user request; mitigated conflict risk via a routing table in `claude-infra-reference`.
- Added `playwright` MCP server for session-driven browser automation over a committed E2E suite.
- Evaluated memU for cross-session memory/skill-extraction — declined: existing session-reflect → github-issue-first → writing-skills → PR pipeline covers it; built a narrower cross-session recurrence-detection addition instead (PR #51).
