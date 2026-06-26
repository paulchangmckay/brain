---
name: session-reflect
description: Use at the end of any substantive coding session — captures patterns, mistakes, and decisions into .wolf/cerebrum.md, and conditionally updates CLAUDE.md with project context worth preserving for the team
---

# Session Reflect Skill

End-of-session audit with two phases. Phase 1 (cerebrum) always runs automatically. Phase 2 (CLAUDE.md) runs only when something team-worthy was learned.

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

## Phase 2: CLAUDE.md Audit (conditional)

6. **Assess — did this session reveal anything CLAUDE.md-worthy?**
   Ask: "Would a future Claude session working in this project be helped by knowing this?"
   - New commands or build/test invocations discovered?
   - Environment or configuration gotchas?
   - Non-obvious code patterns or conventions?
   - Warnings or constraints that apply project-wide?

   If none of the above: skip to step 9.

7. **Find CLAUDE.md files**
   ```bash
   find . -name "CLAUDE.md" -o -name ".claude.local.md" 2>/dev/null | head -20
   ```
   Decide per addition: `CLAUDE.md` (team-shared, checked into git) vs `.claude.local.md` (personal, gitignored).

8. **Draft additions and get approval**
   One line per concept. Format: `<command or pattern>` — `<brief description>`
   Avoid verbose explanations, obvious info, one-off fixes unlikely to recur.

   Present as diffs before writing:
   ```
   ### Update: ./CLAUDE.md
   **Why:** [one-line reason]
   + [the addition]
   ```
   Apply only changes the user approves.

## Step 9: Report

```
Session reflect complete:
- cerebrum.md: N entries added [or: no high-signal patterns this session]
- buglog.json: [updated / not updated]
- CLAUDE.md: [M additions applied / nothing team-worthy this session]
Most important learning: <one sentence>
```
