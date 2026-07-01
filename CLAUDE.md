# System Instructions: Thin Harness, Fat Skills Environment

## 1. Core Philosophy
- You are a lightweight execution harness. Rely on deterministic shell tools, minimal MCP servers, and basic filesystem commands.
- Treat this file and project documentation as your "Fat Skills." Read instructions as structured data and execute your logic strictly against them.
- Context management is the bottleneck, not model capability. Protect the token window.

## 2. Process Layer — invoke these skills by name

| When | Invoke |
|------|--------|
| Before creating any output (PDF, slides, doc, PRD, image, email, diagram) | `brand` (HARD-GATE: brand specs before creating) |
| Before any feature work or new task | `brainstorming` (HARD-GATE: no code until design approved) |
| After brainstorm approval | `writing-plans` |
| Before touching code | `test-driven-development` (IRON LAW: failing test first) — testing standards: `skills/senior-engineering-partner/references/testing.md` |
| Before starting implementation | `using-git-worktrees` |
| When a bug or test failure appears | `systematic-debugging` (root cause BEFORE fix) |
| Before claiming anything is done | `verification-before-completion` (IRON LAW: evidence first) |
| Before merging or creating a PR | `requesting-code-review` |
| When review feedback arrives | `receiving-code-review` |
| For security posture, threat modeling, or compliance questions | `senior-engineering-partner` with `AUDIT:` trigger — refs: `threat-modeling-and-api-design.md`, `secrets-and-key-rotation.md`, `frontend-web-security.md` |

### Project Tier (scale rigor to maturity)
| Tier | State | Gates active |
|------|-------|--------------|
| **0 — Prototype** | Throwaway, no real data, single dev | Security floor only (no secrets in code, no injection) |
| **1 — MVP** | Critical-path tests, real users possible | + authn, secrets manager, basic CI, input validation |
| **2 — Production** | Real customer data, multi-tenant, public internet | Full strict posture — all merge-blocking gates active |

**Promotion triggers** (escalate tier immediately): real customer data, multi-tenant isolation needed, regulated data (PII/GDPR), second contributor, public internet exposure.

## 3. Infrastructure Layer (OpenWolf Integration)
- **Protocol enforcement rules:** See `.claude/rules/openwolf.md` — anatomy checks, buglog cross-references, and memory update rules live there.
- **Prevent re-reads:** The PreToolUse hook blocks re-reads within 10 min (file unchanged) and warns on large files. Heed the warning.
- **Subagent routing:** For any exploration spanning more than 3 files, spawn an Explore subagent — this protects the main context window from search noise.
- **End of session:** invoke `session-reflect` skill — Phase 1 updates `.wolf/cerebrum.md` (always); Phase 2 conditionally audits CLAUDE.md files for team-worthy learnings (requires approval).
- **Worktree path isolation:** `EnterWorktree` creates an isolated branch, but absolute-path edits write to the MAIN working tree. Use relative paths or `cd <worktree-path>` before editing to actually isolate changes on the feature branch.
- **Worktree merge pattern:** After committing in a worktree, `git checkout main` fails from inside it (main is checked out in the parent). Correct exit sequence: `ExitWorktree` (keep) → `git -C /Users/paulmckay/.claude merge <branch>` → `git worktree remove .claude/worktrees/<name>` → `git branch -d <branch>`.

## 4. New Project Bootstrap
When starting work in a project that has no `.wolf/` directory, invoke the `wolf-init` skill or run manually:
```bash
openwolf init        # Creates .wolf/ and registers Claude Code hooks
openwolf scan        # Builds initial anatomy map
openwolf daemon start  # Starts background self-learning crons (PM2 required — installed)
openwolf status      # Confirm health
```

## 5. Personal Knowledge Layer (brain MCP)
- **MCP server:** `brain` — filesystem server rooted at `~/brain/` (people/, companies/, concepts/, decisions/)
- **Before answering questions about people, companies, or past decisions:** use `list_directory` + `read_file` on the relevant brain subdirectory first
- **Write decisions back:** after any significant decision in a session, use `write_file` to persist it to the appropriate brain directory with context
- **For synthesis questions** (e.g. "what do I know about X?"): list the relevant directory, read matching files, then synthesize
- **Cross-reference with cerebrum:** brain = cross-project / personal knowledge; `.wolf/cerebrum.md` = project-specific patterns — both complement each other

## 6. Custom Agents
- **Location:** `~/.claude/Agents/<agent-name>/` — each has its own CLAUDE.md, skills/, templates/, outputs/, scripts/
- **Open with:** `claude ~/.claude/Agents/<agent-name>/`
- **Gitignore note:** `Agents/` is gitignored — edit files there directly (no worktree needed). Only `skills/` and `hooks/` under `~/.claude` are git-tracked.

## 7. Knowledge Graph (`understand-anything`)
- `~/.claude` is tracked in git (baseline `b354ad3`). Commit changes regularly so understand-anything uses incremental updates (1-5 batches) instead of full rebuilds (32 batches).
- Re-analyze after changes: `/understand-anything:understand ~.claude`
- `langsmith-plugin` and `superpowers` are git submodules — do NOT `git add` their contents directly; use `git submodule update` to sync them.

## 8. Custom Plugin Registration
- **Local plugins** (no upstream git repo): `claude plugins init <name> --with agents` → scaffolds at `~/.claude/skills/<name>/`, auto-loads as `<name>@skills-dir` — no marketplace or install step needed
- **YAML agent frontmatter:** quote any `description:` value that contains `: ` (colon-space) or the parser silently drops all frontmatter
- **Do NOT** manually edit `installed_plugins.json` — source type validation blocks loading even with a valid `installPath`; use `claude plugins validate <path>` to check before wiring

## 9. Brand / Document Skill Convention
- **Brand/structure separation:** In document skill briefs, never hardcode brand values (hex codes, font names, sizes) — say "Apply Brand Spec Card" and let `~/.claude/brand/brand-guide.md` be the only source. Only format-structural constraints (DXA widths, slide count, `No \n in paragraphs`) belong in the skill file itself.
- **Brand source of truth:** `~/.claude/brand/brand-guide.md` → read at runtime by `~/.claude/skills/brand/SKILL.md` → outputs Brand Spec Card → referenced by all document briefs. Updating brand-guide.md propagates everywhere automatically.
