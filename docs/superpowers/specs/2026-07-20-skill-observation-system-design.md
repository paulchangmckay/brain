# Skill Observation System (OpenWolf enhancement)

**Status:** Approved, pending grilling
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
- **openwolf CLI/daemon is third-party and black-box** — global npm package
  (`openwolf@1.0.4`), PM2-managed per-project daemon. Configurable around
  (`.wolf/config.json`, PM2, CLI subcommands) but not a safe extension point
  for our own logic — confirmed via package inspection, not assumed.

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

## Design

### File layout (new files)

```
.wolf/
├── observations.md                  # new — numbered/status-tracked log
├── cross-cutting-principles.md      # new — checklist, starts empty
├── observations-last-review.txt     # new — "never" or ISO date
└── _writecount-<session>.json       # new — ephemeral per-session marker

scripts/
└── wolf-observation-log.js          # new — append/resolve helper

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

- **`append --type T --skill S --issue "..." --improvement "..." --principle "..." [--status OPEN]`**
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

Both subcommands back up `observations.md` to `.observations.md.bak` before
any write and are covered by unit tests, including a simulated concurrent-append
test (two rapid appends against the same file, assert both survive with
distinct numbers).

### Hooks

**`hooks/post-compact-observation.js`** — `PostCompact`. Calls
`wolf-observation-log.js append --type compaction-checkpoint --skill
"session" --issue "Compaction occurred; context may contain unlogged
insights" --improvement "Review this session's work and either enrich this
entry or resolve DECLINED if nothing generalizes" --principle "" --status
OPEN`. Deterministic — runs regardless of whether Claude does anything with
it. Fails open (logs a warning to stderr, doesn't block) if the script
errors.

**`hooks/post-write-batch-nudge.js`** — `PostToolUse`, matcher
`Write|Edit|MultiEdit`. Maintains `.wolf/_writecount-<session>.json`
(`{count, lastObservationCount}`) — increments `count` on every matching
call. After each call, compares current `### Observation` header count in
`observations.md` against `lastObservationCount`; if unchanged and `count -
countAtLastNudge >= 5`, injects a non-blocking `additionalContext` reminder
("5 file changes since the last observation log entry — worth logging a
correction, pattern, or skill gap?") and resets the threshold counter. This
one stays reminder-based (not auto-write) since "is this insight-worthy" is
a judgment call, but it's now tied to a real event count rather than a vague
"remember to."

**`hooks/pre-principles-injection.js`** — `PreToolUse`, matcher `Skill`,
filtered to skill name `writing-skills` (and `skill-creator` if invoked
directly). Reads `.wolf/cross-cutting-principles.md` and injects its content
as `additionalContext` — mirrors `subagent-thin-harness.js`'s injection
pattern. No-ops silently if the file doesn't exist yet or is empty.

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
  workflow this session that no skill covers?" — if yes, `append --type
  new-skill-candidate` (flag only, never auto-create the skill, matching
  task-observer's own "the observer doesn't modify your skills directly"
  rule).

**New step (after existing Phase 2):**
- Review-cadence fallback: read `.wolf/observations-last-review.txt`. If
  `never` or >7 days old AND there are OPEN entries in `observations.md`,
  offer one line: "The skill-observation backlog hasn't been reviewed [in N
  days / yet] — run it now, or wrap up?" Never gate on it.
- If accepted: enumerate OPEN entries (all `### Observation N:` headers minus
  ACTIONED/DECLINED — never filter by grepping the Status field alone, since
  that silently drops statusless entries, another task-observer-documented
  failure mode), cross-check each against the skill(s) it names. For each:
  - **Small additive** (new rule, clarification, factual fix): show inline
    diff, apply on approval, write live — identical shape to the existing
    Phase-2 CLAUDE.md pattern.
  - **Substantial** (restructuring, new capability, any new-skill-candidate
    the user wants to build): hand off to `github-issue-first` to file the
    issue, then the normal `using-git-worktrees → test-driven-development →
    verification-before-completion → requesting-code-review` pipeline — no
    new mechanism, reuse of what already exists.
  - Mark each applied/declined observation via `resolve`, with today's date.
  - Write today's date to `observations-last-review.txt`.

`wolf-init` (or `session-start.sh`, whichever currently bootstraps `.wolf/`)
gains creation of `observations.md`, `cross-cutting-principles.md`, and
`observations-last-review.txt` (seeded `never`) if missing — same pattern as
the existing bootstrap for `anatomy.md`/`cerebrum.md`/`buglog.json`.

### CLAUDE.md changes

Add one row to Section 3 (Infrastructure Layer) documenting: the two new
files and their ownership boundary vs. `cerebrum.md`/`memory.md` (daemon-owned,
do not restructure); the two-tier skill-edit rule (small→inline-approve-live,
substantial→existing issue/worktree/PR pipeline); a pointer to
`observations.md`'s numbering discipline being script-enforced, not
prose-enforced.

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
- **openwolf daemon interaction**: none — the daemon never reads or writes
  the new files, so no conflict is possible by construction.

## Testing

- `post-compact-observation.test.js`, `post-write-batch-nudge.test.js`,
  `pre-principles-injection.test.js` — unit tests matching the existing
  `pre-skill-gate.test.js`/`post-skill-record.test.js` shape (construct hook
  JSON input, assert on stdout/marker-file effects).
- `wolf-observation-log.test.js` — numbering discipline under normal append;
  simulated concurrent-append collision (two appends racing, assert both
  survive with distinct sequential numbers); `resolve` line-anchoring test
  (assert a status update to entry N never touches entry N+1's Status line,
  and header count is unchanged before/after); worktree-path refusal test.
- Manual verification pass (per `verification-before-completion`): trigger an
  actual context compaction and confirm a placeholder lands in
  `observations.md`; make 5 real edits in a session and confirm the nudge
  fires once; run `session-reflect` with a stale review marker and confirm
  the one-line offer appears and, on accept, walks through both the
  small-fix and substantial-change branches against a synthetic observation
  of each type.

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
