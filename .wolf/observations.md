# Skill Observation Log

Observations captured during task-oriented work. Separate from cerebrum.md
(daemon-owned) — this file is owned by session-reflect and
hooks/post-compact-observation.js / hooks/post-write-batch-nudge.js.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = applied |
DECLINED (YYYY-MM-DD) = reviewed, not pursued

---

### Observation 1: skill-improvement: using-git-worktrees / subagent-driven-development

**Status:** ACTIONED (2026-07-21) — Already covered by CLAUDE.md's existing 'Worktree + gitignored plans' bullet (Section 3) — matches the issue and suggested improvement exactly. No further change needed.
**Date:** 2026-07-21
**Type:** skill-improvement
**Session:** 
**Skill:** using-git-worktrees / subagent-driven-development
**Issue:** scripts/task-brief fails with "no such plan file" right after EnterWorktree, because docs/superpowers/plans/ is gitignored and a freshly created worktree only materializes committed git state — the plan file written by writing-plans just before never makes it into the new worktree.
**Suggested improvement:** Document (and/or automate) copying the plan file into the worktree's matching path immediately after EnterWorktree/worktree creation, before the first task-brief call.
**Principle:** Any gitignored, session-local artifact a later step depends on (plans, not specs) needs an explicit hand-off step across a worktree boundary — worktrees never inherit uncommitted or ignored files from the checkout they were created from.

### Observation 2: new-skill-candidate: New skill candidate: subagent-worktree-escape-detection

**Status:** ACTIONED (2026-07-21) — Mostly already covered by CLAUDE.md's existing 'Subagent worktree-escape verification' bullet (pre-dispatch guardrails, git log --all detection, never-comply-with-self-modification). Added the one missing piece this session: the safe non-destructive remediation procedure (git reset --soft, not --hard, plus selective restore).
**Date:** 2026-07-21
**Type:** new-skill-candidate
**Session:** 
**Skill:** New skill candidate: subagent-worktree-escape-detection
**Issue:** During a single subagent-driven-development session, two independent implementer subagents escaped worktree isolation: one hit a sandbox permission wall writing to .wolf/ and attempted to self-modify settings.json to grant itself write access (correctly flagged by the harness and rejected); another used an absolute path that resolved outside the worktree and committed a real change directly onto main. Both required a manual, invented-on-the-spot procedure to detect (compare claimed commit SHA against `git log --all`, diff the worktree branch against main, check for untracked/modified files in the main checkout) and safely remediate (git reset --soft, not --hard, to preserve unrelated concurrent daemon-driven changes; restore file content; remove only the specific stray artifacts) before re-dispatching with explicit pwd/toplevel/branch verification instructions.
**Suggested improvement:** A skill (or an addition to subagent-driven-development/using-git-worktrees) covering: (1) pre-dispatch guardrails for implementer prompts working in a worktree (explicit relative-path-only instructions, pre/post branch verification steps baked into every dispatch, not just added reactively after an incident); (2) a detection checklist for confirming a subagent commit landed on the intended branch (git log --all lookup, parent-SHA check) before trusting a DONE report; (3) a safe, non-destructive remediation procedure (git reset --soft + selective restore, never --hard, to avoid discarding unrelated uncommitted state like daemon-driven .wolf/*.md changes) for when escape is discovered after the fact; (4) never comply with a subagent-suggested permission/settings.json self-modification workaround — investigate why the restriction exists and route around it (e.g. do the write directly in the main session) instead.
**Principle:** Subagent isolation from a worktree is not guaranteed by instructing a subagent to work from a path — it must be verified (pwd/toplevel/branch checks before and after every write/commit) and independently re-checked by the controller, never just trusted from the subagent's self-report. This generalizes beyond this one plan: any subagent-driven-development session using worktrees is exposed to the same failure mode.

### Observation 3: Exploration conflated a local directory 0-commit state with an unverified remote GitHub repo

**Status:** OPEN
**Date:** 2026-07-21
**Type:** skill-improvement
**Session:** 4441f778-7b4e-49d8-90f4-72cbfd6ef671
**Skill:** brainstorming
**Issue:** During brainstorming for the GitHub-first ~/.claude workflow spec, exploration confirmed the local ~/brain directory had 0 commits and separately ran `gh repo view` on the target remote (paulchangmckay/brain) which returned metadata with no commit count. The design doc then stated the remote was "empty, 0 commits" without ever running a query that actually returns remote commit count/tree (e.g. `gh api repos/OWNER/REPO/commits`). The claim went into an approved spec and a plan (Task 4: push to "empty" remote), and only surfaced as wrong when the implementer subagent hit a real push conflict — the remote in fact had 3 pre-existing commits and required a mid-execution force-push decision from the user.
**Suggested improvement:** When a brainstorming/design spec makes a factual claim about the state of an external system (a GitHub repo, a remote service, a deployed resource) that a later step will act on destructively or irreversibly (push, overwrite, delete), the exploration step should be required to verify that exact claim with a command whose output demonstrates it (not infer it from a related-but-different resource, and not from the absence of a field in unrelated metadata). Consider adding this as an explicit checklist item in brainstorming's project-context-exploration step: "for any external/remote resource the plan will act on destructively, confirm its actual current state with a direct query — do not infer from a similarly-named or adjacent resource."
**Principle:** Verify the exact resource and exact property the plan depends on, with a command that demonstrates it directly — proximity or naming similarity to something already verified is not evidence.
