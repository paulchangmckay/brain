# Bloat/debt tooling inspired by ponytail

**Status:** Approved, grilled
**Date:** 2026-07-15

## Context

Reviewed [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail), a
cross-agent "lazy senior dev" skill that enforces a YAGNI/stdlib/native-first ladder
before writing code, benchmarked at -54% LOC / -22% tokens / -20% cost / -27% time
against a no-skill baseline with safety held constant. Its core ladder overlaps
with discipline already in `CLAUDE.md` §"Doing tasks", so it isn't worth importing
wholesale. Three structural pieces are genuine gaps in this repo and are worth
adopting independently:

1. A comment-marker convention for deliberate shortcuts, harvested into a ledger
   (ponytail's `ponytail:` marker + `/ponytail-debt`) — this repo has no equivalent;
   `.wolf/buglog.json` tracks fixed bugs, `.wolf/cerebrum.md` tracks narrative
   learnings, neither tracks a known, deliberate, still-open corner cut in code.
2. A whole-repo (not diff-scoped) over-engineering audit (ponytail's
   `/ponytail-audit`) — this repo's only repo-wide audit capability is
   `senior-engineering-partner`'s `AUDIT:` mode, which is explicitly
   security/reliability-scoped, not bloat-scoped.
3. Propagating core discipline into Task-spawned subagents — ponytail hit and fixed
   exactly this bug (issue #252): `SessionStart` context never reaches subagents.
   Confirmed this repo has the identical gap: `settings.json` has no
   `SubagentStart` hook, only a telemetry-only `SubagentStop` hook.

## 1. `wolf-debt:` deliberate-shortcut convention

### Marker syntax

```
# wolf-debt: <ceiling>, <upgrade trigger>
// wolf-debt: <ceiling>, <upgrade trigger>
```

Example: `# wolf-debt: global lock, per-account locks if throughput matters`

Named `wolf-debt` (not `ponytail` or bare `debt`) to read as part of the existing
`.wolf/` namespace (`anatomy.md`, `buglog.json`, `cerebrum.md`, `memory.md`)
alongside the marker's harvester skill.

### CLAUDE.md change

Add one bullet to the existing "Doing tasks" list (§ near "Don't add features,
refactor, or introduce abstractions beyond what the task requires"):

> When deliberately cutting a real corner with a known ceiling (naive algorithm,
> global lock, skipped edge case), leave a `wolf-debt: <ceiling>, <upgrade
> trigger>` comment naming both — don't let a deferred shortcut silently become
> permanent.

### `debt-ledger` skill

New file: `skills/debt-ledger/SKILL.md`.

- **Frontmatter:** `name`, `description` only (matches repo convention — no
  `argument-hint`/intensity levels, those appear in only 3 skills repo-wide and
  aren't needed here).
- **Trigger phrases:** "wolf-debt", "what debt do we have", "list deferred
  shortcuts", "debt ledger".
- **Behavior:**
  1. `grep -rnE '(#|//) ?wolf-debt:' .` excluding `.git`, `node_modules`, and
     every submodule path read dynamically from `.gitmodules` at scan time (not
     hardcoded — so a future submodule addition can't silently go unexcluded).
     `bloat-audit` (below) uses the same exclusion logic for its own repo-wide
     scan.
  2. One row per hit, grouped by file: `<file>:<line>, <what was simplified>.
     ceiling: <X>. upgrade: <trigger>.`
  3. **Syntax-only trigger check:** a marker is `no-trigger` purely if there's no
     comma-separated second clause after the ceiling — the harvester does not
     judge whether the named trigger is a *good* one (e.g. "will fix later"
     still counts as present). Keeps the skill mechanical: presence, not
     quality.
  4. Ends with `<N> markers, <M> with no trigger.` or, if none found, `No
     wolf-debt: markers. Clean ledger.`
- **Boundaries:** read-only, changes nothing. Persisting to `.wolf/debt.md` only
  happens if the user explicitly asks; otherwise the report is ephemeral output.
  One-shot — no session-scoped state, no hook.

## 2. `bloat-audit` skill

New file: `skills/bloat-audit/SKILL.md`.

- **Frontmatter:** `name`, `description` only.
- **Trigger phrases:** "audit this codebase for over-engineering", "what can I
  delete from this repo", "find bloat", "bloat audit".
- **Explicitly out of scope** (stated in the skill body, mirroring
  `senior-engineering-partner`'s existing scope-discipline style): correctness
  bugs, security holes, and performance. Route those to
  `senior-engineering-partner`'s `AUDIT:` mode or `/code-review` instead — this
  skill only hunts complexity.
- **Tags** (same five as ponytail's, since they're already a clean, minimal
  taxonomy — no reason to invent new ones):
  - `delete:` dead code, unused flexibility, speculative feature — replacement: nothing.
  - `stdlib:` hand-rolled thing the standard library already ships.
  - `native:` dependency/code doing what the platform already does.
  - `yagni:` single-implementation abstraction, unset config, one-caller layer.
  - `shrink:` same logic, fewer lines — show the shorter form.
- **Output:** one line per finding, ranked biggest cut first:
  `<tag> <what to cut>. <replacement>. [path]`. Ends with `net: -N lines, -M deps
  possible.`, or `Lean already. Ship.` if nothing qualifies.
- **Boundaries:** whole-repo, read-only, one-shot. Lists findings, applies
  nothing. Dependency-bloat findings (unused/redundant deps) are model-judgment
  based — reads `package.json`/`requirements.txt`/imports and reasons about
  them, same as ponytail-audit itself. No new tool dependency (`depcheck` etc.)
  — would only cover JS anyway, and this repo also has Python/bash/skill-file
  content such a tool can't see.
- **Cross-reference (two-way):** this skill's boundaries section states that
  correctness/security/performance route to `senior-engineering-partner`'s
  `AUDIT:` mode instead. `senior-engineering-partner`'s `AUDIT:` section also
  gets one added line noting that pure complexity/bloat findings route to
  `bloat-audit`, so a bare "audit this repo" isn't ambiguously answered by
  whichever skill's description happens to match first.

## 3. Subagent rule propagation

### New digest file

`hooks/subagent-thin-harness.md` — a short (5-8 bullet), standalone digest of the
core code-quality rules a subagent needs (condensed from CLAUDE.md §"Doing tasks"):
no premature abstraction, YAGNI, reuse over rewrite, the `wolf-debt:` convention,
no unnecessary error handling/fallbacks. Kept deliberately short since the
decision was "core rules only," not the full CLAUDE.md.

Add a one-line note in CLAUDE.md §"Doing tasks" pointing at this file so a future
edit to the bullet list prompts a check of the digest too. Not a scripted sync
check (ponytail needed one because it has ~15 duplicated rule-copies across agent
surfaces; this repo would only have one duplicate) — `session-reflect`'s existing
periodic CLAUDE.md audit is the backstop against drift.

### New hook: `hooks/subagent-thin-harness.js`

- Registered on a new `SubagentStart` event in `settings.json` (no existing
  entry for this event — confirmed).
- Reads `agent_type` from the hook's stdin JSON payload.
- Skips injection (exits 0, no output) for read-only agent types: `Explore` and
  any `understand-anything:*` analyzer — they never write code, so the ruleset is
  pure token waste for them.
- For every other agent type (`general-purpose`, `Plan`, `claude`, custom
  `Agents/*` types, etc.), reads `subagent-thin-harness.md` and emits it as
  `hookSpecificOutput.additionalContext`, matching the existing hook
  output-shape convention already used by `pre-skill-gate.js`/`post-skill-record.js`.
- Fail-open on any error (unparseable stdin, unknown agent_type): inject the
  digest anyway rather than silently drop the ruleset — same philosophy the
  existing hooks use ("never block the session"). If reading
  `subagent-thin-harness.md` itself throws (moved/typo'd), fall back to a small
  hardcoded 2-3 line digest embedded directly in the hook file ("no premature
  abstraction, YAGNI, reuse before rewrite") so "fail-open" is actually true in
  every failure mode, not just the ones where the file read succeeds.
- No session-scoped marker files, no dependency on session_id propagation
  behavior — the hook only needs the per-invocation `agent_type` field, which is
  a much smaller and more reliable surface than the skill-gate's session-scoped
  markers.

### Testing

Given `verification-before-completion` requires evidence, not assertions: after
wiring the hook, spawn one `Explore` subagent and one `general-purpose` subagent
in the same session, each prompted to state as its first line whether it was
given any instructions about `wolf-debt:` or a thin-harness ruleset before its
actual task. Confirm the `general-purpose` one reports receiving it and the
`Explore` one does not — direct behavioral evidence from the subagent itself,
not an assumption about hook plumbing or reliance on a debug log the harness
may not expose.

## Testing (all three pieces)

Each piece gets one runnable check per `wolf-debt:`'s own "lazy code without its
check is unfinished" idea, applied to this repo's actual conventions:

- `debt-ledger`: seed one `wolf-debt:` marker (with a trigger) and one malformed
  one (no trigger) in a scratch file, run the skill, confirm both rows appear and
  the malformed one is tagged `no-trigger`.
- `bloat-audit`: run it against this repo once as a smoke test and sanity-check
  the output shape (even if the repo is already lean and it reports `Lean
  already. Ship.`).
- Subagent propagation: the Explore-vs-general-purpose comparison above.

## Discoverability

Neither skill is added to CLAUDE.md §2's process gate table. That table is
reserved for the sequential brainstorm→plan→build→review pipeline; ad-hoc
audit/cleanup tools already in this repo (`code-review`, `simplify`) are
deliberately *not* in it, discoverable purely via their own SKILL.md
description/trigger phrases instead. `debt-ledger` and `bloat-audit` are the
same shape — one-shot, no gating relationship to any other skill — so they
follow the same precedent.

## Out of scope

- No intensity levels (lite/full/ultra) for either skill — not requested, and no
  existing skill in this repo uses that pattern.
- No cross-agent portability (Cursor rules, Windsurf rules, `AGENTS.md`, etc.) —
  this repo is Claude Code only.
- No automatic (hook-triggered) debt-ledger updates — on-demand only, per
  decision above.
