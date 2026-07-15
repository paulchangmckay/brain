# Token Optimization Pass — Design

## Context

A review of three external Claude Code token-optimization articles (buildtolaunch, Firecrawl, claudefa.st) turned up five findings not yet addressed in this setup, cross-checked against actual repo state:

1. Global `CLAUDE.md` is ~2220 words, loaded on every session — well over the "under 500 tokens" guidance repeated across two of the three articles.
2. No model-routing policy exists, despite the `Agent` tool already supporting `model: haiku/sonnet/opus` overrides.
3. No `permissions.deny` hard-block list exists anywhere (global or project).
4. No `.claudeignore` exists in the NHL Stats project (a Python app with `.venv/`, `__pycache__/`, and other vendored/generated content).
5. No written guideline for capping reasoning/thinking effort on mechanical tasks.

Anti-goals: this is not a rewrite of the process gate table, not a change to any HARD-GATE mechanics, and not a blanket "trim everything" pass — passive, safety-critical guidance (hook behavior, worktree path-isolation gotchas, concurrent-session handling) must stay directly visible in CLAUDE.md rather than move into an on-demand skill, since skills only get read when something triggers them and this content has no natural trigger.

## Approach

Two phases:
- **Phase 1 (global, `~/.claude`)**: CLAUDE.md trim, new `model-routing` skill, new `claude-infra-reference` skill, global `permissions.deny`.
- **Phase 2 (NHL Stats project)**: `.claudeignore`, project-level `permissions.deny` additions.

Phased rather than one combined pass so the CLAUDE.md trim (highest-judgment item, touches the file every session reads) can be sanity-checked before a second project is touched.

## Component 1 — CLAUDE.md trim

Target: ~2220 words → ~1100-1300 words remaining in CLAUDE.md.

**Keep as-is:**
- Section 1 (Core Philosophy)
- Section 2 (Process gate table + Project Tier table) — the routing logic; must stay visible every session

**Keep, condensed:**
- Section 3 (Infrastructure Layer) minus its lookup-style subsections — hook behavior, worktree path-isolation gotcha, concurrent-session detection rule all stay (passive, no natural trigger to recall them from a skill); verbose multi-sentence bullets get tightened to the load-bearing fact
- Section 4 (New Project Bootstrap) — already short
- Section 5 (Personal Knowledge Layer / brain MCP) — passive "check before answering" trigger, same reasoning as Section 3

**Move to new skill `skills/claude-infra-reference/SKILL.md`, replaced in CLAUDE.md with one-line pointers:**
- Section 6 (Custom Agents)
- Section 8 (Custom Plugin Registration)
- Section 9 (Brand / Document Skill Convention — already just a pointer to brand-guide.md)
- Section 10 (External Skill Integrations / mattpocock skills history)

Trigger description for the new skill: "Use when registering, troubleshooting, or looking up details about custom agents, local plugins, or the mattpocock external skill integrations."

## Component 2 — model-routing skill

New `skills/model-routing/SKILL.md` — a skill, not a `.claude/rules/*.md` file (rules with broad `globs` auto-load every session, which would defeat the purpose of moving this out of CLAUDE.md).

Trigger description: "Use when deciding which model to route an Agent/subagent task to, or when deciding whether to cap reasoning effort for a task."

Contents:
- Haiku: mechanical, log-inspection, single-file-lookup subagent work
- Sonnet: default for typical work
- Opus: reserved for complex multi-file architecture/reasoning tasks
- Effort guideline: default effort for routine work; extended/deeper thinking reserved for genuinely complex decisions, not invoked reflexively

CLAUDE.md Section 3 gets a one-line pointer to this skill.

## Component 3 — global permissions.deny

Add to `~/.claude/.claude/settings.json`:

```json
"permissions": {
  "deny": [
    "Read(**/node_modules/**)",
    "Read(**/*.lock)",
    "Read(**/package-lock.json)",
    "Read(**/.env*)",
    "Read(**/*.pem)",
    "Read(**/*credentials*)"
  ]
}
```

Merge into any existing `permissions` block rather than overwrite it.

## Component 4 — NHL Stats project

Surveyed project state: Python app (`app.py`, `src/`, `etl/`, `scripts/`), `.venv/` present, `__pycache__/`, a `files.zip`, and `data/` (2.1M — core to the project's purpose, NOT ignored).

**New `.claudeignore`** (project root):
```
.venv/
__pycache__/
files.zip
.DS_Store
```

**Project-level `permissions.deny` addition** (`.claude/settings.json` in the NHL Stats project — create if it doesn't exist, merge if it does):
```json
"permissions": {
  "deny": [
    "Read(**/.venv/**)",
    "Read(**/__pycache__/**)"
  ]
}
```

## Verification

- Word count CLAUDE.md before/after (`wc -w`)
- Confirm the process gate table and HARD-GATE language are unchanged, character-for-character, in the trimmed CLAUDE.md
- Confirm both new skills (`claude-infra-reference`, `model-routing`) appear in the available-skills list after being written (same-session discovery already confirmed to work for `divergent-ideation` earlier)
- Confirm moved content isn't lost — diff old Section 6/8/9/10 content against the new skill file
- Validate both `settings.json` edits are valid JSON and don't clobber existing `permissions` entries
- Manually verify the deny list doesn't block anything currently in active use (e.g. no legitimate workflow reads `node_modules` or lockfiles directly)

## Out of scope

- Any change to HARD-GATE mechanics, the grilling gate hook, or process table row ordering
- MAX_THINKING_TOKENS / env-var-level effort configuration (guideline only, per explicit decision — exact support varies by Claude Code version and wasn't verified)
- `.claudeignore` or deny changes to any project other than NHL Stats
- Third-party plugin installs (context-mode, RTK, claude-hud) mentioned in the source articles — explicitly rejected as unnecessary given existing anatomy.md/hook infrastructure already covers the same need
