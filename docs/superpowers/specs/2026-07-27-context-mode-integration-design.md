# context-mode Integration — Design

## Context

`mksglu/context-mode` (github.com/mksglu/context-mode, npm package `context-mode`, Elastic License 2.0) is a third-party MCP server that sandboxes large tool output — code execution, web fetches, file reads — behind a local SQLite FTS5 index, so only a summary or `stdout` enters the model's context instead of the raw payload. The user surfaced it and asked what, if anything, is worth adopting into this `~/.claude` thin-harness/fat-skills environment.

Research (two parallel Explore-agent audits, one of the existing `~/.claude` hook/MCP inventory, one of the context-mode source on GitHub) established:

- **OpenWolf already covers session-continuity.** Two PreCompact hooks (`hooks/pre-compact-snapshot.sh`, `hooks/post-compact-observation.js`), PostCompact anatomy re-injection, a weekly `cerebrum-reflection` cron, and a daily `memory-consolidation` cron already do what context-mode's PreCompact/SessionStart snapshot-and-restore loop does. Installing context-mode's full plugin would run a second, independent PreCompact hook doing overlapping work — wasted effort, not breakage (PreCompact hooks only read/snapshot; they don't rewrite tool input, so no clobbering there).
- **context-mode has no re-read dedup cache.** Its README's "TTL Cache" claim is scoped to `ctx_fetch_and_index` URL caching only, not a general re-read guard — OpenWolf's `hooks/pre-read-check.js` (mtime-based, 10-minute window) is a different, already-covered mechanism.
- **The genuine gap is output sandboxing.** Nothing in the current setup keeps a large `Bash`/`WebFetch`/`Read` payload out of context the way `ctx_execute`/`ctx_fetch_and_index`/`ctx_search` do. `hooks/post-bash-truncate.js` only warns past 15KB; it doesn't contain the data.
- **The plugin is all-or-nothing.** `hooks/hooks.json` is a fixed manifest (PreToolUse on Bash/WebFetch/Read/Grep/Agent/mcp__*, PostToolUse, PreCompact, SessionStart, Stop, UserPromptSubmit) with no env var or config flag to disable individual entries — confirmed by reading `hooks.json` and grepping `precompact.mjs`/`session-helpers.mjs` for feature-flag checks. Installing "as a plugin" means taking the whole hook surface, including the redundant PreCompact/SessionStart layer and PreToolUse hard-enforcement (hard-blocks `WebFetch`, rewrites `Bash` curl/wget calls) that runs in parallel with OpenWolf's own PreToolUse hooks on the same events — an ordering hazard where two hooks' input rewrites on the same call could clobber each other.
- **A standalone (non-plugin) install is viable.** `start.mjs` self-resolves its path via `import.meta.url` and doesn't require `CLAUDE_PLUGIN_ROOT` to run — confirmed by reading the file. The npm package (`npm view context-mode` confirms it's published, v1.0.169, matches the GitHub source) can be installed globally and its MCP server registered directly via `claude mcp add`, without ever going through the plugin loader that reads `hooks.json`. `scripts/postinstall.mjs`'s plugin-healing logic (`heal-installed-plugins.mjs`) is confirmed to no-op ("skipped: no-entry") unless a plugin-marketplace entry already exists, so a plain `npm install -g` does not silently self-register as a plugin.

Anti-goals: no `hooks.json` load, no PreCompact/Stop hooks from context-mode, no reliance on its `ctx_upgrade`/`ctx_doctor` meta-tools (both assume plugin mode), no duplication of OpenWolf's existing compaction/memory system. If the no-hooks approach later proves insufficient (i.e. Claude doesn't reach for the tools often enough without enforcement), that's a future decision to revisit deliberately — not something to silently expand into a plugin install now.

**One documented exception (found during grilling):** `start.mjs` itself — run under either install path, plugin or standalone — unconditionally deploys a self-heal script to `~/.claude/hooks/context-mode-cache-heal.mjs` and registers it as a `SessionStart` hook in `~/.claude/settings.json` on first boot, with no env/config gate to suppress it (confirmed by reading `start.mjs`'s "Self-heal Layer 4" section directly). The deployed script looks up `installed_plugins.json` for a `context-mode@context-mode` plugin entry and `process.exit(0)`s immediately if absent — which it will be, under a standalone npm install — so in practice this becomes one inert SessionStart hook that no-ops every session. Accepted as a documented exception rather than a blocker; forking `start.mjs` to strip it isn't worth maintaining against a fast-moving upstream (v1.0.169 as of this writing) to close a purely cosmetic gap.

## Approach

Standalone MCP-only integration, user-scoped, paired with a new lightweight skill for usage guidance (no hook-level enforcement — matches this environment's existing "thin harness, fat skills" pattern of prose-driven gates over heavy automation).

### 1. Installation & registration

```bash
npm install -g context-mode@1.0.169
claude mcp add -s user context-mode -- node "$(npm root -g)/context-mode/start.mjs"
```

Version pinned rather than always-latest: this is a young, fast-moving package (the source history shows frequent bug-fix churn, including a Linux SIGSEGV class and stale-path corruption bugs), so future upgrades should be a deliberate re-pin-and-reverify action, not an implicit `npm update -g`.

User-scoped (`-s user`, confirmed via `claude mcp add --help` — scope values are `local`/`user`/`project`, default `local`) — not project-scoped, since the value (containing large exec/fetch/read output) applies across every project, not just this repo. Matches how the existing `gbrain`/`playwright`/`pinecone` servers are already registered.

### 2. Data footprint

State lives at `~/.claude/context-mode/` (SQLite session + content DBs), separate from `.wolf/`. Nothing is written inside the `~/.claude` git repo itself; no `.gitignore` changes needed.

### 3. Guidance mechanism

New skill (working name `context-tools`) documenting when to reach for the sandboxed tools instead of raw equivalents:
- `ctx_fetch_and_index` instead of `WebFetch` for large pages that will be searched/queried rather than read in full.
- `ctx_execute`/`ctx_execute_file` instead of raw `Bash` when a command's output is large and only a summary or subset matters.
- Skip it for small, one-off reads/commands — no benefit, just overhead.

Add one row to CLAUDE.md's Process Layer table pointing to the new skill, following the existing table's pattern (trigger condition → skill name).

### 4. Verification plan

Split across two points in time, since MCP tool registration isn't live mid-session (per this repo's own documented rule that skill/MCP registration only takes effect starting the *next* Claude Code session):

**Immediately after install (this session):**
- `claude mcp list` shows `context-mode` connected.
- No new entries under `~/.claude/plugins/`.
- `git status` on `~/.claude/settings.json` — expected to show the Q1 self-heal `SessionStart` entry once the server has booted at least once; confirmed inert (see anti-goals exception) and explicitly **not staged/committed** (see §5 below).

**Next session (functional check, deferred):**
- One `ctx_execute` call and one `ctx_fetch_and_index` call succeed.
- Documented as a manual follow-up step, not part of this implementation pass.

### 5. settings.json diff handling

The Q1 self-heal write lands in a tracked file (`settings.json` is committed in this repo). It is **not committed** — committing it would add a `SessionStart` entry referencing `~/.claude/hooks/context-mode-cache-heal.mjs`, a file that only exists locally because npm wrote it; anyone else cloning this public repo would get a dangling reference. Stage files explicitly (`git add <path>`, never a broad `git add -A`/`git add .`) for any commit touching this area, and treat that hunk as permanent local-only drift, same category as other machine-specific runtime state.

### 6. Rollback / uninstall

```bash
claude mcp remove context-mode
npm uninstall -g context-mode
rm -rf ~/.claude/context-mode/                       # SQLite state
rm ~/.claude/hooks/context-mode-cache-heal.mjs        # self-heal script (Q1)
# then manually remove the matching SessionStart entry from ~/.claude/settings.json
```
Documented here (and echoed in the new skill / PR description) so backing this out is a five-minute lookup, not a forensic exercise later.

## Process

Two independent tracks, split because most of this change lives outside git entirely (grilling finding, Q4):

- **Track 1 — system-level (npm install, `claude mcp add`, verification):** none of this writes into the git repo (global npm, `~/.claude.json`, and the Q1 hook injection are all outside version control) — a worktree would isolate nothing here, so this runs directly, no worktree.
- **Track 2 — repo files (new `context-tools` skill, CLAUDE.md Process Layer row):** real tracked changes to a public repo with branch protection on `main` (per `.claude/rules/portable-repo.md`). GitHub remote (`paulchangmckay/brain`) and `gh` auth confirmed active, so `github-issue-first` will actually fire rather than no-op. Follows the standard flow: `github-issue-first` → `using-git-worktrees` → PR → explicit merge approval.
