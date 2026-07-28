# Validation Checklist (Phase 6)

Run only after explicit user go-ahead (see SKILL.md's Phase 5 pause) —
every check below that dispatches an `Agent` call is real,
team-size-multiplied cost.

## 1. Trigger verification (free — no dispatch)

For each generated skill:
- [ ] Does its `description` contain the exact trigger phrasing a real
      user request would use?
- [ ] Pick one plausible *near-miss* phrase (a request that sounds
      similar but should route elsewhere) and confirm the description
      doesn't accidentally match it too

## 2. Dry-run dispatch (real cost — one per agent)

For each generated agent:
- [ ] Dispatch one real `Agent` call using its definition and a minimal
      representative prompt
- [ ] Confirm it completes without error and its output roughly matches
      what the role description promises
- [ ] If it fails, fix the agent definition (not the test) and re-run
      once — don't loop indefinitely

## 3. With-skill vs. without-skill comparison (optional, higher cost)

For a generated skill whose value is hard to judge from reading it alone:
- [ ] Run the same representative task once with the skill available and
      once without (a scratch session with the skill temporarily
      unavailable)
- [ ] Confirm the skill version is meaningfully better — if it isn't, the
      skill may be adding ceremony without adding value; reconsider
      before keeping it

## 4. QA-role boundary check

For any QA/reviewer agent generated (see `qa-agent-guide.md`):
- [ ] Confirm its definition instructs reading both sides of its
      boundary in one pass, not independent existence checks
- [ ] Dry-run it against a deliberately introduced mismatch if one is
      easy to construct — confirm it catches it

## Reporting

Summarize pass/fail per agent and skill, not just an overall verdict — a
partial failure (4 of 5 agents validated clean) should be reported as
such, not rounded up to "validation passed."
