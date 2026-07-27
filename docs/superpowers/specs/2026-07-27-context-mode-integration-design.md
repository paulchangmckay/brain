# context-mode Integration — Design

## Context

`mksglu/context-mode` (github.com/mksglu/context-mode, npm package `context-mode`, Elastic License 2.0) is a third-party MCP server that sandboxes large tool output — code execution, web fetches, file reads — behind a local SQLite FTS5 index, so only a summary or `stdout` enters the model's context instead of the raw payload. The user surfaced it and asked what, if anything, is worth adopting into this `~/.claude` thin-harness/fat-skills environment.

Research (two parallel Explore-agent audits, one of the existing `~/.claude` hook/MCP inventory, one of the context-mode source on GitHub) established:

- **OpenWolf already covers session-continuity.** Two PreCompact hooks (`hooks/pre-compact-snapshot.sh`, `hooks/post-compact-observation.js`), PostCompact anatomy re-injection, a weekly `cerebrum-reflection` cron, and a daily `memory-consolidation` cron already do what context-mode's PreCompact/SessionStart snapshot-and-restore loop does. Installing context-mode's full plugin would run a second, independent PreCompact hook doing overlapping work — wasted effort, not breakage (PreCompact hooks only read/snapshot; they don't rewrite tool input, so no clobbering there).
- **context-mode has no re-read dedup cache.** Its README's "TTL Cache" claim is scoped to `ctx_fetch_and_index` URL caching only, not a general re-read guard — OpenWolf's `hooks/pre-read-check.js` (mtime-based, 10-minute window) is a different, already-covered mechanism.
- **The genuine gap is output sandboxing.** Nothing in the current setup keeps a large `Bash`/`WebFetch`/`Read` payload out of context the way `ctx_execute`/`ctx_fetch_and_index`/`ctx_search` do. `hooks/post-bash-truncate.js` only warns past 15KB; it doesn't contain the data.
- **The plugin is all-or-nothing.** `hooks/hooks.json` is a fixed manifest (PreToolUse on Bash/WebFetch/Read/Grep/Agent/mcp__*, PostToolUse, PreCompact, SessionStart, Stop, UserPromptSubmit) with no env var or config flag to disable individual entries — confirmed by reading `hooks.json` and grepping `precompact.mjs`/`session-helpers.mjs` for feature-flag checks. Installing "as a plugin" means taking the whole hook surface, including the redundant PreCompact/SessionStart layer and PreToolUse hard-enforcement (hard-blocks `WebFetch`, rewrites `Bash` curl/wget calls) that runs in parallel with OpenWolf's own PreToolUse hooks on the same events — an ordering hazard where two hooks' input rewrites on the same call could clobber each other.
- **A standalone (non-plugin) install is viable.** `start.mjs` self-resolves its path via `import.meta.url` and doesn't require `CLAUDE_PLUGIN_ROOT` to run — confirmed by reading the file. The npm package (`npm view context-mode` confirms it's published, v1.0.169, matches the GitHub source) can be installed globally and its MCP server registered directly via `claude mcp add`, without ever going through the plugin loader that reads `hooks.json`. `scripts/postinstall.mjs`'s plugin-healing logic (`heal-installed-plugins.mjs`) is confirmed to no-op ("skipped: no-entry") unless a plugin-marketplace entry already exists, so a plain `npm install -g` does not silently self-register as a plugin.

Anti-goals: no `hooks.json` load, no PreCompact/SessionStart/Stop hooks from context-mode, no reliance on its `ctx_upgrade`/`ctx_doctor` meta-tools (both assume plugin mode), no duplication of OpenWolf's existing compaction/memory system. If the no-hooks approach later proves insufficient (i.e. Claude doesn't reach for the tools often enough without enforcement), that's a future decision to revisit deliberately — not something to silently expand into a plugin install now.

## Approach

Standalone MCP-only integration, user-scoped, paired with a new lightweight skill for usage guidance (no hook-level enforcement — matches this environment's existing "thin harness, fat skills" pattern of prose-driven gates over heavy automation).

### 1. Installation & registration

```bash
npm install -g context-mode
claude mcp add --scope user context-mode -- node "$(npm root -g)/context-mode/start.mjs"
```

User-scoped (not project-scoped) since the value — containing large exec/fetch/read output — applies across every project, not just this repo.

### 2. Data footprint

State lives at `~/.claude/context-mode/` (SQLite session + content DBs), separate from `.wolf/`. Nothing is written inside the `~/.claude` git repo itself; no `.gitignore` changes needed.

### 3. Guidance mechanism

New skill (working name `context-tools`) documenting when to reach for the sandboxed tools instead of raw equivalents:
- `ctx_fetch_and_index` instead of `WebFetch` for large pages that will be searched/queried rather than read in full.
- `ctx_execute`/`ctx_execute_file` instead of raw `Bash` when a command's output is large and only a summary or subset matters.
- Skip it for small, one-off reads/commands — no benefit, just overhead.

Add one row to CLAUDE.md's Process Layer table pointing to the new skill, following the existing table's pattern (trigger condition → skill name).

### 4. Verification plan

- `claude mcp list` shows `context-mode` connected.
- One `ctx_execute` call and one `ctx_fetch_and_index` call succeed standalone (no plugin loaded).
- `git diff` on `~/.claude/settings.json` shows no changes (hooks array untouched).
- No new entries under `~/.claude/plugins/`.

## Process

Personal-config change to a public repo with branch protection on `main` (per `.claude/rules/portable-repo.md`). Follows the existing documented flow: `github-issue-first` → `using-git-worktrees` → PR → explicit merge approval, same as any other non-trivial change to this repo — not the direct-to-main precedent from the 2026-07-14 token-optimization pass, which predates branch protection going active.
