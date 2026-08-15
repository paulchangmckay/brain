# Cross-Session Recurring-Pattern Detection

**Date:** 2026-08-14
**Status:** Approved, pending grilling + implementation plan

## Problem

`session-reflect` already has an end-to-end path from "flagged pattern" to
"new skill, PR-gated": Phase 1 asks, per session, whether a 3+-step workflow
repeated *within that session* with no covering skill, and logs a
`new-skill-candidate` observation if so. Phase 3 (the 7-day periodic review)
routes such observations through a two-tier rule — small additive changes
get an inline, approval-gated diff; substantial changes (new skill, skill
restructuring) go through `github-issue-first` → worktree → `writing-skills`
→ PR. This already produced a real skill once: Observation 16 → issue #34 →
`verify-sdk-api`.

The gap: nothing detects a pattern that recurs *across* sessions. Phase 1
only evaluates the single session it's running in. If the same friction
shows up once in session A, again in session B a week later, and again in
session C, nothing connects those occurrences or escalates the signal —
each gets logged (if at all) as an independent, easily-dismissed
first-time observation.

## Goal

Add cross-session recurrence detection to `session-reflect` Phase 3, and
widen what a recurring pattern can be routed toward — not just new-skill
proposals, but also cerebrum.md Do-Not-Repeat entries and CLAUDE.md
additions, reusing the approval gates that already exist for each.

## Non-goals

- No new schedule. This rides on Phase 3's existing 7-day fallback trigger
  (`.wolf/observations-last-review.txt`) — not a separate cron or hook.
- No bypass of any existing approval gate. Recurrence evidence makes
  escalation *more likely to be judged warranted*; it never triggers an
  automatic write or automatic PR merge.
- No new observation `type`. Recurrence is evidence attached to an
  existing type (`skill-improvement`, `new-skill-candidate`,
  `cross-cutting-principle`), not a new category of its own.
- No deterministic fuzzy-matching / string-similarity code. Detection is
  the agent's own judgment during the Phase 3 review, consistent with how
  this repo already keeps synthesis in the agent rather than in scripts
  (mirrors the `MemoryService`-style split evaluated when comparing
  against memU: storage/retrieval mechanisms are deterministic, judgment
  stays with the agent).
- Does not touch Phase 1's single-session flagging logic, `writing-skills`
  itself, or `github-issue-first` itself — this design only adds a
  detection step ahead of the routing decision Phase 3 already makes, and
  widens the set of valid small-additive targets.

## Architecture

Add a new sub-step to `session-reflect` Phase 3, run **before** the
existing "cross-check each OPEN entry against named skill(s)" step. For
every entry under review (remaining OPEN observations, including any
logged this session by Phase 1), the agent additionally scans:

1. `.wolf/observations-archive/*.md` — previously resolved entries
   (ACTIONED or DECLINED). An entry recurring *despite* already being
   resolved is a stronger signal than a fresh one, not a weaker one — it
   means the earlier resolution didn't stick.
2. `.wolf/buglog.json` — bug entries and their existing `occurrences`
   counts.
3. Current `.wolf/cerebrum.md` — Do-Not-Repeat, Key Learnings, Decision
   Log sections, read as a **live snapshot only**. `cerebrum.md` is
   wholesale-rewritten weekly by the `cerebrum-reflection` cron, so there
   is no stable history to diff against — the scan compares against
   "what cerebrum currently says," never against an older revision.

The agent judges, semantically and without new matching code, whether the
entry under review is substantially the same friction/pattern as
something already present in this corpus. This reuses Phase 3's existing
agent-driven review; it does not add a new automated pass.

## Data / schema change

`scripts/wolf-observation-log.js`'s `append` command gains one new
optional stdin field:

```js
{ type, skill, issue, improvement, principle, evidence, status, session, title }
```

`evidence` is free-text, subject to the same header-injection guard
already applied to `issue`/`improvement`/`principle` (rejects any field
containing a line matching `### Observation N:`). It renders as a new
line in the observation block, after `**Principle:**`:

```
**Evidence:** <free text>
```

Example: `**Evidence:** Recurs: Observation #4 (DECLINED 2026-07-20),
buglog bug-142 (2 occurrences), cerebrum Do-Not-Repeat line 12`.

`evidence` is populated only when the Phase 3 recurrence scan finds a
match. It is absent (rendered as before, no new blank line) for
first-time observations — this keeps the change purely additive for the
common case.

`wolf-observation-log.test.js` gets new cases: append with `evidence`
present, append without it (unchanged rendering), and the header-injection
guard applied to the new field.

## Routing

Once an entry carries `evidence`, Phase 3 classifies it using the exact
two-tier rule it already applies — this design widens the **target set**
for the small-additive tier, not the gate mechanism itself:

- **Small additive** (a new Do-Not-Repeat bullet, a one-line skill
  clarification, a CLAUDE.md note) → inline diff, approval-gated, written
  live. Today this only ever produces a SKILL.md diff; this design
  extends it to also allow:
  - a cerebrum.md Do-Not-Repeat append, using the same append-only
    mechanism Phase 1 already uses (cerebrum.md is still never
    restructured directly — only appended to, per existing rules)
  - a CLAUDE.md addition, using the same diff-and-approve mechanism
    Phase 2 already uses
- **Substantial** (new skill, skill restructuring) → `github-issue-first`
  → `using-git-worktrees` → `writing-skills` → PR, unchanged from today.
  The issue body now includes the `evidence` field as its "why now"
  citation, giving the issue a concrete recurrence citation instead of a
  single anecdote.

Which target (SKILL.md / cerebrum.md / CLAUDE.md / new skill) applies is
decided by where the match was found and the nature of the pattern — a
recurring factual gotcha routes toward CLAUDE.md or cerebrum.md, a
recurring workflow gap routes toward a skill. This judgment call is made
by the agent during Phase 3, the same way it already judges which
existing tier an observation belongs to.

## Error handling / edge cases

- **Empty corpus** (fresh repo, no archive yet): the scan finds nothing;
  Phase 3 behaves exactly as it does today. The change is purely additive
  and degrades gracefully to current behavior.
- **cerebrum.md instability**: addressed by treating it as a live
  snapshot only (see Architecture, point 3) — never as a history to diff.
- **Recurrence despite existing resolution**: an entry matching something
  already ACTIONED in the archive, or already present in cerebrum's
  Do-Not-Repeat, is surfaced explicitly in the evidence string as the
  strongest form of signal (the prior fix didn't hold).
- **False-positive recurrence judgment**: no different in kind from any
  other Phase 3 classification call made today — caught at the same
  approval gate (inline diff review, or PR review) that already exists.
  This design adds no new trust surface beyond what Phase 3 already has.

## Testing

- `wolf-observation-log.test.js`: TDD coverage for the `evidence` field
  (append with/without it, rendering, header-injection guard) — ordinary
  script-level TDD, same discipline as the rest of that file.
- The Phase 3 semantic-scan behavior is skill prose, not independently
  unit-testable. Validated the way the rest of `session-reflect`'s phases
  already are: run it, and check the completion report it produces at the
  end of the review.

## Relationship to the memU evaluation

This design originated from comparing against memU's "skill extraction"
feature (session transcripts → distilled skill Markdown, mined
automatically). The comparison found the extraction *pipeline* already
exists here end-to-end (Phase 1 flag → Phase 3 review → `github-issue-first`
→ `writing-skills` → PR, proven by Observation 16 → `verify-sdk-api`); the
actual gap was narrower — no cross-session recurrence signal feeding that
pipeline. This design closes exactly that gap without adopting memU or its
cloud/embedding dependencies.
