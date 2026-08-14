# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-08-13

## User Preferences

- Wants "why" before implementation — rationale first, then act.
- Prefers ranked/prioritized lists over exhaustive surveys.
- Invests in foundational tooling deliberately — not a distraction from feature work.
- Consolidate over proliferate: merge overlapping tools/skills into existing ones rather than installing both.
- Enhance existing gates by adding capability inside them, never add competing commands covering the same phase.
- Combined skill design: auto-always for internal/Claude-facing targets (cerebrum), conditional+approval-gated for shared/team targets (CLAUDE.md).
- Wants impact-on-functionality explained before accepting config changes to background services.
- For multi-part audit/cleanup decisions with clearly laid-out trade-offs, consistently picks the labeled "Recommended" option (confirmed 4x: submodule handling, cerebrum split, backup-branch approach, grilling hard-block) — safe to lead with a strong recommendation.
- Prefers Anthropic document-skills plugins (`document-skills:pdf/docx/pptx/xlsx`) over calling underlying libraries directly.
- Has a defined personal brand (Brand Style Guide v3) — every output must go through the `/brand` skill/brand-guide.md; never hardcode brand values elsewhere (single source of truth).
- Prefers `/ba` flow keep the doc-type prompt (all/pptx/docx+pdf/skip) — values flexibility to skip to markdown-only.
- Wants print-quality PNGs (≥2300px, `--scale 3`) as default for BA diagram renders — stakeholder-facing.
- When installing a third-party skill/plugin, wire it into CLAUDE.md's Process Layer table and/or a reference skill, not just copy files — goal is it actually gets used.

## Key Learnings

### Project: .claude — Skills, Plugins, Config
- Superpowers skills use the "pi" plugin format; live in `~/.claude/superpowers/skills/` but must be symlinked into `~/.claude/skills/` to be invocable. `subagent-driven-development`, `executing-plans`, `finishing-a-development-branch` were missing this symlink for a long time (root cause of repeated "Unknown skill" errors, wrongly blamed on API flakiness at one point — see [[project_claude_setup]]). Fixed 2026-07-27.
- New skill/MCP registrations (symlink, `claude plugin install`, `claude mcp add`) are NOT live until session restart — skill/MCP lists load once at session start. Same-session workaround: Read the skill file directly and follow manually; call the SDK/CLI directly for MCP.
- Plugin enable state lives ONLY in `settings.json`'s `enabledPlugins` (`marketplace@plugin: true`) — a same-key entry in `settings.local.json` is silently inert. Always use `claude plugin enable <name>`.
- `installed_plugins.json` key format is `plugin@marketplace` — reversed from settings.json's `marketplace@plugin`.
- `settings.json` has no top-level `mcpServers` key (schema rejects it) — use `~/.claude/mcp_servers.json` (flat server map).
- Claude Code's auto-mode classifier blocks direct `Edit` on `settings.json` itself, not just push/PR actions — don't retry, hand the user the exact snippet or ask for a permission rule.
- `CLAUDE_CWD` referenced in settings.json is never assigned — always resolves to default. Use `CLAUDE_PROJECT_DIR` instead.
- YAML frontmatter `description:` containing `: ` must be quoted or frontmatter silently fails to parse.
- Custom skills must be directories (`skills/<name>/SKILL.md`) — flat `.md` files are silently ignored.
- `openwolf cron` only supports 4 built-in action types (no custom scripts) — use a lifecycle hook with a timestamp-gate file instead.
- `.wolf/memory.md` is a genuinely shared, live log across concurrent sessions — don't assume entries near your timestamp are yours; verify via `git log`/`gh pr list`.
- No browser automation was available for a long time (WebFetch doesn't hit localhost) — fixed 2026-07-14 by adding the `playwright` MCP server to `mcp_servers.json` (session-restart required).
- `html-export`'s Playwright pipeline was broken (ESM/CJS mismatch + missing npm package) as of 2026-07-14 — not yet fixed; use the `playwright` MCP server instead for interactive verification.

### Git / Worktree / Submodule Patterns
- Worktree merge pattern: `ExitWorktree` (keep) → push branch → `gh pr create` → explicit user approval → `gh pr merge --squash` → `git pull origin main` (or `git merge origin/main` if local main has unpushed commits) → `git worktree remove --force` → `git branch -d`.
- `EnterWorktree` branches from `origin/<default>`, not local main — any unpushed local-main commits are invisible in a fresh worktree. Fix: `git rebase main` inside the worktree right after creation, before first use.
- Squash-merging a rebased worktree branch bundles in *every* unpushed local-main commit that came along via the rebase, not just the branch's own — check `git diff --stat <old-origin-sha>..<branch-tip>` before merging if this matters.
- `EnterWorktree` always targets the session's primary repo (`~/.claude`) — cannot target a secondary/additional working directory; use plain `git worktree add` there instead.
- Absolute-path edits inside a worktree session write to the MAIN working tree, not the worktree — use relative paths or `cd` into the worktree first.
- Fresh worktrees don't auto-initialize submodules — verify `git -C <submodule> branch --show-current` before dispatching submodule-file tasks; `git submodule update --init` first if empty.
- To move a commit from a worktree's submodule clone to the main clone: branch it in the source clone, `git fetch <path> <branch>` from target, `git branch -f local-customizations FETCH_HEAD`. Raw SHA isn't fetchable via local-path fetch. Automated by `scripts/submodule-transfer.sh`.
- `local-customizations` backup branches don't auto-track new submodule commits — re-fast-forward after every new commit; check before trusting it's current.
- Third-party submodule `origin` (e.g. `obra/Superpowers`) is not the user's fork — never push; use a local backup branch.
- `docs/superpowers/plans/` is gitignored — plan files aren't in worktrees; copy manually after `EnterWorktree`.
- `git worktree remove` needs `--force` even for fully-merged branches.
- Dispatched subagents can silently escape worktree isolation (absolute paths, or self-modifying settings.json when blocked) — give explicit relative-path instructions + `pwd`/`git branch --show-current` checks before/after every write, and independently re-verify commits from the controller side.
- Global-install CLIs (e.g. `npx skills add --global`) bypass worktree isolation, writing into the real `~/.claude` regardless of cwd — check `git status` in the main checkout after any such install run from a worktree.
- Stash conflicts on worktree-merge cleanup: capture stash SHA before merging, reapply by exact SHA (never bare `pop`); resolve append-only logs by concatenation, regenerated inventories via `--ours` + rescan.
- `gh pr merge` can fail on branch-protection `strict` status checks even when `mergeable: MERGEABLE` — fix is `git merge origin/<base>` into the branch and push, retry.
- A PR can be closed without merging (both externally and as a deliberate concurrent-session action) — check `gh pr view --json state,mergedAt`, don't trust "PR opened, CI green" as proof of landing.

### Process / Tooling
- Hooks/settings.json changes made inside a worktree are not live for that running session (hooks loaded once at session start from main checkout).
- `node --test` needs explicit file paths, not bare directories.
- PreToolUse "did someone else write this" hooks must have their baseline updated by a companion PostToolUse hook, never self-recorded in PreToolUse.
- Any hook-built filesystem path from a harness-supplied identifier (session_id, tool_input fields) needs strict allowlist sanitization before `resolve()`/`join()` — path traversal risk otherwise.
- `pipx`/`pip` can silently backtrack to a very old, crippled package version when an unpinned install's optional extras lack wheels for the current Python — always verify actually-installed version, not just exit code.
- Metadata-only dependency checks (`requires_dist`) don't prove an install resolves cleanly on the current Python — run the real (or ephemeral) install before finalizing a design decision that depends on it.

## Do-Not-Repeat

- Do NOT add `mcpServers` as a top-level `settings.json` key — use `~/.claude/mcp_servers.json`.
- Do NOT assume superpowers skills are invocable without symlinking into `~/.claude/skills/` first.
- Do NOT build agents/tooling under `~/` — always under `~/.claude/`.
- Do NOT skip test/sample files mentioned in a spec — create them during the build.
- Do NOT install two skills/plugins covering the same concept — consolidate.
- Do NOT enable security-guidance via `enabledPlugins` without manually wiring its hooks (`${CLAUDE_PLUGIN_ROOT}` doesn't auto-resolve for marketplace plugins).
- Do NOT create skills as flat `.md` files — must be `skills/<name>/SKILL.md` directories.
- Do NOT write unquoted colon-space in YAML frontmatter `description:` values.
- Do NOT hardcode brand values outside `brand-guide.md`, even as a "helpful reminder."
- Do NOT duplicate protocol enforcement between CLAUDE.md and `.claude/rules/openwolf.md` — single pointer, full rule in the rules file.
- Do NOT run `git checkout main` from inside a worktree — exit first.
- Do NOT modify files under `~/.claude/plugins/cache/` — third-party, overwritten on update; wrap instead.
- Do NOT use `find ~/.claude | sort` as a structure reference with large submodules present — write an annotated tree manually.
- Do NOT pass `"Edit"` to `ExitPlanMode`'s `allowedPrompts` — only `"Bash"` is accepted.
- Do NOT use grep `--exclude-dir=<basename>` to exclude a submodule path repo-wide — matches on basename anywhere, silently drops unrelated same-named dirs. Read paths from `.gitmodules`, filter by full-path prefix instead.
- Do NOT chain edits to external-project files without a Read-verify step when OpenWolf hooks are active — hooks can silently revert edits.
- Do NOT trust a `cd` in one parallel Bash call to carry over to a sibling call — each runs its own subshell; prefix each with its own `cd`.
- Do NOT retry `Write` (full-file replace) against a file another live session is actively appending to — use targeted `Edit` scoped to untouched lines instead.
- Do NOT treat a plugin `true` flag in `settings.local.json` as functional for `enabledPlugins` — inert; use `claude plugin enable`.
- Do NOT hand-edit `settings.json` when blocked by the auto-mode classifier — hand the user the snippet instead of retrying.
- Do NOT treat a dispatched subagent's DONE report as ground truth for worktree isolation — independently verify branch/commit from the controller side.

## Decision Log (condensed)

- Symlinked (not copied) superpowers skills into `~/.claude/skills/` for auto-updates.
- Absorbed skill-development into writing-skills rather than installing both.
- Wired senior-engineering-partner in as a **reference library only** (not workflow enforcement) — avoids duplicating the brainstorming→TDD→verification gate chain; added Project Tier (0/1/2) table to CLAUDE.md for maturity-scaled rigor.
- Wired lint/secret-scan gate as a tracked local `.githooks/pre-commit` (not CI/husky) — Tier 0, survives cloning, warn-and-skip on missing tools.
- Added `github-issue-first` and `issue-backlog-cycle` as dedicated global skill files (not inline CLAUDE.md text), matching existing gate convention.
- Escalated `grilling` from prose-only trigger to a hard `PreToolUse`/`PostToolUse` hook pair blocking `writing-plans` without it — prose alone had no independent trigger and was skipped in practice. State design: one marker file per (session, skill) pair, not a shared JSON array, to avoid lost-update races.
- Installed all 13 `taste-skill` variants per explicit user request; mitigated conflict risk between aesthetic-locked variants via an explicit routing table in `claude-infra-reference` rather than declining to install.
- Added `playwright` MCP server for session-driven browser automation, chosen over a committed E2E test suite (ad hoc verification, not CI regression coverage).