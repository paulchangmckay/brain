---
title: "issue-backlog-cycle"
description: "Use after github-issue-first files multiple issues for a multi-phase plan, or on demand when asked to review or work through the open issue backlog. Proposes how open GitHub issues should be grouped into a single branch/worktree using a priority cascade, waits for explicit approval before creating anything, hands off to using-git-worktrees for the approved group, and after each group's PR(s) merge recommends further work and re-checks the backlog to propose the next round — repeating until the backlog is empty. Skipped entirely with fewer than 2 open issues; falls through to the existing single-issue pipeline."
---

# Issue Backlog Cycle

Groups related open GitHub issues into a single branch/worktree so a batch of related work lands as one reviewable unit, then keeps cycling through the backlog — proposing the next group, recommending further work after each merge — until nothing open remains. This wraps around the existing pipeline (`using-git-worktrees` → TDD → `verification-before-completion` → `requesting-code-review` → `receiving-code-review` → ask-before-merge); it does not change any of those steps.

## Invocation

Two entry points, same skill:
- **Auto-triggered** immediately after `github-issue-first` files multiple issues for a fresh multi-phase plan.
- **Standalone, on demand** — invoke directly when asked to review, triage, or work through the open issue backlog, with no fresh plan involved.

## Step 1: Activation Threshold

Run `gh issue list --state open` with no label filter — every open issue is in scope, including ones filed by other tooling (Dependabot, other bots), since they simply won't match the grouping cascade below and will end up in their own single-issue group.

- **Fewer than 2 open issues:** skip everything below. Hand off straight to the existing single-issue pipeline (`using-git-worktrees` etc.) exactly as if this skill didn't exist. This ceremony only exists to resolve a decision that only exists once there are 2+ issues to weigh against each other.
- **2 or more open issues:** continue to Step 2.

## Step 2: Grouping Cascade

Evaluate relatedness per-issue-pair, not uniformly across the whole backlog. Apply in this priority order — first match wins:

1. **Plan-label match (highest priority).** Two issues share a `plan:<name>` label (written by `github-issue-first`'s multi-phase-plan path) → group them. This only applies to issues from the same plan; it's a direct label comparison, not a judgment call.
2. **Subsystem/feature relatedness.** For issues that don't share a plan label (ad-hoc bugs, issues accumulated across sessions, leftover backlog from a prior round, bot-filed issues) — read each issue's title, body, and labels, and judge whether they're genuinely part of the same conceptual feature area. This is a judgment call, not a mechanical rule — the counter-example this skill is built against: a full-name-search bug and a sticky-header CSS bug both happen to live in the same file, but are unrelated subsystems and must NOT be grouped by that coincidence.
3. **File overlap (lowest priority, weak signal only).** If two issues aren't clearly related by (1) or (2), but their described fixes are highly likely to touch the same file(s), this can support grouping them but must never be the sole justification. If tier 1 and tier 2 both come back negative for a pair, default to NOT grouping rather than reaching for tier 3 alone.

Issues that don't group with anything get their own single-issue branch — same as the pipeline's existing default.

## Step 3: Present and Wait

Show the proposed grouping as a short list — one line per group: the issue numbers, a one-phrase reason, and which cascade tier decided it (or "no related open issues" for a singleton). Example:

```
Group 1: #10, #14 — same plan (plan:2026-07-14-etl-sync) [tier 1]
Group 2: #20 — no related open issues [singleton]
```

**Wait for an explicit response. Do not create a branch, worktree, or any file change before it.**

- **Approved as-is:** proceed to Step 4 for the group the user wants to start with.
- **Rejected or adjusted:** the user describes the change in their own words (e.g. "put #20 with #22 instead"). Revise the grouping incorporating that specific feedback and re-present — do not discard everything and restart the cascade from zero, and do not offer a fixed multiple-choice menu of alternatives. Repeat until approved.

## Step 4: Execute the Approved Group

Hand off to the existing pipeline, unchanged: `using-git-worktrees` creates **one** branch/worktree for the whole group (not one per issue).

Branch naming:
- 2-issue group: list both numbers — `fix/10-20-<short-description>` (or `feature/...` if the group is enhancement-labeled work).
- 3+-issue group: lowest issue number plus a count — `fix/10-plus-2-more-<short-description>` for a 3-issue group led by #10.

TDD, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, and the ask-before-merge row all apply exactly as already configured in `CLAUDE.md` — no changes to any of them. The resulting PR closes every issue in the group (`Closes #10, Closes #20`).

**Mid-implementation discoveries.** If a new bug or task surfaces while working the group:
- **Same subsystem as the group's issues:** fix it inline, in the same branch, noted explicitly in the PR description as in-scope (not a silent addition).
- **Outside that subsystem:** file it as a new GitHub issue (via `github-issue-first`'s normal single-issue path) and leave it for a future round — it does not block or expand the current branch.

## Step 5: Round-Complete Checkpoint

Once the group's PR(s) merge (following the existing ask-before-merge confirmation):

1. **Recommend further work**, grounded specifically in what the just-merged group touched. Can be a new feature/capability, an optimization or refactor, or a design/UX/UI improvement. Present as a **ranked list**, strongest/most-relevant first — not alphabetical, not arbitrary order.
2. **Wait for the user to specify how many to take from the top** (e.g. "just the top 2"), not an all-or-nothing accept/reject and not picking arbitrary items by number. File only the accepted top-N as new issues (via `github-issue-first`'s normal path — these are fresh single-issue or plan-derived filings, not part of the group that just merged). Anything not taken is not filed and not remembered for later — if still worth doing, it would need to be recommended again in a future round, freshly grounded in whatever's been built since.
3. **Re-query the open backlog and re-apply Step 1's activation threshold:**
   - 2+ open issues remain → return to Step 2, propose the next round's grouping.
   - Exactly 1 remains → fall through to the single-issue pipeline for it, same as any lone issue — no grouping ceremony.
   - 0 remain → the cycle ends. Nothing further to do.
