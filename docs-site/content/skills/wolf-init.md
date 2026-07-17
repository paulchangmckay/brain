---
title: "wolf-init"
description: "Use when starting work in a project that has no .wolf/ directory — bootstraps OpenWolf token tracking, file anatomy, and self-learning memory for the project"
---

# Wolf Init Skill

Bootstrap OpenWolf for a new project. Run once per project root to activate token tracking, file anatomy, and the self-learning cerebrum.

## Steps

1. **Verify you are at project root**
   - Check for a `.git` directory, `package.json`, `Cargo.toml`, or equivalent project marker
   - If not at project root, navigate there first and confirm with the user

2. **Check if already initialized**
   ```bash
   ls .wolf/ 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
   ```
   - If EXISTS: read `.wolf/OPENWOLF.md` and `.wolf/anatomy.md`, report project state, and skip to step 6
   - If NOT_FOUND: continue

3. **Initialize OpenWolf**
   ```bash
   openwolf init
   ```
   This creates the `.wolf/` directory with anatomy.md, cerebrum.md, buglog.json, memory.md, and 6 lifecycle hook scripts.

4. **Build the initial anatomy map**
   ```bash
   openwolf scan
   ```
   Reads every tracked file, generates token estimates, and writes `.wolf/anatomy.md`.

5. **Start the background self-learning daemon**
   ```bash
   openwolf daemon start
   ```
   Starts 5 background cron jobs via PM2:
   - `anatomy-rescan` every 6 hours
   - `memory-consolidation` daily 2 AM
   - `cerebrum-reflection` Sundays 3 AM (Claude reviews and improves memory)
   - `token-audit` Mondays midnight
   - `project-suggestions` Mondays 4 AM

6. **Verify**
   ```bash
   openwolf status
   ```
   Report health, daemon status, and anatomy file count to the user.

7. **Read the anatomy**
   Read `.wolf/anatomy.md` and report:
   - Total files tracked
   - Largest files (top 5 by token estimate)
   - Any files flagged with known issues in `.wolf/buglog.json`

8. **Proceed**
   The project is now instrumented. The PreToolUse hook will warn before re-reads. The PostToolUse hook will keep anatomy.md current after writes.
