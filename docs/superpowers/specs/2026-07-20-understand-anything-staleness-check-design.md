# Understand-Anything Staleness Check — Design

## Purpose

`understand-anything` builds a knowledge graph of a codebase (`understand-anything:understand-domain` and friends), recorded with a `gitCommitHash` and `lastAnalyzedAt` in `.understand-anything/meta.json`. CLAUDE.md already instructs re-running analysis after changes, but nothing enforces or even reminds — the graph for `~/.claude` itself was found to be a month stale (last analyzed 2026-06-26, 285 files) during this session, silently, with no signal anywhere that it had drifted.

**Goal:** a passive, low-noise reminder at session start that nudges re-analysis when a project's knowledge graph has drifted meaningfully from its current git history — without ever nagging on every turn, and without breaking session start if anything about the check fails.

**Anti-goals:**
- Not a hard gate. Never blocks or slows down normal work — informational only.
- Not a nudge to adopt `understand-anything` in projects that have never run it. Scope is staleness of an *existing* graph only.
- Not a full staleness-tracking system (no dashboards, no cron jobs, no daemon integration). A single conditional line of context at session start is the entire feature.

## Constraints

- Must never throw or block `SessionStart` — any failure (missing meta.json, corrupt JSON, non-git directory, unreachable commit hash after a history rewrite) resolves to silently printing nothing.
- Must work per-project, relative to `${CLAUDE_CWD:-.}`, the same pattern `hooks/session-start.sh` already uses for `.wolf/anatomy.md` — not hardcoded to `~/.claude`.
- No new runtime dependencies. Node (already used throughout `hooks/*.js`) and `git` (already a hard requirement of this whole environment) only.

## Success Criteria

- Starting a session in a project whose `.understand-anything/meta.json` is >10 commits behind `HEAD` shows a one-line reminder in session context.
- Starting a session in a project that has never run `understand-anything`, or whose graph is fresh (≤10 commits behind), shows nothing extra.
- A corrupted `meta.json`, a `gitCommitHash` no longer reachable from `HEAD` (e.g. after a rebase), or a non-git working directory never crashes or blocks session start — worst case, no reminder appears.

## Architecture

A new hook script, `hooks/understand-anything-staleness.js`, invoked from the existing `hooks/session-start.sh` bash orchestrator alongside the current anatomy injection. `session-start.sh`'s role is unchanged — it still assembles and emits the final `SessionStart` JSON payload; it just captures one more piece of context from a new Node script, exactly as it already reads `.wolf/anatomy.md` as a bash string. Real logic (JSON parsing, shelling out to git, threshold comparison) lives in Node, matching how every other hook with actual logic in this repo (`pre-read-check.js`, `pre-skill-gate.js`, `post-skill-record.js`, `subagent-thin-harness.js`) is a `.js` file rather than inline bash.

## Components

Structured as pure functions plus a thin orchestrator, the same shape as `docs-site/scripts/pull-skills.mjs`, so each piece is independently unit-testable:

- **`readMeta(cwd)`** — reads and `JSON.parse`s `${cwd}/.understand-anything/meta.json`. Returns `null` if the file doesn't exist or fails to parse (tool never run in this project, or something is corrupt) — not an error case, just "nothing to check."
- **`countCommitsBehind(cwd, commitHash)`** — runs `git -C <cwd> rev-list --count <commitHash>..HEAD` via `execFileSync`, parses the numeric result. Returns `null` on any failure (non-git directory, unreachable/rewritten commit hash, git not installed) rather than throwing.
- **`formatStalenessMessage({ commitsBehind, threshold, cwd })`** — pure function. Returns a one-line message with `cwd` double-quoted so the suggested command stays copy-pasteable even when the path contains spaces (a real case in this environment — `/Users/paulmckay/Desktop/NHL Stats Project`), e.g. `` "Knowledge graph is 14 commits behind HEAD — consider running /understand-anything:understand \"/Users/paulmckay/.claude\"" `` when `commitsBehind > threshold`, else `null`. No I/O, trivially testable.
- **`checkStaleness(cwd, threshold = 10)`** — orchestrates the three above: `readMeta` → if `null`, return `null`; else `countCommitsBehind` using `meta.gitCommitHash` → if `null`, return `null`; else `formatStalenessMessage({ commitsBehind, threshold, cwd })`. This is what the CLI entrypoint calls.
- **CLI entrypoint** (`if (isMain)` block, matching `pull-skills.mjs`'s convention): calls `checkStaleness(process.argv[2] || process.cwd(), threshold)` — where `threshold` comes from an optional `UNDERSTAND_STALENESS_THRESHOLD` env var (parsed as an integer, falling back to the default `10` if unset or unparseable) — and, if it returns a non-null message, prints it to stdout via `console.log`. Prints nothing otherwise. Never throws past this point — the orchestrator's own `null`-on-failure contract means the CLI body has no error path left to handle.

Default threshold is **10 commits behind**, overridable per-shell/per-project via `UNDERSTAND_STALENESS_THRESHOLD` (an env var, not a config file — cheap escape hatch for a project with a very different commit cadence than `~/.claude`, without building config-file plumbing for a single number).

## Data Flow

1. `session-start.sh` runs `node /Users/paulmckay/.claude/hooks/understand-anything-staleness.js "${CLAUDE_CWD:-.}"`, capturing stdout into a bash variable, tolerating a non-zero exit with `|| true` (belt-and-suspenders on top of the script's own internal never-throw contract).
2. If that output is non-empty, it's escaped the same way anatomy content already is (`escape_for_json`) and wrapped in a new `<UNDERSTAND_ANYTHING_STALENESS>...</UNDERSTAND_ANYTHING_STALENESS>` block, appended to `combined_context` alongside the existing `<GLOBAL_CLAUDE_ANATOMY>` / `<PROJECT_ANATOMY>` / `<OPENWOLF_NOTICE>` blocks.
3. If the output is empty, `combined_context` is unchanged — no new block appears at all.

## Error Handling

Every failure mode collapses to "the CLI entrypoint prints nothing":

| Condition | Handling |
|---|---|
| No `.understand-anything/meta.json` | `readMeta` returns `null` → `checkStaleness` returns `null` → nothing printed |
| `meta.json` exists but isn't valid JSON | `JSON.parse` throws inside `readMeta`, caught there, returns `null` |
| `cwd` isn't a git repository | `git rev-list` exits non-zero, `execFileSync` throws, caught in `countCommitsBehind`, returns `null` |
| `gitCommitHash` unreachable from `HEAD` (rewritten history) | Same as above — `git rev-list` errors, caught, returns `null` |
| `git` not on `PATH` | Same as above |
| `commitsBehind` computed but ≤ threshold | Expected non-stale case — `formatStalenessMessage` returns `null` by design, not an error |

`session-start.sh`'s own call site adds `|| true` so even an unanticipated non-zero Node exit code can't break `SessionStart`.

## Testing

`hooks/understand-anything-staleness.test.js`, `node:test`, matching the style of `hooks/pre-skill-gate.test.js` and `docs-site/scripts/pull-skills.test.mjs` — real temp directories and real (tiny, local) git repos, no mocking of `git` or the filesystem:

- `readMeta` returns `null` for a missing file, `null` for invalid JSON, and the parsed object for valid JSON.
- `countCommitsBehind` returns the correct count against a real temp git repo with a few commits, and `null` against a non-git directory and against an unreachable commit hash (a fixed 40-character hex string that was never a real commit — git's "bad revision" error is identical whether a hash never existed or existed and was later rewritten out of history, so a fake hash exercises the same code path without needing to actually simulate a rebase).
- `formatStalenessMessage` returns `null` at/under threshold, a message over it, the message mentions the actual commit count, and the message double-quotes a `cwd` containing a space.
- `checkStaleness` end-to-end: a temp git repo with a `meta.json` pointing at an old commit and >10 newer commits produces a message; the same repo with a fresh `gitCommitHash` (HEAD itself) produces `null`; a repo with no `.understand-anything/` directory at all produces `null`.

## Out of Scope

- Any UI/dashboard for staleness across multiple projects at once.
- Auto-running the re-analysis (this only reminds; the user decides when to run `/understand-anything:understand`).
- Wiring into `Stop`, a cron, or the OpenWolf daemon — SessionStart only, per the earlier decision.
