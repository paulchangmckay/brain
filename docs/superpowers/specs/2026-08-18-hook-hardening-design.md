# Hook Hardening (Re-Read Gate + Wrong-Path Rescue) — Design

## Context

An audit of the GitHub repo `repowise-dev/repowise` (an AGPL-3.0 commercial
codebase-intelligence tool) surfaced eight patterns worth reimplementing
lightweight in `~/.claude`. The user chose to take all eight, decomposed into
four independent sub-projects. This spec covers the first: **Group A — Hook
Hardening**, the smallest and lowest-risk group, requiring no new
infrastructure.

Two existing pieces of `~/.claude`'s hook system are in scope:

- `hooks/pre-read-check.js` — a `PreToolUse`/`Read` hook that currently
  blocks a re-read only if the same path was read within the last 10 minutes
  (`REREAD_BLOCK_MS`) AND the file's mtime is unchanged on disk, using
  per-path `{path, ts, mtime}` records in `.wolf/_session.json`. It also
  does unrelated token-budget warnings using `.wolf/anatomy.md` entries —
  that logic is untouched by this spec.
  **Post-implementation correction:** the final whole-branch review found,
  and this was independently confirmed against the installed CLI binary
  (`strings`) plus empirically in a live session (reading the same
  unchanged file 3 times produced zero blocks), that this hook's
  `settings.json` wiring (`"${TOOL_INPUT_PATH:-}"`) references an
  environment variable that does not exist anywhere in Claude Code — it
  always expands empty, so `filePath` was always `''` and the hook exited
  immediately on line 1, every time, since long before this branch. Every
  other hook in this repo reads its input from stdin JSON; this was the
  only one using an argv/env-var scheme. Folded into this spec's scope
  (user-approved scope expansion) rather than deferred: the hook is
  rewired to read `tool_input.file_path` from stdin JSON like its
  siblings, and the broken argv substitution is removed from
  `settings.json`.
- No existing hook handles a failed Read/Edit on a wrong or stale path.
  `PostToolUseFailure` exists as a distinct Claude Code hook event
  (separate from `PostToolUse`, confirmed against current hooks docs) and is
  currently unused in this repo.

## Goals

- Replace the re-read gate's time-window heuristic with content-hash
  comparison, so an unchanged file is never re-served as "fresh" just
  because 10 minutes elapsed, and a changed file is never wrongly blocked.
- Guarantee the gate never gets an agent permanently stuck: the same blocked
  read is always allowed through on its next attempt.
- Add a new hook that, on a failed Read/Edit due to a missing path, suggests
  the correct path when — and only when — exactly one file on disk shares
  the failed path's basename.

## Non-Goals

- No byte-range (offset/limit) tracking. The gate stays whole-file, matching
  the current hook's granularity. Reading a different slice of the same
  large file is out of scope for this pass.
- No auto-retry of a failed tool call. The rescue hook only surfaces a
  suggested path as `additionalContext`; the agent decides what to do with
  it.
- No new index. The rescue hook reuses `.wolf/anatomy.md` as-is; it does not
  build or maintain its own file index.
- No change to the unrelated token-budget warning logic already in
  `pre-read-check.js`.
- Not scoped to `Write` failures — a failed `Write` to a new path is often
  intentional (creating a file), not a typo, so it's excluded to avoid wrong
  suggestions.

## 1. Re-Read Gate Upgrade (`hooks/pre-read-check.js`)

**Grilling correction:** `.wolf/_session.json` (the file this hook actually
reads/writes) is a *different* file from `.wolf/hooks/_session-<id>.json`
(which `hooks/session-start.js` already resets fresh every session). Nothing
currently clears `.wolf/_session.json` — it has accumulated read records
across every session ever run, unbounded, since the hook was introduced.
This spec now includes a fix (§1a) rather than inheriting that gap.

**State shape** (in `.wolf/_session.json`, array of per-path records,
matching the existing hook's convention):

```json
{
  "reads": [
    { "path": "<relPath>", "hash": "<sha256>", "blockedLastAttempt": false }
  ]
}
```

`blockedLastAttempt` is tracked **per path**, not as one global slot — two
different files can each be mid-block/retry independently without one
clobbering the other's override.

**Logic on a `Read` call for `<path>`:**

1. Stat the file. If size > 5MB, skip hashing entirely and fall back to the
   current mtime-based check for this file only (avoids a costly double
   read of very large files before the Read tool itself reads them).
2. Otherwise, read the file and compute its SHA-256 hash.
3. If `<path>` has no prior record → allow, record `{path, hash,
   blockedLastAttempt: false}`.
4. If `<path>` has a prior record with a **different** hash → allow (file
   changed since last read), update the record, `blockedLastAttempt: false`.
5. If `<path>` has a prior record with the **same** hash:
   - If `record.blockedLastAttempt === true` → allow this one time, set
     `blockedLastAttempt: false`. This is the retry-override: the same
     blocked read is never blocked twice in a row.
   - Otherwise → block, set `blockedLastAttempt: true`.

**Write path:** switch from the hook's current plain `writeFileSync` to an
atomic tmp-write-then-rename write (write to `<path>.<random>.tmp`, then
`renameSync`) — the same *pattern* `.wolf/hooks/shared.js`'s `writeJSON`
already uses, but implemented as a new local `hooks/lib/atomic-write.js`
rather than importing across into `.wolf/hooks/` (a separate,
daemon-owned tree that `openwolf init` can regenerate — top-level `hooks/`
already has its own shared-lib convention in `hooks/lib/`, e.g.
`token-count.js`, `gate-marker.js`). The existing plain write is a latent
race under concurrent sessions, which CLAUDE.md documents as a real
occurrence in this repo — no reason to carry that gap forward into a file
already being rewritten.

## 1a. SessionStart Reset (new, small addition to close the unbounded-growth gap)

A new `hooks/session-start-reset-read-state.js`, registered under
`SessionStart` alongside the repo's other SessionStart hooks, resets
`.wolf/_session.json` to `{ "reads": [] }` at the start of every session —
mirroring exactly how `hooks/session-start.js` already resets its own
(differently-named) session file. This keeps read/hash state scoped to a
single session, matching the design's original intent, instead of growing
forever.

**Why hash instead of mtime+window:** mtime-based blocking has two failure
modes — a file edited by an external process without changing content
(rare but possible) isn't distinguishable from a real edit, and a file that
hasn't changed in 15 minutes gets re-served as if it might have. A content
hash is the actual thing that matters: was this exact content already shown
to the agent.

## 2. Wrong-Path Rescue Hook (new file `hooks/post-read-failure-rescue.js`)

**Trigger:** `PostToolUseFailure`, matcher `Read|Edit`.

**Logic:**

1. Read `tool_error` from the hook's stdin payload. Test it against
   `/ENOENT|no such file|cannot find|does not exist/i`. No match → exit
   silently, not every failure is a wrong path (e.g. permission errors,
   read-only edits, or a directory given instead of a file all fail
   differently and are out of scope here).
2. Extract the basename of the failed `tool_input.file_path`.
3. Parse `.wolf/anatomy.md` in its real, grouped format: entries are bullets
   (`` - `filename` — description (~N tok) `` or `` - `filename`
   (~N tok) `` with no description) nested under `## <dir>/` markdown
   headers — the bullet holds a bare filename, not a full path; the
   directory comes only from the most recent header above it. Track the
   current header while scanning and join it with each bullet's filename to
   reconstruct a full path, then compare that filename against the failed
   basename for **exact string equality** — not a substring/grep match,
   which would false-match e.g. `check.js` inside `recheck.js`.
   (**Correction:** an earlier draft of this spec assumed a flat
   `path/to/file.ts - Description (~N tok)` line format, which does not
   match the real file — caught by task review during implementation,
   verified directly against this repo's live `.wolf/anatomy.md`.)
4. Exactly one exact-basename match → emit that file's full path as
   `additionalContext` (informational suggestion only, no forced action).
5. Zero or multiple matches → exit silently. Ambiguity is not a case this
   hook resolves — a wrong suggestion is worse than no suggestion.

**Wiring:** new entry in `settings.json` under `PostToolUseFailure` with
matcher `Read|Edit`, invoking `node hooks/post-read-failure-rescue.js` with
the standard hook stdin payload.

## Testing

**Correction:** the repo *does* have an automated test harness for
top-level `hooks/` — `node:test` + `node:assert/strict`, spawning each
hook script via `spawnSync` in a temp dir with `CLAUDE_PROJECT_DIR` set
(see `hooks/session-start.test.js`, `hooks/pre-skill-gate.test.js`, etc.,
run via `node --test hooks/<name>.test.js`). `hooks/pre-read-check.js`
currently has no test file — the plan adds one, following this existing
convention, for all three touched/new hooks below rather than relying on
manual verification only.

Re-read gate:
- Read a file, immediately re-read the same content → second read blocked.
- Edit the file, re-read → allowed (hash changed, record updated).
- Immediately re-attempt the exact same blocked read a second time →
  allowed (retry-override fires, that path's `blockedLastAttempt` cleared).
- Repeat the blocked case a third time after the override consumed →
  blocked again (override is single-use per path per block).
- Interleave: block file A, then read+block file B before retrying A →
  retry A → still allowed (per-path flag, unaffected by B).
- Read a file >5MB twice within the block window → mtime-based fallback
  behaves as today's hook does.
- Start a new session after read/block state exists → `.wolf/_session.json`
  reads to `{"reads": []}`, prior state gone.

Wrong-path rescue:
- `Read` a path with a typo'd directory but a basename that exists exactly
  once under `.wolf/anatomy.md` → suggestion appears in context.
- Same, but the basename exists in two or more places → silence.
- Same, but the basename doesn't exist anywhere in `.wolf/anatomy.md` →
  silence.
- `Edit` a nonexistent path with a unique basename match → suggestion
  appears (same code path as Read).
- `Write` to a genuinely new path → hook does not fire at all (out of
  scope by design).

## Scope

1 modified file (`hooks/pre-read-check.js`), 3 new files
(`hooks/post-read-failure-rescue.js`, `hooks/session-start-reset-read-state.js`,
`hooks/lib/atomic-write.js`), 3 new test files (one per new/modified hook,
following the `node:test` convention), 2 new `settings.json` hook
registrations (`PostToolUseFailure` and an additional `SessionStart` entry).
No new dependencies (Node's built-in `crypto` module covers SHA-256). No
schema migration required — the SessionStart reset means every session
starts from a clean, current-schema state.
