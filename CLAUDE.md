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
| After github-issue-first files multiple issues for a multi-phase plan, or on demand when asked to review/work through the open issue backlog | `issue-backlog-cycle` (proposes how open issues should be grouped into a branch via a priority cascade, waits for explicit approval before creating anything; skipped with fewer than 2 open issues, falling through to the row below unchanged) |
| Before touching code | `test-driven-development` (IRON LAW: failing test first) — testing standards: `skills/senior-engineering-partner/references/testing.md` |
| Before starting implementation | `using-git-worktrees` |
| When a bug or test failure appears | `systematic-debugging` (root cause BEFORE fix; once root cause is confirmed, go to `github-issue-first` before implementing) |
| Before claiming anything is done | `verification-before-completion` (IRON LAW: evidence first) |
| Before merging or creating a PR | `requesting-code-review` (if the change went through `github-issue-first`, include `Closes #N` in the PR body) |
| When review feedback arrives | `receiving-code-review` |
| After the PR is created and any review feedback is addressed | Ask whether to merge into `main`. Never merge without an explicit yes — a green CI check or no review comments is not itself permission; merging is its own separate confirmed action. |
| After a group's PR(s) merge, following the row above — only relevant when working from `issue-backlog-cycle` | `issue-backlog-cycle` (round-complete checkpoint: present ranked recommendations, file only the accepted top-N as new issues, then re-check the backlog to propose the next round or end the cycle) |
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
- **Prevent re-reads:** PreToolUse hook blocks re-reads within 10 min (file unchanged); warns on large files.
- **Grilling gate hook:** `hooks/pre-skill-gate.js`/`hooks/post-skill-record.js` block invoking `writing-plans` unless `grilling` (or `/grill-me`) already ran this session — session-scoped via `.wolf/_skill-gate-<session>--<skill>.json` marker files. Real enforcement for the `brainstorming → grilling → writing-plans` gate, not just prose.
- **Local lint/secret-scan gate:** `.githooks/pre-commit` (`git config core.hooksPath .githooks`) runs shellcheck + eslint(security) + gitleaks on staged files pre-commit — enforcement counterpart to `secrets-and-key-rotation.md`/`frontend-web-security.md`. Config: `eslint.config.js`, `.shellcheckrc`, `.gitleaks.toml`. Tier 0, local only; missing tools warn-and-skip.
- **Deliberate-shortcut ledger:** When cutting a real corner with a known
  ceiling (naive algorithm, global lock, skipped edge case), leave a
  `wolf-debt: <ceiling>, <upgrade trigger>` comment naming both. Harvest the
  ledger with the `debt-ledger` skill (`scripts/wolf-debt-scan.js`) so a
  deferral doesn't quietly become permanent. Digest for subagents:
  `hooks/subagent-thin-harness.md` (kept in sync with this bullet manually —
  no scripted check, only one duplicate exists).
- **Subagent routing:** Exploration spanning >3 files → spawn an Explore subagent (protects main context from search noise).
- **End of session:** invoke `session-reflect` — Phase 1 updates `.wolf/cerebrum.md` (always); Phase 2 conditionally audits CLAUDE.md for team-worthy learnings (approval-gated).
- **Worktree path isolation:** `EnterWorktree` creates an isolated branch, but absolute-path edits still write to the MAIN working tree. Use relative paths or `cd <worktree-path>` before editing to isolate changes on the branch.
- **Worktree merge pattern:** After committing in a worktree, `git checkout main` fails from inside it (main is checked out in the parent). Exit sequence: `ExitWorktree` (keep) → `git -C /Users/paulmckay/.claude merge <branch>` → `git worktree remove .claude/worktrees/<name> --force` → `git branch -d <branch>`.
- **Concurrent sessions:** Edit/Write on a `.wolf/` file or `CLAUDE.md` repeatedly failing with "file changed since read" signals another live session. Use small targeted `Edit` calls scoped to untouched lines, or ask the user. `.wolf/memory.md` entries near your own timestamps aren't necessarily yours — verify via `git log`/`gh pr list`/`gh issue list` rather than the shared log alone when concurrent activity is suspected.
- **Worktree scope:** `EnterWorktree` always targets the session's primary repo (`~/.claude`) — it can't target a secondary/"additional working directory" project. For those, use `git worktree add <path> -b <branch> origin/<base>` via Bash instead.
- **Model routing:** Haiku for mechanical/log-inspection/single-file-lookup subagent work, Sonnet default, Opus for complex multi-file reasoning. Default effort for routine work; extended thinking only for genuinely complex decisions. See `model-routing` skill for detail.

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

## 6. Knowledge Graph (`understand-anything`)
- `~/.claude` is tracked in git (baseline `b354ad3`) — commit regularly for incremental updates (1-5 batches vs. 32 for a full rebuild).
- Re-analyze after changes: `/understand-anything:understand ~.claude`
- `langsmith-plugin`, `superpowers`, and `skills/senior-engineering-partner` are git submodules — do NOT `git add` their contents directly; use `git submodule update` to sync them.
- Before pushing submodule commits, run `git remote -v` first — origin is third-party upstream (`langchain-ai`, `obra`, `bjgreenberg`), not a personal fork. Use a local branch (`git branch local-customizations`) instead of pushing.
- `local-customizations` is a snapshot, not a moving ref — re-fast-forward it (`git branch -f local-customizations <sha>`) after every new submodule commit; check `git log --oneline -1 local-customizations` against `main` first.

## 7. Reference Pointers
- Custom agents (`~/.claude/Agents/`), local plugin registration, brand/document skill convention, and external skill (mattpocock) integration details: see `claude-infra-reference` skill.
