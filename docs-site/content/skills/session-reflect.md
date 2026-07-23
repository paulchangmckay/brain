---
title: "session-reflect"
description: "Use at the end of any substantive coding session — captures patterns, mistakes, and decisions into .wolf/cerebrum.md, and conditionally updates CLAUDE.md with project context worth preserving for the team"
---

# Session Reflect Skill

End-of-session audit with three phases. Phase 1 (cerebrum) always runs automatically. Phase 2 (CLAUDE.md) runs only when something team-worthy was learned. Phase 3 (skill observation review) runs on a 7-day fallback cadence.

## Phase 1: Cerebrum Update (always)

1. **Check OpenWolf active**
   ```bash
   ls .wolf/memory.md 2>/dev/null && echo "ACTIVE" || echo "NO_WOLF"
   ```
   If NO_WOLF: report skip, proceed to Phase 2 anyway.

2. **Read the session log**
   Read `.wolf/memory.md` — focus on entries from today's date.

3. **Identify patterns worth remembering**
   - Mistake that cost time? → Do-Not-Repeat
   - Non-obvious decision with good rationale? → Decision Log
   - User expressed style/tool/approach preference? → User Preferences
   - Bug fixed that might recur? → buglog.json

   Aim for 1–3 high-signal entries. Zero is fine for routine sessions.

4. **Append to `.wolf/cerebrum.md`** (read first, then append only new entries):
   ```markdown
   ## Do-Not-Repeat
   - YYYY-MM-DD: <specific mistake or anti-pattern to avoid>

   ## User Preferences
   - YYYY-MM-DD: <preference expressed this session>

   ## Key Learnings
   - YYYY-MM-DD: <project convention or non-obvious behavior discovered>

   ## Decision Log
   - YYYY-MM-DD: <decision made and why>
   ```
   Keep entries specific and dated. Vague entries decay in value; precise ones compound.

5. **Update buglog.json for any newly fixed bugs**
   If a bug was fixed with a reusable fix pattern, append to `.wolf/buglog.json`:
   ```json
   {
     "id": "bug-<next-number>",
     "error_message": "<exact error text>",
     "file": "<file/path.ts>",
     "root_cause": "<why it happened>",
     "fix": "<what was changed>",
     "tags": ["<category>"],
     "occurrences": 1,
     "last_seen": "<ISO date>"
   }
   ```

6. **Resolve this session's observation-log checkpoints**
   Check `.wolf/observations.md` for OPEN `compaction-checkpoint` or
   `write-batch-checkpoint` entries whose `**Session:**` field matches this
   session. For each: if the session produced a real insight worth keeping,
   resolve it as ACTIONED and fold the content into a proper entry via
   `node scripts/wolf-observation-log.js append` (with a `skill-improvement`
   or `new-skill-candidate` type as appropriate); otherwise resolve DECLINED:
   ```bash
   node scripts/wolf-observation-log.js resolve <N> DECLINED "nothing to log this session"
   ```

7. **Check for a new-skill candidate**
   Ask: "was there a repeating 3+-step manual workflow this session that no
   existing skill covers?" If yes, log it — flag only, never create the
   skill automatically:
   ```bash
   echo '{"type":"new-skill-candidate","skill":"New skill candidate: <working name>","issue":"<what the repeating workflow was>","improvement":"<what a skill for this would need to cover>","principle":"<why this generalizes beyond this session>"}' | node scripts/wolf-observation-log.js append
   ```

## Phase 2: CLAUDE.md Audit (conditional)

8. **Assess — did this session reveal anything CLAUDE.md-worthy?**
   Ask: "Would a future Claude session working in this project be helped by knowing this?"
   - New commands or build/test invocations discovered?
   - Environment or configuration gotchas?
   - Non-obvious code patterns or conventions?
   - Warnings or constraints that apply project-wide?

   If none of the above: skip to step 11.

9. **Find CLAUDE.md files**
   ```bash
   find . -name "CLAUDE.md" -o -name ".claude.local.md" 2>/dev/null | head -20
   ```
   Decide per addition: `CLAUDE.md` (team-shared, checked into git) vs `.claude.local.md` (personal, gitignored).

10. **Draft additions and get approval**
    One line per concept. Format: `<command or pattern>` — `<brief description>`
    Avoid verbose explanations, obvious info, one-off fixes unlikely to recur.

    Present as diffs before writing:
    ```
    ### Update: ./CLAUDE.md
    **Why:** [one-line reason]
    + [the addition]
    ```
    Apply only changes the user approves.

## Phase 3: Skill Observation Review (conditional, 7-day fallback)

11. **Check whether a review is due**
    ```bash
    cat .wolf/observations-last-review.txt 2>/dev/null || echo never
    ```
    If the value is `never` or the date is more than 7 days old, AND
    `.wolf/observations.md` has at least one `### Observation` header whose
    Status is not ACTIONED/DECLINED (statusless entries count as OPEN — never
    filter by grepping for the literal string `OPEN`, since that silently
    drops entries missing a Status line): offer one line — "The
    skill-observation backlog hasn't been reviewed [in N days / yet] — run it
    now, or wrap up?" Never gate the user's task on this; proceed either way.

12. **If the user accepts the review:**
    a. Archive first:
       ```bash
       node scripts/wolf-observation-log.js archive
       ```
    b. Enumerate the remaining OPEN entries and cross-check each against the
       skill(s) it names.
    c. For each entry:
       - **Small additive** (new rule, clarification, factual fix): show an
         inline diff of the proposed SKILL.md change, apply on approval,
         write live — same shape as the Phase 2 CLAUDE.md pattern above.
       - **Substantial** (restructuring, new capability, or any
         new-skill-candidate the user wants to build): hand off to the
         `github-issue-first` skill to file the issue, then the normal
         `using-git-worktrees → test-driven-development →
         verification-before-completion → requesting-code-review` pipeline.
       - Mark the entry via `node scripts/wolf-observation-log.js resolve <N> ACTIONED "<what was applied>"`
         or `... DECLINED "<why not>"`.
    d. Write today's date to `.wolf/observations-last-review.txt`.

## Step 13: Report

```
Session reflect complete:
- cerebrum.md: N entries added [or: no high-signal patterns this session]
- buglog.json: [updated / not updated]
- CLAUDE.md: [M additions applied / nothing team-worthy this session]
- observations.md: [K entries resolved / review skipped or not due]
Most important learning: <one sentence>
```
