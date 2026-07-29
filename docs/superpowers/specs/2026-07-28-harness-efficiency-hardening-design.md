# Harness Efficiency Hardening — Design

## Context

An audit of `~/.claude`'s harness (session-start injection, memory files, token
tracking) plus four external repos (claude-context, MemOS, claude-token-efficient,
token-optimizer) surfaced five concrete gaps. This spec covers the five the user
chose to act on now:

1. `.wolf/cerebrum.md` is configured with a 2000-token cap
   (`.wolf/config.json` → `cerebrum.max_tokens: 2000`) enforced by a weekly
   `cerebrum-reflection` cron — but the file is currently 110KB, and
   `daemon.log`/`cron-state.json` show the task has not fired in the visible
   log window at all.
2. `.wolf/memory.md` is meant to be consolidated by a daily `memory-consolidation`
   cron (collapses sessions older than 7 days into one-line summaries) — the
   file is currently 207KB; the cron fired exactly once in the entire visible
   `daemon.log` window (2026-07-21) despite a daily schedule.
3. Token-waste estimates throughout OpenWolf use a static char-count divisor
   (`chars_per_token_code: 3.5`, `chars_per_token_prose: 4.0`), not real
   tokenization, so size/waste numbers are approximate.
4. `.wolf/token-ledger.json` has grown to 5.7MB as a flat append-only log
   (742 session entries, plus a `waste_flags` array with many duplicate
   entries), and is read/written by hooks on tool calls.
5. `CLAUDE.md` §5 documents a "brain" MCP filesystem server rooted at
   `~/brain/` — but `claude mcp list` / `~/.claude.json` show no such server
   was ever actually registered. `gbrain` (a separate, more capable PGLite +
   autopilot tool) has been serving this role in practice, and its MCP
   connection is currently failing.

**Root cause behind 1, 2, and 4:** OpenWolf (global npm package v1.0.4,
compiled `dist/`, not something we own the source of) runs a PM2-daemon cron
scheduler (`.wolf/cron-manifest.json`). Its 6-hourly `anatomy-rescan` task
fires reliably; the daily/weekly tasks (`memory-consolidation`,
`cerebrum-reflection`, `token-audit`) do not, per direct inspection of
`daemon.log` and `cron-state.json`. The consolidation/reflection logic itself
is correct (verified in OpenWolf's `dist/src/daemon/cron-engine.js` — memory
consolidation properly collapses old sessions; the cerebrum-reflection prompt
already instructs the LLM to "keep the file under 2000 tokens") — it's purely
a scheduler-reliability problem in a package we can't durably patch.

**Root cause behind 5:** `~/brain/` (the directory) and
`mcp_servers.example.json` (the template) exist, but no `mcp_servers.json`
was ever created and no "brain" entry exists in `~/.claude.json`'s
`mcpServers` map — only `gbrain`. CLAUDE.md documents a system that was
apparently superseded before it was ever wired up. `gbrain doctor --json`
independently confirms a `connection` failure ("Could not connect to
configured DB") as the top-tier root issue for the PGLite engine, most likely
a stale lock (`~/.gbrain/postmaster.pid`, `.gbrain-lock/`) left by an
unclean shutdown — no live process currently holds it.

## Goals

- Cerebrum and memory consolidation happen reliably, regardless of whether
  OpenWolf's internal daemon scheduler is working.
- Size/waste decisions use real tokenization (`cl100k_base` via `js-tiktoken`)
  instead of a char-count heuristic, for anything these new hooks directly
  manage.
- `token-ledger.json` growth is bounded (old entries rolled into existing
  aggregates, not deleted; duplicate waste-flag spam deduplicated).
- CLAUDE.md accurately describes the personal-knowledge tooling that's
  actually in use.
- Best-effort fix for gbrain's MCP connection failure.

## Non-Goals

- Not patching OpenWolf's compiled `dist/` files directly (fragile against
  `npm update -g openwolf`, same reasoning CLAUDE.md already applies to
  superpowers/gbrain).
- Not reimplementing OpenWolf's consolidation/reflection *logic* — it's
  reused via its own CLI (`openwolf cron run <id>`), not rebuilt.
- Not a general rewrite of OpenWolf's token-estimation internals — the char
  heuristic inside the closed package is left as-is; we add an accurate
  parallel estimator only where our own new hooks need one.
- Not a deep debugging session into gbrain's TypeScript internals if the
  lock-clear attempt doesn't resolve the connection — that gets documented
  as a known issue, not chased further in this pass.

## 1. Cron Reliability Gate

New file: `hooks/openwolf-cron-gate.js`. Registered in the **top-level**
`~/.claude/settings.json` (not the project-tier `.claude/settings.json`),
so it fires for every Claude Code session in any project — not just
`~/.claude`. It resolves `.wolf/` relative to `CLAUDE_CWD` and no-ops
immediately (same pattern as `session-start.sh`'s existing anatomy-file
check) when the active project has no `.wolf/` directory. This fixes the
same root-cause scheduler bug (OpenWolf's daemon reliably running only its
6-hourly task) in every OpenWolf-initialized project, not just this one.

Two independent checks, each backed by a small JSON marker file (following
the existing `.wolf/_cerebrum-guard-*.json` / `.wolf/_writecount-*.json`
convention):

- **Memory consolidation** — registered on `SessionStart`. Reads
  `.wolf/_gate-memory-consolidation.json` (`{ lastRun: <ISO> }`). Triggers
  `openwolf cron run memory-consolidation` (synchronous — this cron action is
  pure JS string processing, observed at 3-6ms in `daemon.log`, so blocking
  briefly at session start is safe) when either:
  - more than 24h have passed since `lastRun`, or
  - `.wolf/memory.md`'s token count (via Component 2) exceeds 15,000 tokens.

  After a successful consolidation run, re-measure `memory.md`. If it still
  exceeds the threshold (consolidation only collapses old sessions into
  one-line summaries — it never removes anything, so the file still grows
  unboundedly over a long enough timescale), move the oldest already-
  consolidated one-line summary entries into `.wolf/memory-archive.md`,
  automating the same "not auto-loaded, read on demand only" archival a
  past session already did manually on 2026-07-01 (that file and its
  convention already exist; this just stops it from needing to be redone
  by hand).

  Updates the marker file after a successful run.

- **Cerebrum reflection** — registered on `Stop`, **synchronous** (not
  `async` — see rationale below). Reads
  `.wolf/_gate-cerebrum-reflection.json`. Triggers
  `openwolf cron run cerebrum-reflection` when either:
  - more than 8 days have passed since `lastRun`, or
  - `.wolf/cerebrum.md`'s token count exceeds 2,200 tokens (buffer above the
    2,000 true cap to avoid thrashing on measurement noise).

  This action shells out to `claude -p` internally (up to 120s). The
  original design used `async: true` on `Stop` to avoid blocking session
  end, but Claude Code's own hooks documentation does not guarantee an
  async hook survives past CLI exit (confirmed via research: `asyncRewake`
  exists as a separate mechanism specifically to "wake" Claude after an
  async background task, which implies plain `async` has no completion
  guarantee — a real risk that a Stop-triggered async task gets orphaned
  when the session closes). Since the entire point of this component is
  "don't let a scheduled task silently fail to run," it uses a **synchronous**
  Stop hook instead, accepting an occasional up-to-120s delay at session end
  (only once every ~8 days, only when the file is actually oversized) —
  directly precedented by the existing langsmith Stop hook (`stop.js`,
  timeout 120), which already blocks synchronously on every session close.

**Cross-session lock.** Both checks are gated by an atomic lock file
(`.wolf/_cron-gate.lock`, created via the `wx` flag — fails if another
session already holds it) before triggering. This matters because
`openwolf cron run <id>` first tries the project's daemon over HTTP
(serialized safely, single-threaded) but falls back to spawning its own
in-process `CronEngine` if the daemon is unreachable — so two concurrent
Claude Code sessions hitting a stale gate at the same time could otherwise
run two independent processes read-modify-writing the same file
concurrently. The lock is released (file removed) once the triggered run
completes, whether it succeeded or failed.

Both checks fail open: if `openwolf cron run <id>` errors (e.g. `claude` CLI
not on PATH, non-zero exit — confirmed via `openwolf`'s own `cron-cmd.js`
that this is a reliable, distinguishable exit code, not something we have to
infer from parsing output), log to stderr and leave the marker file
untouched so the next session retries — never throw and never block the
hook's own exit.

## 2. Token Counting

New file: `hooks/lib/token-count.js`. Wraps `js-tiktoken` (`cl100k_base`
encoding, pure JS — no WASM/native build step, safe inside a Node hook).
Exposes a single function, `estimateTokens(text): number`.

Consumed by Component 1 (size-based trigger checks) and Component 3
(pruning decisions / reporting). This becomes the accurate tokenizer for
everything these new hooks manage directly; OpenWolf's internal
`chars_per_token_*` heuristic is untouched (it lives in the closed package
and isn't something we can safely swap in place — see Non-Goals).

Dependency: add `js-tiktoken` to `hooks`'s `package.json` (currently
devDependencies-only for eslint; this becomes the first runtime dependency).

## 3. Token Ledger Pruning

New file: `hooks/prune-token-ledger.js`. Triggered weekly from the same gate
pattern as Component 1 (own marker file, `.wolf/_gate-ledger-prune.json`,
checked at `SessionStart`).

Operates on `.wolf/token-ledger.json`:

- **Sessions array**: entries with `started` older than 30 days are removed
  from the `sessions` array, but their `reads`/`writes`/token counts are
  summed into the existing `lifetime` aggregate fields first — no data is
  discarded, it's rolled up rather than deleted.
- **Waste flags**: `waste_flags` entries with identical `pattern` +
  `description` are collapsed into one entry with an added `count` field,
  instead of the current pattern of dozens of near-identical
  `anatomy_miss_rate` entries.

Fails open the same way as Component 1: any read/parse error on the 5.7MB
file logs to stderr and skips pruning for that session rather than risking a
corrupt write.

## 4. CLAUDE.md §5 Correction + gbrain Connection Fix

- Rewrite CLAUDE.md §5 to describe `gbrain` accurately: a PGLite-backed
  personal-knowledge tool (`gbrain get/put/search/query`, exposed as an MCP
  server) with an autopilot process that enriches content synced from the
  git-backed `~/brain/` directory (people/companies/concepts/decisions).
  Remove the "brain" filesystem-MCP description — it was never actually
  registered (confirmed via `~/.claude.json`'s `mcpServers` map and the
  absence of any real `mcp_servers.json`).
- Attempt the connection fix: confirm the PID referenced in
  `~/.gbrain/postmaster.pid` is not a live process (already appears to be
  the case), then clear the stale PGLite lock and re-verify with
  `gbrain doctor --json` and `claude mcp list`. This touches a third-party
  tool's data directory outside `~/.claude` — best-effort only; if the
  connection is still failing afterward, document the current state in
  CLAUDE.md rather than continuing to debug gbrain's internals.

## Files Changed

- `hooks/openwolf-cron-gate.js` (new) + `hooks/openwolf-cron-gate.test.js` (new)
- `hooks/lib/token-count.js` (new) + `hooks/lib/token-count.test.js` (new)
- `hooks/prune-token-ledger.js` (new) + `hooks/prune-token-ledger.test.js` (new)
- `hooks/package.json` — add `js-tiktoken` dependency
- `settings.json` (top-level, user config) — register the two new hook
  entry points (`SessionStart`, synchronous `Stop`)
- `CLAUDE.md` — §5 rewrite
- `~/.gbrain/postmaster.pid` / `.gbrain-lock/` — cleared if confirmed stale
  (outside the `~/.claude` repo, not committed)

## Sequencing

1. Component 2 (token-count util) first — Components 1 and 3 both depend on it.
2. Component 1 (cron gate) — the highest-value fix, addresses items 1 and 2.
3. Component 3 (ledger pruning) — independent of 1, can land in parallel.
4. Component 4 (CLAUDE.md + gbrain) — fully independent of 1-3, can land in
   any order; likely fastest to ship.

## Open Questions for the Plan Stage

- Exact `js-tiktoken` package name/version pin.
- Whether clearing the gbrain PGLite lock should happen automatically as
  part of Component 4's implementation, or be called out as a manual step
  for the user to run themselves given it touches a live personal database
  outside this repo.
- Test strategy for Component 1's shell-out and time-based gating: existing
  hook tests (e.g. `pre-skill-gate.test.js`) spawn the real script against a
  real temp directory rather than mocking `fs`. The plan should follow that
  convention — staleness is tested by seeding marker files with genuinely
  past timestamps (no clock mocking needed), and the `openwolf` invocation
  should be overridable via an env var (same pattern as
  `WOLF_SUBAGENT_DIGEST_PATH` in `subagent-thin-harness.js`) so tests point
  it at a fake executable instead of shelling out to the real global CLI.

**Resolved during grilling** (see inline in the sections above, not
repeated here): exit-code reliability for `openwolf cron run <id>` (confirmed
via its own `cron-cmd.js` source), cross-session locking, automatic
memory-archive rollover, generic vs. `~/.claude`-only scope, and
sync-vs-async for the cerebrum Stop hook.
