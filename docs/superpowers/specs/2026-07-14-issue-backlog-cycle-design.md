# Issue Backlog Cycle — Design

## Context

The pipeline built earlier this session (`github-issue-first` → `using-git-worktrees` → TDD → `verification-before-completion` → `requesting-code-review` → `receiving-code-review` → ask-before-merge, all rows in `~/.claude/CLAUDE.md`'s process table) handles one issue at a time: one plan, one issue, one branch, one PR. It has no concept of a backlog — multiple outstanding issues from a multi-phase plan, from ad-hoc bug discovery, or accumulated across sessions, with no mechanism to group related work into a branch, or to keep cycling until the backlog is empty.

This gap is concrete, not hypothetical: the example repo (`paulchangmckay/nhl-stats`) currently has two open, unrelated issues — #10 (full-name search matching bug, JS) and #20 (sticky column header CSS bug) — that happen to share a file (`templates/index.html`) but nothing else. A naive "group by file" rule would incorrectly bundle them into one branch; the design below exists specifically to avoid that.

The user wants: multi-phase plans to file multiple issues instead of one; related issues grouped into a single branch/worktree to execute together; a repeating cycle that keeps checking the backlog and grouping the next batch until nothing is left; bugs/tasks discovered mid-implementation filed as new issues (or fixed inline if clearly in-scope); and, once a group's work merges, a recommendation step for further enhancements that — on agreement — feeds new issues back into the same cycle.

## Goals

- Multi-phase plans produce one GitHub issue per phase/task, not one issue mirroring the whole plan.
- Before any branch/worktree is created, propose how open issues should be grouped, and wait for explicit approval — never group and start work unannounced.
- Grouping decisions follow a fixed priority cascade: plan-phase boundaries first, then subsystem/feature relatedness, then file overlap as a last-resort weak signal.
- After a group's PR(s) merge, recommend further work grounded in what was just touched; on agreement, file new issues; either way, re-check the backlog and propose the next group.
- Repeat until the open backlog is empty.
- Mid-implementation discoveries: fixed inline only if clearly within the current group's subsystem; otherwise filed as a new issue for a future round.
- Global policy — same scope as `github-issue-first` and the merge-ask step, not specific to one repo.

## Non-Goals

- Fully autonomous grouping with no human checkpoint. The user explicitly wants to see and approve every proposed grouping before work starts.
- Changing anything about the existing single-issue pipeline (worktree creation, TDD, verification, review, ask-before-merge) — this design only adds a wrapper around it and a small extension to issue filing.
- A general-purpose project-management/ticketing system. This only orchestrates GitHub issues already scoped to this repo's own backlog; it does not touch milestones, projects, or cross-repo tracking.

## 1. Multi-Issue Filing (extends `github-issue-first`)

Currently `github-issue-first` has two entry paths — from a `writing-plans` plan, or from a confirmed `systematic-debugging` root cause — each producing exactly one issue. This adds a third condition on the `writing-plans` path: if the plan has multiple distinct phases/tasks (as opposed to one plan describing one cohesive change), file one issue per phase/task, each with its own title/body/label, rather than one issue summarizing the whole plan. Single-phase plans and bug fixes from `systematic-debugging` are unaffected — they still file exactly one issue, as today.

Every issue filed from the same multi-phase plan also gets a shared, plan-specific label (e.g. `plan:2026-07-14-etl-sync`, derived from the plan's own filename) applied at filing time. This label is the durable signal tier-1 grouping (below) reads later — it survives a session boundary or context compaction, is visible directly in `gh issue list`, and reuses GitHub's own label primitive rather than a side-channel.

## 2. Grouping Proposal (new: `issue-backlog-cycle`)

**Invocation — two entry points, same skill:** auto-triggers immediately after `github-issue-first` files multiple issues for a fresh multi-phase plan, and is also directly invocable on demand with no plan involved (e.g. the user asks to review or work through the open backlog after issues have accumulated over time).

**Activation threshold:** query `gh issue list --state open` with no label filter (Dependabot or other bot-filed issues are in scope like anything else — they simply won't match tier 1/2 with unrelated work and will fall into their own single-issue group). If this query returns fewer than 2 open issues, skip the grouping ceremony entirely and hand off straight to the existing single-issue pipeline unchanged — the ceremony below only exists to resolve a decision that only exists once there are 2+ issues to weigh against each other.

With 2+ open issues, propose a grouping using this priority cascade — evaluated per-issue-pair, not applied uniformly to the whole backlog at once:

1. **Plan-phase boundaries (highest priority)** — if two open issues share the same plan-specific label from section 1, group them.
2. **Subsystem/feature relatedness** — for issues that don't share a plan label (ad-hoc bugs, issues accumulated across sessions, prior rounds' leftover backlog, bot-filed issues), group by reading each issue's title/body/labels and judging whether they're part of the same conceptual feature area — not by file overlap. This is the primary mechanism once a plan's own phase context is gone.
3. **File overlap (lowest priority, weak signal only)** — if two issues aren't clearly related by (1) or (2) but their described fixes are highly likely to touch the same file(s), this can support a grouping decision but never justifies one on its own. (Concretely: this rule alone must NOT bundle #10 and #20 — the worked example this design is built against.)

Issues that don't group with anything get their own single-issue branch, same as the existing pipeline's default behavior.

**Present the proposal, then wait.** Format: a short list, one line per group, naming the issues, a one-phrase reason for the grouping (or "no related open issues"), and which cascade tier decided it. No branch, worktree, or file change happens until the user responds — this is a hard wait, not a default-proceed-after-N-seconds pattern.

**On rejection or adjustment:** freeform, not a fixed menu — the user describes what should change (e.g. "put #20 with #22 instead"), the grouping is revised and re-presented, repeating until approved. No alternative-proposals-up-front and no discard-and-restart-from-zero; feedback is incorporated incrementally.

## 3. Executing an Approved Group

Once a grouping is approved, hand off to the existing pipeline unchanged: `using-git-worktrees` creates one branch/worktree for the whole group (not one per issue). Branch naming: for a group of 2 issues, list both numbers (e.g. `fix/10-20-<short-description>`); for a group of 3 or more, use the lowest issue number plus a count instead of listing every number (e.g. `fix/10-plus-2-more-<short-description>` for a 3-issue group led by #10). TDD, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, and the ask-before-merge step all apply exactly as already configured, just now potentially closing multiple issues from one PR (`Closes #10, Closes #20`).

**Mid-implementation discoveries**: if a new bug or task surfaces while working the group, fix it inline in the same branch only if it's clearly within the same subsystem as the group's issues (noted in the PR description as in-scope, not a silent addition). Anything outside that subsystem gets filed as a new GitHub issue and left for a future round — it does not block or expand the current branch's work.

## 4. Round-Complete Checkpoint

Once a group's PR(s) merge (following the existing ask-before-merge confirmation), two things happen before the cycle continues:

1. **Recommend further work**, grounded specifically in what the just-merged group touched — this can be a new feature/capability, an optimization or refactor, or a design/UX/UI improvement. Presented as a **ranked list**, strongest/most-relevant recommendation first, not an arbitrary or alphabetical ordering.
2. **User specifies how many to take from the top of the list** (e.g. "just the top 2") rather than picking arbitrary items by number or an all-or-nothing accept/reject. Only the accepted top-N get filed as new issues; the rest are not filed and are not remembered for a future round (if still worth doing later, they'd need to be recommended again next time, freshly grounded in whatever's been built since).

Whether or not new issues were filed from recommendations, re-query the open backlog and re-apply section 2's activation threshold: 2+ open issues → propose the next round's grouping; exactly 1 → fall through to the single-issue pipeline for it (same as any other lone issue, no grouping ceremony); 0 → the cycle ends, nothing further to do. This checkpoint fires **after each grouped round**, not after every single merge and not only once at the very end — the middle-ground cadence the user chose, explicitly flagged by the user as something to try and potentially revisit if it turns out too frequent or too sparse.

## Files Changed

| File | Change |
|------|--------|
| `~/.claude/skills/github-issue-first/SKILL.md` | Add the multi-phase-plan → multi-issue filing condition to the `writing-plans` entry path |
| `~/.claude/skills/issue-backlog-cycle/SKILL.md` | New skill — grouping cascade, approval wait, hand-off to existing pipeline, round-complete recommendation + re-check loop |
| `~/.claude/CLAUDE.md` | New process-table row(s) wiring `issue-backlog-cycle` into the sequence — positioned after `writing-plans`/`github-issue-first` (for the multi-issue case) and after the merge-ask row (for the round-complete/re-check case) |

## Open Questions for the Plan Stage

None outstanding. Beyond the initial design discussion (grouping cascade priority and worked counter-example, approval-before-work requirement, inline-fix-if-related-else-defer rule, per-round recommendation cadence, global scope), a grilling pass resolved six further branch points: the 2+-issue activation threshold (below it, fall through to the unchanged existing pipeline), the plan-label mechanism for durable tier-1 detection, backlog scope (all open issues, no label filter), dual invocation (auto-trigger plus standalone on-demand), freeform rejection/adjustment of a proposed grouping, and ranked top-N acceptance of round-complete recommendations.
