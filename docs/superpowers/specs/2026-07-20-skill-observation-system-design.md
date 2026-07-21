# Skill Observation System (OpenWolf enhancement)

**Status:** Approved, grilled
**Date:** 2026-07-20

## Context

The user reviewed the [task-observer](https://github.com/rebelytics/one-skill-to-rule-them-all)
meta-skill (a third-party Claude skill that watches sessions for skill-improvement
signals and new-skill candidates, logging them to a numbered/status-tracked
observation log with a staged-review-before-install pattern) and asked for 5 of
its ideas to be incorporated into the existing OpenWolf setup at `~/.claude`:

1. Hard tool-anchored checkpoints replacing soft "remember to log" prose
   reminders — `cerebrum.md` currently has 6 consecutive empty
   `## Compaction event: <timestamp>` stubs with no content filled in, proving
   the existing prose reminder (`pre-compact-snapshot.sh` stamps a marker and
   asks Claude to save findings first) is not being honored.
2. A numbered, status-tracked (OPEN/ACTIONED/DECLINED), concurrency-safe log,
   replacing reliance on free-form append-only `cerebrum.md` for this kind of
   material. CLAUDE.md already documents having hit concurrent-session
   collisions on `.wolf/` files.
3. A new-skill-candidate detection loop — nothing currently watches for a
   repeating multi-step manual workflow and proposes bundling it into a skill.
4. A staged-review pattern for skill edits sourced from observations — there's
   no equivalent today to how `session-reflect` Phase 2 already stages
   CLAUDE.md changes for approval.
5. A `cross-cutting-principles.md` checked as a mandatory checklist at every
   skill creation/edit.

### Existing infrastructure (from exploration)

- **`hooks/pre-skill-gate.js` / `hooks/post-skill-record.js`** — the existing
  precedent for hook-enforced gating. `post-skill-record.js` (PostToolUse,
  matcher `Skill`) writes a marker file per `(session, skill)` pair if one
  doesn't exist yet (`.wolf/_skill-gate-<session>--<skill>.json`) — one file
  per pair specifically to avoid read-modify-write races. `pre-skill-gate.js`
  (PreToolUse, matcher `Skill`) blocks `writing-plans` unless a satisfying
  marker exists. Both validate session IDs against `/^[A-Za-z0-9._-]+$/`
  before using them in paths. Stale markers are swept in `session-start.sh`
  (`-mmin +1440 -delete`). Both have `.test.js` siblings.
- **`settings.json` hooks** — registers `SessionStart`, `UserPromptSubmit`,
  `PreToolUse`, `PostToolUse`, `Stop`/`StopFailure`, `SubagentStart`,
  `SubagentStop`, `PreCompact`, `PostCompact`, `SessionEnd`. `PostToolUse`
  already uses pipe-separated multi-tool matchers (e.g.
  `Edit|Write|MultiEdit|NotebookEdit`) — direct precedent for a new
  write-batch hook. Hooks can be `async`/`asyncRewake` for non-blocking
  background checks.
- **`hooks/subagent-thin-harness.md`/`.js`** — precedent for "compact digest,
  manually kept in sync with CLAUDE.md, injected verbatim at a specific hook
  event" (`SubagentStart`, skipped for `explore`/`understand-anything:*`
  agents). Direct precedent for injecting `cross-cutting-principles.md`.
- **`.wolf/cerebrum.md`** — header states *"OpenWolf's learning memory.
  Updated automatically... Do not edit manually unless correcting an error."*
  Sections: `## User Preferences`, `## Key Learnings` (plus project-scoped
  variants), `## Do-Not-Repeat`, `## Decision Log`, chronological, no
  numbering or status tracking. **This file is openwolf-daemon-owned** — the
  daemon periodically rewrites it, so restructuring it directly into a
  numbered/status log would fight the daemon's own rewrite cycle. New state
  from this design must live in a separate, hand-owned file.
- **`.wolf/buglog.json`** — `{id: "bug-NNN", timestamp, error_message, file,
  root_cause, fix, tags[], related_bugs[], occurrences, last_seen}`, written
  by `session-reflect` Phase 1. Confirms numbered/tagged entries with
  occurrence tracking are already a working pattern in this repo, just not
  applied to skill-observation material.
- **`.wolf/memory.md`** — chronological session log, *"Old sessions are
  consolidated by the daemon weekly"* — also daemon-touched, same
  do-not-restructure caveat as `cerebrum.md`.
- **`skills/session-reflect/SKILL.md`** (98 lines) — Phase 1 (unconditional):
  reads today's `memory.md` entries, appends 1-3 high-signal patterns to
  `cerebrum.md`'s four headers, appends fixed bugs to `buglog.json`. Phase 2
  (conditional): team-worthiness test is *"Would a future Claude session
  working in this project be helped by knowing this?"*; drafts a diff,
  **shows it inline in chat, and writes directly to the live CLAUDE.md once
  approved — no staging folder**. This is the existing precedent for
  "lightweight, inline-diff, synchronous approval."
- **`superpowers:writing-skills`** — TDD-shaped (RED/GREEN/REFACTOR,
  pressure-test subagents), no staging directory, no open-source/internal
  taxonomy (not needed — these skills aren't published). Ends in `git
  commit`.
- **`skills/debt-ledger` + `scripts/wolf-debt-scan.js`** — precedent for
  "deterministic scanner script + thin skill wrapper, read-only unless asked
  to persist." Direct model for `wolf-observation-log.js`.
- **No existing skill-candidate detection mechanism anywhere** (confirmed via
  search across `skills/`, `.wolf/`, CLAUDE.md).
- **openwolf CLI/daemon is third-party but not opaque — confirmed safe to add
  files alongside it.** `openwolf@1.0.4`, PM2-managed per-project daemon.
  `.wolf/config.json`'s `anatomy.exclude_patterns` includes `.wolf` itself, so
  `openwolf scan` never walks into `.wolf/` at all. `cron-manifest.json`
  defines all 5 cron jobs (`anatomy-rescan`, `memory-consolidation`,
  `token-audit`, `cerebrum-reflection`, `project-suggestions`) with an
  explicit, hardcoded `context_files` list per job — none glob `.wolf/*.md`
  or discover files dynamically. So `observations.md` and
  `cross-cutting-principles.md` are structurally invisible to openwolf: no
  discovery mechanism will ever touch, contest, or manage them. Notably,
  `cerebrum-reflection` (Sundays 3AM) ships the *entire* `cerebrum.md` to an
  AI with the prompt "return the cleaned file content only" and replaces the
  file wholesale — stronger confirmation than originally known that
  restructuring `cerebrum.md` directly would fight the daemon. Also notable
  but out of scope: `cron-manifest.json` turned out to be a plain declarative
  file (`cron.use_claude_p: true` — shells out to local `claude -p`, no
  separate API key) rather than a true black box; a cron-based review was
  reconsidered and still rejected in favor of the in-session fallback (see
  Decision 4) since it avoids depending on the daemon/PM2 staying up.
- **`skills/wolf-init/SKILL.md`** — step 3 runs `openwolf init`, which is what
  actually creates `anatomy.md`/`cerebrum.md`/`buglog.json`/`memory.md` (a
  fixed, hardcoded set baked into the third-party CLI). Confirmed via
  `openwolf` package inspection that `wolf-init` does no file-creation of its
  own beyond invoking the CLI and (in later steps) reading the results — so
  it cannot bootstrap files `openwolf init` doesn't know about without an
  explicit added step.
- **No `skill-creator` skill exists in this repo** (confirmed via repo-wide
  grep) — earlier design language referencing it was speculative and wrong.

### Decisions locked in during brainstorming

1. **New sibling file**, not a `cerebrum.md`/`buglog.json` restructure:
   `.wolf/observations.md`, fully owned by our own hooks/scripts, following
   `buglog.json`'s numbered/tagged rigor but in `cerebrum.md`'s markdown-header
   style.
2. **Deterministic auto-write** for the compaction checkpoint: the hook
   itself writes a structured OPEN placeholder — not dependent on Claude
   complying with a prose reminder (the reminder already exists today and
   demonstrably fails).
3. **Two-tier staging** for skill edits: small additive changes → inline
   diff, approved, written live (matches `session-reflect`'s existing
   pattern). Substantial changes → routed into the existing
   `github-issue-first → worktree → TDD → PR` pipeline rather than a new
   staging-folder mechanism.
4. **In-session fallback only** for review cadence — no new scheduler, no
   dependency on openwolf's black-box daemon cron. `session-reflect` checks a
   last-review-date marker and offers a one-line prompt when stale.

### Decisions locked in during grilling

5. **Bootstrap**: add an explicit file-creation step to `wolf-init/SKILL.md`
   (after its existing `openwolf init` step) that creates `observations.md`,
   `cross-cutting-principles.md`, and `observations-last-review.txt` directly
   via Write if missing — `openwolf init` has no way to know about them.
   Since `~/.claude` itself is already initialized and won't have `wolf-init`
   re-run, the three files are also created directly as a one-time step
   during implementation. No new SessionStart hook — a hook whose only job
   is backfilling a gap this repo only ever has once is unneeded machinery.
6. **`pre-principles-injection.js` retargeted**: fires on `PreToolUse` for
   `Edit|Write|MultiEdit` filtered to file paths matching `**/SKILL.md`, not
   on `Skill`-tool invocation of `writing-skills`. The two-tier design
   explicitly allows small skill edits via a direct `Edit` with no skill
   invoked at all (the common case, matching `session-reflect`'s own
   CLAUDE.md-edit precedent) — a trigger gated on invoking `writing-skills`
   would miss most real edits. A single file-path-based trigger covers direct
   edits, edits following `writing-skills`, and new-skill creation
   (`Write` to a fresh `SKILL.md`) without needing to enumerate every
   meta-skill that might be involved. No dual-trigger — the file-path match
   already fires at the same effective moment (first draft write) a
   `Skill`-invocation trigger would.
7. **`wolf-observation-log.js append` takes JSON via stdin**, not CLI flags —
   `--issue "..."` style flags are fragile against embedded quotes/newlines
   in free-form Issue/Improvement/Principle text, which is exactly the
   content this command carries. `echo '{...}' | node wolf-observation-log.js
   append` uses standard JSON escaping instead of shell-quoting rules.
8. **`post-write-batch-nudge.js` marker schema corrected** to
   `{ "writesSinceLastObservation": N, "lastKnownObservationCount": N }`
   (the original spec referenced an undefined `countAtLastNudge` field — a
   real inconsistency, not just imprecise wording). Logic: on each
   `Write`/`Edit`/`MultiEdit`, count `### Observation` headers in
   `observations.md`; if greater than `lastKnownObservationCount`, something
   was logged since the last check — reset `writesSinceLastObservation` to 0
   and update `lastKnownObservationCount`; otherwise increment
   `writesSinceLastObservation`. At `>= 5`, inject the reminder and reset the
   counter to 0 (nags every 5th untracked write, not every write after
   threshold).
9. **`post-compact-observation.js` dedupes per session, not per compaction
   event**: before appending, check whether an OPEN `compaction-checkpoint`
   entry already exists for this `session_id`; if so, do nothing. Directly
   motivated by the existing evidence in `cerebrum.md` — two compactions 9
   seconds apart in the same session — which would otherwise produce
   duplicate placeholders asking the same question twice.
10. **Archival added** for `observations.md`, piggybacking on the existing
    review step rather than a new trigger: when the periodic review runs, it
    first moves entries resolved on a *previous* day to
    `.wolf/observations-archive/log-[YYYY-MM-DD-of-resolution].md` (preserving
    the log header), before applying the day's updates. Entries resolved
    *today* — no matter which session resolved them — stay in the active log
    until the next review (grace period; avoids archiving something a
    concurrent session just touched). Mirrors task-observer's own archival
    reasoning, applied to the existing 7-day fallback instead of a new
    schedule.

## Design

### File layout (new files)

```
.wolf/
├── observations.md                  # new — numbered/status-tracked log
├── observations-archive/
│   └── log-[YYYY-MM-DD].md          # new — resolved entries, by resolution date
├── cross-cutting-principles.md      # new — checklist, starts empty
├── observations-last-review.txt     # new — "never" or ISO date
└── _writecount-<session>.json       # new — ephemeral per-session marker

scripts/
└── wolf-observation-log.js          # new — append/resolve/archive helper

hooks/
├── post-compact-observation.js      # new
├── post-compact-observation.test.js # new
├── post-write-batch-nudge.js        # new
├── post-write-batch-nudge.test.js   # new
├── pre-principles-injection.js      # new
└── pre-principles-injection.test.js # new
```

No existing file is restructured. `session-reflect/SKILL.md` and
`settings.json` are edited, not replaced.

### `.wolf/observations.md` schema

```markdown
# Skill Observation Log

Observations captured during task-oriented work. Separate from cerebrum.md
(daemon-owned) — this file is owned by session-reflect and the hooks below.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = applied |
DECLINED (YYYY-MM-DD) = reviewed, not pursued

---

### Observation 1: [Short descriptive title]

**Status:** OPEN
**Date:** 2026-07-20
**Type:** skill-improvement | new-skill-candidate | cross-cutting-principle | compaction-checkpoint | write-batch-checkpoint
**Skill:** [affected skill name, or "New skill candidate: <working name>"]
**Issue:** [what happened, specific enough to understand weeks later]
**Suggested improvement:** [concrete change]
**Principle:** [the generalisable takeaway]
```

Fields for `compaction-checkpoint` and `write-batch-checkpoint` entries start
minimal (Issue: "Compaction occurred; review for unlogged insight" /
"N file changes since last observation") and are expected to be enriched or
explicitly resolved, not left as-is.

### `scripts/wolf-observation-log.js`

Two subcommands, both operating on `.wolf/observations.md`:

- **`append`** — reads a JSON payload from stdin:
  ```bash
  echo '{"type":"skill-improvement","skill":"grilling","issue":"...","improvement":"...","principle":"...","status":"OPEN"}' \
    | node wolf-observation-log.js append
  ```
  JSON via stdin instead of CLI flags — Issue/Improvement/Principle are
  free-form prose likely to contain quotes or embedded newlines, and standard
  JSON escaping handles that correctly where shell-flag-splitting doesn't.
  Implements the numbering discipline in code (mirrors `post-skill-record.js`'s
  deterministic approach rather than relying on Claude re-deriving a grep/awk
  dance each time):
  1. Pre-check: `grep` the highest existing `### Observation N:` number.
  2. Pre-write assert: confirm proposed `N+1` doesn't already exist.
  3. Append at end of file.
  4. Post-write verify: count occurrences of the new header; if >1, a
     concurrent writer collided — renumber to current-max+1 and retry once.
  5. Refuse to run (print a warning, exit non-zero, hook must fail open) if
     `cwd` resolves under `.claude/worktrees/` or another ephemeral-checkout
     pattern — mirrors task-observer's workspace-anchoring guard, since
     `.wolf/observations.md` written inside a worktree would be lost at
     teardown same as any other file there.
- **`resolve <N> <ACTIONED|DECLINED> "<note>"`**
  Line-anchored status update (never a DOTALL/greedy rewrite across the whole
  file — the exact failure mode task-observer's own SKILL.md documents
  happening in production). Locates entry `N` by its literal header, updates
  only that entry's `**Status:**` line, verifies the total `### Observation`
  count is unchanged after the write.
- **`archive`** — used by the review step (see `session-reflect` changes
  below): finds entries whose `**Status:**` line is `ACTIONED (YYYY-MM-DD)` or
  `DECLINED (YYYY-MM-DD)` with a date before today, moves them (verbatim,
  preserving the entry text) to
  `.wolf/observations-archive/log-[YYYY-MM-DD].md` grouped by resolution
  date, and removes them from the active log. Entries resolved *today* —
  regardless of which session resolved them — are left in place; the
  resolution-date check is read from the file, not session memory, so the
  grace period holds across parallel/subsequent sessions. Follows the same
  backup-before-write, verify-count-after-write discipline as `append`.

All three subcommands back up `observations.md` to `.observations.md.bak`
before any write and are covered by unit tests, including a simulated
concurrent-append test (two rapid appends against the same file, assert both
survive with distinct numbers).

### Hooks

**`hooks/post-compact-observation.js`** — `PostCompact`. Before writing,
checks whether an OPEN `compaction-checkpoint` entry already exists for this
`session_id` in `observations.md`; if so, no-ops (dedupes per session, not
per compaction event — the existing evidence shows compactions can fire
seconds apart in the same session, which would otherwise produce duplicate
placeholders). Otherwise pipes a JSON payload to `wolf-observation-log.js
append`: `{"type":"compaction-checkpoint","skill":"session","issue":"Compaction
occurred; context may contain unlogged insights","improvement":"Review this
session's work and either enrich this entry or resolve DECLINED if nothing
generalizes","principle":"","status":"OPEN"}`. Deterministic — runs
regardless of whether Claude does anything with it. Fails open (logs a
warning to stderr, doesn't block) if the script errors.

**`hooks/post-write-batch-nudge.js`** — `PostToolUse`, matcher
`Write|Edit|MultiEdit`. Maintains `.wolf/_writecount-<session>.json`
(`{ "writesSinceLastObservation": N, "lastKnownObservationCount": N }`). On
each matching call: count `### Observation` headers in `observations.md`; if
greater than `lastKnownObservationCount`, something was logged since the last
check — reset `writesSinceLastObservation` to 0 and update
`lastKnownObservationCount`; otherwise increment `writesSinceLastObservation`.
At `>= 5`, inject a non-blocking `additionalContext` reminder ("5 file changes
since the last observation log entry — worth logging a correction, pattern,
or skill gap?") and reset `writesSinceLastObservation` to 0 (nags every 5th
untracked write, not every write past the threshold). Stays reminder-based
(not auto-write) since "is this insight-worthy" is a judgment call, but it's
now tied to a real event count rather than a vague "remember to."

**`hooks/pre-principles-injection.js`** — `PreToolUse`, matcher
`Edit|Write|MultiEdit`, filtered to file paths matching `**/SKILL.md`. Reads
`.wolf/cross-cutting-principles.md` and injects its content as
`additionalContext` — mirrors `subagent-thin-harness.js`'s injection pattern.
No-ops silently if the file doesn't exist yet or is empty. Triggers on the
file being edited, not on which meta-skill (if any) is invoking the edit —
covers direct small edits (the common case per the two-tier design), edits
following `writing-skills`, and new-skill creation (`Write` to a fresh
`SKILL.md`) with one mechanism. No separate `Skill`-invocation trigger: the
file-path match already fires at the same effective moment (first draft
write) a `Skill`-trigger would, so a second trigger would be redundant
coverage of the same event, not complementary.

All three follow existing conventions: session-ID validated against
`/^[A-Za-z0-9._-]+$/` before path use, marker/state files cleaned up by the
existing stale-marker sweep in `session-start.sh` (extend its glob to include
`_writecount-*.json`).

### `.wolf/cross-cutting-principles.md`

Starts as the empty template:

```markdown
# Cross-Cutting Principles

Principles that apply to all skills. Read as a mandatory checklist during
any skill creation or regeneration.

---

## Active Principles

(none yet)
```

Populated only through the review step below (never auto-written) — an
observation's Principle field gets promoted here when `session-reflect`'s
review judges it generalizes across skills, using the same entry shape
task-observer uses (`### N. [title]`, Added/Applies-to/Requirement/
Propagation/Status).

### `session-reflect/SKILL.md` changes

**Phase 1 additions:**
- After the existing pattern-capture step: check `observations.md` for OPEN
  `compaction-checkpoint`/`write-batch-checkpoint` entries from *this*
  session; enrich them with real content if the session produced any, else
  resolve DECLINED via the script.
- New-skill-candidate check: alongside the existing "1-3 high-signal
  patterns" question, explicitly ask "was there a repeating 3+-step manual
  workflow this session that no skill covers?" — if yes, pipe a
  `type: new-skill-candidate` payload to `wolf-observation-log.js append`
  (flag only, never auto-create the skill, matching task-observer's own "the
  observer doesn't modify your skills directly" rule).

**New step (after existing Phase 2):**
- Review-cadence fallback: read `.wolf/observations-last-review.txt`. If
  `never` or >7 days old AND there are OPEN entries in `observations.md`,
  offer one line: "The skill-observation backlog hasn't been reviewed [in N
  days / yet] — run it now, or wrap up?" Never gate on it.
- If accepted:
  1. Run `wolf-observation-log.js archive` first — moves entries resolved
     before today into `.wolf/observations-archive/log-[date].md`, so the
     review works from a clean active log.
  2. Enumerate OPEN entries (all `### Observation N:` headers minus
     ACTIONED/DECLINED — never filter by grepping the Status field alone,
     since that silently drops statusless entries, another
     task-observer-documented failure mode), cross-check each against the
     skill(s) it names. For each:
     - **Small additive** (new rule, clarification, factual fix): show
       inline diff, apply on approval, write live — identical shape to the
       existing Phase-2 CLAUDE.md pattern.
     - **Substantial** (restructuring, new capability, any
       new-skill-candidate the user wants to build): hand off to
       `github-issue-first` to file the issue, then the normal
       `using-git-worktrees → test-driven-development →
       verification-before-completion → requesting-code-review` pipeline —
       no new mechanism, reuse of what already exists.
     - Mark each applied/declined observation via `resolve`, with today's
       date (load-bearing for the archival grace period — a dateless mark
       would never archive).
  3. Write today's date to `observations-last-review.txt`.

**Bootstrap**: `wolf-init/SKILL.md` gains a step after its existing
`openwolf init` call that creates `observations.md`,
`cross-cutting-principles.md`, and `observations-last-review.txt` (seeded
`never`) directly via Write if missing — `openwolf init` only creates its own
fixed file set and has no way to know about these. Since `~/.claude` is
already initialized and won't have `wolf-init` re-run on it, these three
files are created directly as a one-time step during implementation of this
design, rather than waiting on a `wolf-init` re-run that will never happen
here.

### CLAUDE.md changes

Add one row to Section 3 (Infrastructure Layer) documenting: the new files
and their ownership boundary vs. `cerebrum.md`/`memory.md` (daemon-owned via
`openwolf init`/the weekly `cerebrum-reflection` cron — do not restructure);
the two-tier skill-edit rule (small→inline-approve-live, substantial→existing
issue/worktree/PR pipeline); a pointer to `observations.md`'s numbering
discipline being script-enforced (JSON-via-stdin `append`/`resolve`/`archive`),
not prose-enforced.

## Error handling / edge cases

- **Concurrent writes**: handled by the append/resolve script's
  check-then-act-then-verify discipline (see script section above) — same
  pattern `pre-skill-gate.js`/`post-skill-record.js` already use for
  per-(session,skill) markers, extended to a genuinely shared multi-entry
  file.
- **Ephemeral worktrees**: the append script refuses to write when `cwd`
  resolves under `.claude/worktrees/` (or similar), consistent with the
  CLAUDE.md-documented worktree-path-isolation risk.
- **Hook failures**: every new hook fails open — a script error produces a
  stderr warning, never a blocked tool call. Only the pre-existing
  `pre-skill-gate.js` intentionally blocks; nothing new in this design adds
  a second blocking gate.
- **Missing files on fresh clone**: bootstrap step covers this (see above).
- **Stale ephemeral markers**: `_writecount-<session>.json` swept by the
  existing `session-start.sh` stale-marker cleanup, glob extended.
- **openwolf daemon interaction**: none — confirmed, not assumed.
  `config.json`'s `anatomy.exclude_patterns` excludes `.wolf` from
  `openwolf scan` entirely, and every `cron-manifest.json` job targets an
  explicit hardcoded file list rather than discovering files dynamically, so
  no existing openwolf mechanism can ever touch, contest, or rewrite
  `observations.md`/`cross-cutting-principles.md`.
- **Unbounded log growth**: handled by the `archive` subcommand, run at the
  start of each periodic review — resolved entries older than today move to
  dated archive files, keeping the active log to OPEN entries plus anything
  resolved today.

## Testing

- `post-compact-observation.test.js`, `post-write-batch-nudge.test.js`,
  `pre-principles-injection.test.js` — unit tests matching the existing
  `pre-skill-gate.test.js`/`post-skill-record.test.js` shape (construct hook
  JSON input, assert on stdout/marker-file effects).
- `wolf-observation-log.test.js` — numbering discipline under normal append;
  simulated concurrent-append collision (two appends racing, assert both
  survive with distinct sequential numbers); `resolve` line-anchoring test
  (assert a status update to entry N never touches entry N+1's Status line,
  and header count is unchanged before/after); `archive` test (entries
  resolved yesterday move out, entries resolved today stay, archive file
  preserves entry text verbatim); worktree-path refusal test; malformed-JSON
  stdin input to `append` fails loudly rather than corrupting the log.
- Manual verification pass (per `verification-before-completion`): trigger an
  actual context compaction and confirm exactly one placeholder lands in
  `observations.md` even if compaction fires more than once in the session;
  make 5 real edits in a session and confirm the nudge fires once; run
  `session-reflect` with a stale review marker and confirm the one-line offer
  appears and, on accept, walks through both the small-fix and
  substantial-change branches against a synthetic observation of each type,
  and archives a back-dated resolved entry correctly.

## Out of scope

- Open-source/internal taxonomy, licensing/attribution blocks, confidentiality
  sweeps — task-observer needs these because it's designed for skills that get
  published; none of this repo's skills are published, so this machinery is
  dropped entirely rather than ported.
- Any new scheduler/cron integration (openwolf's daemon or Claude Code's
  `CronCreate`) — explicitly rejected in favor of the in-session fallback.
- A staging-folder mechanism for skill installs — explicitly rejected in
  favor of reusing the existing issue/worktree/PR pipeline for substantial
  changes.
- Porting task-observer as a standalone always-on skill — its watching
  behavior is distributed into hooks (enforcement) and `session-reflect`
  (synthesis) instead, per the "thin harness, fat skills" philosophy and the
  concrete evidence that prose-based watching already fails in this repo.
