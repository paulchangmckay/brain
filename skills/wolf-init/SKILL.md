---
name: wolf-init
description: Use when starting work in a project that has no .wolf/ directory — bootstraps OpenWolf token tracking, file anatomy, and self-learning memory for the project
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
   - If EXISTS: read `.wolf/OPENWOLF.md` and `.wolf/anatomy.md`, report project state, and skip to step 7
   - If NOT_FOUND: continue

3. **Initialize OpenWolf**
   ```bash
   openwolf init
   ```
   This creates the `.wolf/` directory with anatomy.md, cerebrum.md, buglog.json, memory.md, and 6 lifecycle hook scripts.

4. **Bootstrap the skill-observation files**
   `openwolf init` only creates its own fixed file set — it doesn't know
   about the skill-observation system. Create these three files if they
   don't already exist:
   ```bash
   [ -f .wolf/observations.md ] || cat > .wolf/observations.md <<'EOF'
# Skill Observation Log

Observations captured during task-oriented work. Separate from cerebrum.md
(daemon-owned) — this file is owned by session-reflect and
hooks/post-compact-observation.js / hooks/post-write-batch-nudge.js.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = applied |
DECLINED (YYYY-MM-DD) = reviewed, not pursued

---
EOF
   [ -f .wolf/cross-cutting-principles.md ] || cat > .wolf/cross-cutting-principles.md <<'EOF'
# Cross-Cutting Principles

Principles that apply to all skills. Read as a mandatory checklist during
any skill creation or regeneration.

---

## Active Principles

(none yet)
EOF
   [ -f .wolf/observations-last-review.txt ] || echo 'never' > .wolf/observations-last-review.txt
   ```

5. **Build the initial anatomy map**
   ```bash
   openwolf scan
   ```
   Reads every tracked file, generates token estimates, and writes `.wolf/anatomy.md`.

6. **Start the background self-learning daemon**
   ```bash
   openwolf daemon start
   ```
   Starts 5 background cron jobs via PM2:
   - `anatomy-rescan` every 6 hours
   - `memory-consolidation` daily 2 AM
   - `cerebrum-reflection` Sundays 3 AM (Claude reviews and improves memory)
   - `token-audit` Mondays midnight
   - `project-suggestions` Mondays 4 AM

7. **Verify**
   ```bash
   openwolf status
   ```
   Report health, daemon status, and anatomy file count to the user.

8. **Read the anatomy**
   Read `.wolf/anatomy.md` and report:
   - Total files tracked
   - Largest files (top 5 by token estimate)
   - Any files flagged with known issues in `.wolf/buglog.json`

9. **Proceed**
   The project is now instrumented. The PreToolUse hook will warn before re-reads. The PostToolUse hook will keep anatomy.md current after writes.
