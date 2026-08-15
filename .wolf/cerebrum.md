# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-08-15

## User Preferences

- Wants "why" before implementation — rationale first, then act.
- Prefers ranked/prioritized lists over exhaustive surveys.
- Invests in foundational tooling deliberately — not a distraction from feature work.
- Consolidate over proliferate: merge overlapping tools/skills/gates into existing ones rather than adding competing duplicates. When installing a third-party skill/plugin, wire it into CLAUDE.md's Process Layer table (or a reference skill) so it's actually used, not just copied to disk.
- Combined skill design: auto-always for internal/Claude-facing targets (cerebrum), conditional+approval-gated for shared/team targets (CLAUDE.md).
- Wants impact-on-functionality explained before accepting config changes to background services.
- For multi-part audit/cleanup decisions with clear trade-offs, consistently picks the labeled "Recommended" option (confirmed 4x) — safe to lead with a strong recommendation.
- Prefers Anthropic document-skills plugins (`document-skills:pdf/docx/pptx/xlsx`) over calling underlying libraries directly.
- Has a defined personal brand (Brand Style Guide v3) — every output goes through `/brand`; never hardcode brand values elsewhere.
- Prefers `/ba` flow keep the doc-type prompt (all/pptx/docx+pdf/skip) — values the option to skip to markdown-only.
- Wants print-quality PNGs (≥2300px, `--scale 3`) as default for BA diagram renders — stakeholder-facing.

## Key Learnings

### Project: .claude — Skills, Plugins, Config
- Superpowers skills live in `~/.claude/superpowers/skills/` but must be symlinked into `~/.claude/skills/` to be invocable — root cause of repeated "Unknown skill" errors (bug-195), fixed 2026-07-27.
- New skill/MCP registrations (symlink, `claude plugin install`, `claude mcp add`) and hook/settings.json edits are NOT live until session restart — this applies inside worktrees too (hooks load once from the main checkout at session start). Same-session workaround: Read the skill file directly and follow manually; call the SDK/CLI directly for MCP.
- Plugin enable state lives only in `settings.json`'s `enabledPlugins` (`marketplace@plugin: true`) — a matching entry in `settings.local.json` is silently inert. Always use `claude plugin enable <name>`, and manually wire its hooks (`${CLAUDE_PLUGIN_ROOT}` doesn't auto-resolve for marketplace plugins).
- `settings.json` has no top-level `mcpServers` key (schema rejects it) — use `~/.claude/mcp_servers.json`. Claude Code's auto-mode classifier also blocks direct `Edit` on `settings.json` itself — hand the user the exact snippet or ask for a permission rule instead of retrying.
- `CLAUDE_CWD` referenced in settings.json is never assigned — always resolves to default. Use `CLAUDE_PROJECT_DIR` instead.
- YAML frontmatter `description:` containing `: ` must be quoted or parsing silently fails; custom skills must be directories (`skills/<name>/SKILL.md`) — flat `.md` files are silently ignored.
- `openwolf cron` only supports 4 built-in action types (no custom scripts) — use a lifecycle hook with a timestamp-gate file instead.
- `.wolf/memory.md` is a genuinely shared, live log across concurrent sessions — don't assume entries near your timestamp are yours; verify via `git log`/`gh pr list`.
- Browser automation runs via the `playwright` MCP server (added 2026-07-14, WebFetch doesn't hit localhost). `html-export`'s own Playwright pipeline (ESM/CJS mismatch + missing package) was still broken as of that date — prefer the MCP server for interactive verification.

### Git / Worktree / Submodule Patterns
- Worktree merge pattern: `ExitWorktree` (keep) → push branch → `gh pr create` → explicit user approval → `gh pr merge --squash` → `git pull origin main` (or `git merge origin/main` if local main has unpushed commits) → `git worktree remove --force` → `git branch -d`. `gh pr merge` can fail on branch-protection `strict` checks even when `mergeable: MERGEABLE` — fix is `git merge origin/<base>` into the branch, push, retry. A PR can also be closed without merging — check `gh pr view --json state,mergedAt`, don't trust "opened, CI green" as proof of landing.
- `EnterWorktree` branches from `origin/<default>`, not local main — unpushed local-main commits are invisible in a fresh worktree. Fix: `git rebase main` inside the worktree right after creation (note: squash-merging afterward bundles in every unpushed local-main commit that rode along, not just the branch's own — check `git diff --stat` first if that matters). `EnterWorktree` also always targets the session's primary repo — use plain `git worktree add` for a secondary/additional working directory.
- Absolute-path edits inside a worktree session write to the MAIN working tree, not the worktree — use relative paths or `cd` into the worktree first. `docs/superpowers/plans/` is gitignored — plan files aren't in worktrees; copy manually after `EnterWorktree`. `git worktree remove` needs `--force` even for fully-merged branches.
- Fresh worktrees don't auto-initialize submodules — verify `git -C <submodule> branch --show-current`; `git submodule update --init` first if empty. To move a commit from a worktree's submodule clone to the main clone: branch it in the source clone, `git fetch <path> <branch>` from target, `git branch -f local-customizations FETCH_HEAD` (raw SHA isn't fetchable via local-path fetch — automated by `scripts/submodule-transfer.sh`). Re-fast-forward `local-customizations` after every new submodule commit; third-party submodule `origin` is not the user's fork — never push, use the local backup branch.
- Dispatched subagents can silently escape worktree isolation (absolute paths, or self-modifying settings.json when blocked) — give explicit relative-path instructions + `pwd`/`git branch --show-current` checks before/after every write, and independently re-verify commits from the controller side; never trust a subagent's DONE report alone. Global-install CLIs (e.g. `npx skills add --global`) bypass worktree isolation the same way, writing into the real `~/.claude` regardless of cwd — check `git status` in the main checkout after any such install run from a worktree.
- Stash conflicts on worktree-merge cleanup: capture stash SHA before merging, reapply by exact SHA (never bare `pop`); resolve append-only logs by concatenation, regenerated inventories via `--ours` + rescan.
- `.wolf/buglog.json` specifically (unlike `memory.md`) is an *ID-numbered* append-only log, and its auto-detection hook scans project-wide regardless of which branch/worktree is checked out — two branches merging independently-appended entries produces real ID collisions (both claim the same next sequential `bug-N`), not just interleaving. Plain concatenation reintroduces duplicate IDs; resolve by dedup on a content key (`timestamp+error_message+file`) to find the true union, then confirm one side is a strict superset before keeping it wholesale — verify programmatically (a `require()` + `Set` diff), don't eyeball a multi-hundred-line JSON diff.

### Process / Tooling
- `node --test` needs explicit file paths, not bare directories.
- PreToolUse "did someone else write this" hooks must have their baseline updated by a companion PostToolUse hook, never self-recorded in PreToolUse.
- Any hook-built filesystem path from a harness-supplied identifier (session_id, tool_input fields) needs strict allowlist sanitization before `resolve()`/`join()` — path traversal risk otherwise.
- `pipx`/`pip` can silently backtrack to a very old, crippled package version when an unpinned install's optional extras lack wheels for the current Python — verify actually-installed version, not just exit code. Metadata-only dependency checks (`requires_dist`) don't prove a clean install.

## Do-Not-Repeat

- Do NOT hardcode brand values outside `brand-guide.md`, even as a "helpful reminder."
- Do NOT duplicate protocol enforcement between CLAUDE.md and `.claude/rules/openwolf.md` — single pointer, full rule in the rules file.
- Do NOT run `git checkout main` from inside a worktree — exit first.
- Do NOT modify files under `~/.claude/plugins/cache/` — third-party, overwritten on update; wrap instead.
- Do NOT use `find ~/.claude | sort` as a structure reference with large submodules present — write an annotated tree manually.
- Do NOT pass `"Edit"` to `ExitPlanMode`'s `allowedPrompts` — only `"Bash"` is accepted.
- Do NOT use grep `--exclude-dir=<basename>` to exclude a submodule path repo-wide — matches basename anywhere, silently drops unrelated same-named dirs. Read paths from `.gitmodules`, filter by full-path prefix instead.
- Do NOT chain edits to external-project files without a Read-verify step when OpenWolf hooks are active — hooks can silently revert edits.
- Do NOT trust a `cd` in one parallel Bash call to carry over to a sibling call — each runs its own subshell; prefix each with its own `cd`.
- Do NOT retry `Write` (full-file replace) against a file another live session is actively appending to — use targeted `Edit` scoped to untouched lines instead.
- Do NOT build agents/tooling under `~/` — always under `~/.claude/`.
- Do NOT skip test/sample files mentioned in a spec — create them during the build.

## Decision Log (condensed)

- Symlinked (not copied) superpowers skills into `~/.claude/skills/` for auto-updates.
- Absorbed skill-development into writing-skills rather than installing both.
- Wired senior-engineering-partner as a **reference library only** (not workflow enforcement) — avoids duplicating the brainstorming→TDD→verification gate chain; added Project Tier (0/1/2) table to CLAUDE.md for maturity-scaled rigor.
- Wired lint/secret-scan gate as a tracked local `.githooks/pre-commit` (not CI/husky) — Tier 0, survives cloning, warn-and-skip on missing tools.
- Added `github-issue-first` and `issue-backlog-cycle` as dedicated global skill files, matching existing gate convention.
- Escalated `grilling` from prose-only trigger to a hard `PreToolUse`/`PostToolUse` hook pair blocking `writing-plans` without it — one marker file per (session, skill) pair, not a shared JSON array, to avoid lost-update races.
- Installed all 13 `taste-skill` variants per explicit user request; mitigated conflict risk via an explicit routing table in `claude-infra-reference` rather than declining to install.
- Added `playwright` MCP server for session-driven browser automation, chosen over a committed E2E test suite (ad hoc verification, not CI regression coverage).
- Evaluated memU (NevaMind-AI) for cross-session memory/skill-extraction — declined adoption: its "session log → distilled skill" pipeline already exists here end-to-end (session-reflect Phase 1 flag → Phase 3 review → `github-issue-first` → `writing-skills` → PR, proven by Observation 16 → issue #34 → `verify-sdk-api`), and memU's sole genuinely novel capability (cross-agent memory sharing) doesn't apply since only Claude Code is used, not Codex/Cursor/etc. Its default install flow also ships full session transcripts to a third-party cloud unless self-hosted. Built a narrow addition instead — cross-session recurrence detection feeding the existing pipeline (PR #51) — rather than a parallel memory subsystem.