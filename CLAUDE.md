# System Instructions: Thin Harness, Fat Skills Environment

## 1. Core Philosophy
- You are a lightweight execution harness. Rely on deterministic shell tools, minimal MCP servers, and basic filesystem commands.
- Treat this file and project documentation as your "Fat Skills." Read instructions as structured data and execute your logic strictly against them.
- Context management is the bottleneck, not model capability. Protect the token window.

## 2. Process Layer — invoke these skills by name

| When | Invoke |
|------|--------|
| Before creating any output (PDF, slides, doc, PRD, image, email, diagram) | `brand` (HARD-GATE: brand specs before creating; exempt: `teach` skill's personal lesson HTML output — not a branded deliverable) |
| Before any feature work or new task | `brainstorming` (HARD-GATE: no code until design approved) |
| After brainstorm approval, before writing-plans | `grilling` (HARD-GATE within brainstorming: mandatory pass on the approved spec, not conditional on spotting a soft spot yourself — scale depth to complexity but never skip it) |
| After the grilling pass | `writing-plans` |
| After writing-plans produces a plan, or after root cause is confirmed in systematic-debugging — always before test-driven-development or using-git-worktrees | `github-issue-first` (HARD-GATE for non-trivial changes: file a GitHub issue mirroring the spec/plan or root-cause summary before any code is touched; no-ops gracefully outside a git repo, without a GitHub remote, or without `gh` auth) |
| Before touching code | `test-driven-development` (IRON LAW: failing test first) — testing standards: `skills/senior-engineering-partner/references/testing.md` |
| Before starting implementation | `using-git-worktrees` |
| When a bug or test failure appears | `systematic-debugging` (root cause BEFORE fix; once root cause is confirmed, go to `github-issue-first` before implementing) |
| Before claiming anything is done | `verification-before-completion` (IRON LAW: evidence first) |
| Before merging or creating a PR | `requesting-code-review` (if the change went through `github-issue-first`, include `Closes #N` in the PR body) |
| When review feedback arrives | `receiving-code-review` |
| For security posture, threat modeling, or compliance questions | `senior-engineering-partner` with `AUDIT:` trigger — refs: `threat-modeling-and-api-design.md`, `secrets-and-key-rotation.md`, `frontend-web-security.md` |
| A plan or design has unresolved soft spots outside the brainstorming flow (e.g. a plan handed to you directly, not produced via brainstorming) | `grilling` (auto) or `/grill-me` (explicit) — one question at a time, each with a recommended answer, never a bulk list |
| Designing/evaluating a module's interface, seam, or "is this deep enough" | `codebase-design` (vocabulary: interface/seam/adapter/deletion test), alongside `senior-engineering-partner` REVIEW:/EXPLAIN: modes |
| Pinning down domain terminology or recording a hard-to-reverse decision | `domain-modeling` (writes `CONTEXT.md` + `docs/adr/`) — NOT `understand-anything:understand-domain` (read-only: analyzes existing code into a graph, never writes) |
| Compacting live task context for a fresh agent to pick up mid-task | `/handoff` (writes to `.wolf/handoffs/`) — distinct from `session-reflect`, which is a durable project-cerebrum update at session end, not a task baton-pass |
| Teaching the user a new skill/concept over multiple sessions (non-code) | `/teach` — only from a dedicated learning directory, never from `~/.claude` itself |

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
- **Local lint/secret-scan gate:** `.githooks/pre-commit` (enabled via `git config core.hooksPath .githooks`) runs shellcheck + eslint(+security plugin) + gitleaks against staged files before every commit. This is the **enforcement counterpart** to `skills/senior-engineering-partner/references/secrets-and-key-rotation.md` and `frontend-web-security.md` — those docs shape generation-time behavior, this hook catches what slips through at commit time. Config lives in `eslint.config.js`, `.shellcheckrc`, `.gitleaks.toml`. Tier 0 — no CI, local only. Missing tools warn-and-skip rather than block.
- **Subagent routing:** For any exploration spanning more than 3 files, spawn an Explore subagent — this protects the main context window from search noise.
- **End of session:** invoke `session-reflect` skill — Phase 1 updates `.wolf/cerebrum.md` (always); Phase 2 conditionally audits CLAUDE.md files for team-worthy learnings (requires approval).
- **Worktree path isolation:** `EnterWorktree` creates an isolated branch, but absolute-path edits write to the MAIN working tree. Use relative paths or `cd <worktree-path>` before editing to actually isolate changes on the feature branch.
- **Worktree merge pattern:** After committing in a worktree, `git checkout main` fails from inside it (main is checked out in the parent). Correct exit sequence: `ExitWorktree` (keep) → `git -C /Users/paulmckay/.claude merge <branch>` → `git worktree remove .claude/worktrees/<name> --force` → `git branch -d <branch>`.
- **Concurrent sessions:** If Edit/Write on a `.wolf/` file or `CLAUDE.md` repeatedly fails with "file changed since read," another live session is likely active in this repo. Use small targeted `Edit` calls (not full-file `Write`) scoped to lines the other session isn't touching, or pause and ask the user how to proceed.
- **Worktree scope:** `EnterWorktree` always operates on the session's primary repo (`~/.claude`) — it has no way to target a secondary/"additional working directory" project. For any other project's repo, use plain `git worktree add <path> -b <branch> origin/<base>` via Bash instead.

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
- **Native Claude Code auto-memory** (`~/.claude/projects/*/memory/`) is a third, distinct layer: user/feedback/project/reference facts about working *with Claude Code itself*, persisted across all projects. It is not project-specific implementation patterns (that's cerebrum's job) and not long-lived personal/company knowledge (that's brain's job) — keep facts in the layer they belong to rather than duplicating across two.

## 6. Custom Agents
- **Location:** `~/.claude/Agents/<agent-name>/` — each has its own CLAUDE.md, skills/, templates/, outputs/, scripts/
- **Open with:** `claude ~/.claude/Agents/<agent-name>/`
- **Gitignore note:** `Agents/` is gitignored — edit files there directly (no worktree needed). Only `skills/` and `hooks/` under `~/.claude` are git-tracked.

## 7. Knowledge Graph (`understand-anything`)
- `~/.claude` is tracked in git (baseline `b354ad3`). Commit changes regularly so understand-anything uses incremental updates (1-5 batches) instead of full rebuilds (32 batches).
- Re-analyze after changes: `/understand-anything:understand ~.claude`
- `langsmith-plugin` and `superpowers` are git submodules — do NOT `git add` their contents directly; use `git submodule update` to sync them.
- Before pushing local commits in either submodule, run `git remote -v` first — origin is the third-party upstream (`langchain-ai`, `obra`), not a personal fork. Use a local-only backup branch (`git branch local-customizations`) instead of pushing.
- `local-customizations` is a snapshot, not a moving ref — re-fast-forward it (`git branch -f local-customizations <sha>`) after every new local commit in the submodule; check `git log --oneline -1 local-customizations` against `main` before trusting it's current.

## 8. Custom Plugin Registration
- **Local plugins** (no upstream git repo): `claude plugins init <name> --with agents` → scaffolds at `~/.claude/skills/<name>/`, auto-loads as `<name>@skills-dir` — no marketplace or install step needed
- **YAML agent frontmatter:** quote any `description:` value that contains `: ` (colon-space) or the parser silently drops all frontmatter
- **Do NOT** manually edit `installed_plugins.json` — source type validation blocks loading even with a valid `installPath`; use `claude plugins validate <path>` to check before wiring
- **Submodule ≠ registered plugin:** a skill file existing inside a git submodule (e.g. `superpowers/skills/<name>/`) does not make it invocable via the Skill tool — check `~/.claude/plugins/installed_plugins.json` for the plugin name before assuming a submodule's skills are live. Fix for an unregistered local-repo plugin (needs a `.claude-plugin/marketplace.json`, which `superpowers` has): `claude plugin marketplace add <path-to-repo>` then `claude plugin install <plugin>@<marketplace-name>`. A restart is required afterward — skill discovery is computed at session start, so the newly installed skill will still throw `"Unknown skill"` in the same session even after a successful install.

## 9. Brand / Document Skill Convention
- **Brand/structure separation:** In document skill briefs, never hardcode brand values (hex codes, font names, sizes) — say "Apply Brand Spec Card" and let `~/.claude/brand/brand-guide.md` be the only source. Only format-structural constraints (DXA widths, slide count, `No \n in paragraphs`) belong in the skill file itself.
- **Brand source of truth:** `~/.claude/brand/brand-guide.md` → read at runtime by `~/.claude/skills/brand/SKILL.md` → outputs Brand Spec Card → referenced by all document briefs. Updating brand-guide.md propagates everywhere automatically.

## 10. External Skill Integrations (mattpocock/skills)
- Installed via the `npx skills` CLI (`npx skills@latest add mattpocock/skills <skill-names...> --global --copy -y`; the `-s/--skill` flag does not reliably filter in non-interactive mode — pass skill names positionally, or install everything and prune unwanted ones with `npx skills remove <names...> --global -y`). Installed as real copies (`--copy`), not symlinks into `~/.agents/skills/`, so they live fully inside this git repo like every other custom skill.
- **grill-me** (user-invoked, `/grill-me`) + **grilling** (model-invoked primitive it wraps) — relentless one-question-at-a-time interview to stress-test a plan. `grilling` may also be reached for automatically by other skills; `grill-me` never invokes anything except `grilling`.
- **codebase-design** (model-invoked) — deep-module design vocabulary (interface/seam/adapter/deletion test). Installed standalone, not merged into `senior-engineering-partner`; reach for it alongside `senior-engineering-partner` REVIEW:/EXPLAIN: modes when the topic is module/interface shape, not general code correctness. Includes `DEEPENING.md` and `DESIGN-IT-TWICE.md` references.
- **domain-modeling** (model-invoked) — active glossary/ADR discipline, writes `CONTEXT.md` and `docs/adr/`. Distinct from `understand-anything:understand-domain`, which only reads existing code into a graph and never writes back to the repo. Includes `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` references.
- **teach** (user-invoked, `/teach`) — stateful multi-session tutoring workspace (`MISSION.md`, `lessons/`, `reference/`, `learning-records/`, `assets/`). Personal/educational output — exempt from the `brand` hard-gate. Treats the current directory as the workspace: only invoke from a dedicated learning directory, never from `~/.claude` itself.
- **handoff** (user-invoked, `/handoff`) — locally modified from upstream: saves to `.wolf/handoffs/<UTC-timestamp>-handoff.md` instead of the OS temp dir, for discoverability via OpenWolf and worktree-friendliness. Because it's modified, re-running the install for `handoff` will overwrite the local edit — reapply the `.wolf/handoffs/` change after any upstream update.
- **Note:** `grill-me`, `teach`, and `handoff` are enforced user-invoked at the tool level — calling `Skill({skill: "grill-me"})` etc. throws `disable-model-invocation` and fails. They can only be triggered by the user typing the slash command directly; Claude cannot self-invoke or self-verify them.
- Not installed from this repo (considered and skipped): `ask-matt`, `code-review`, `diagnosing-bugs`, `grill-with-docs`, `implement`, `improve-codebase-architecture`, `prototype`, `setup-matt-pocock-skills`, `tdd`, `to-issues`, `to-prd`, `triage`, `writing-great-skills`, and the `general/` category skills — out of scope for this integration pass, revisit individually if a need arises.
