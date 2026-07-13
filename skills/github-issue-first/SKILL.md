---
name: github-issue-first
description: "Use after writing-plans produces a plan, or after systematic-debugging confirms a root cause — always before test-driven-development or using-git-worktrees. Files a GitHub issue mirroring the spec/plan or root-cause summary before any code is touched. HARD-GATE for non-trivial changes; no-ops gracefully when there's no git repo, no GitHub remote, or gh isn't authenticated."
---

# GitHub Issue First

File a GitHub issue before writing code, so every non-trivial change has a visible tracking record. This mirrors the local spec/plan — it doesn't replace it.

## When to skip (no-op silently, proceed straight to the next gate)

- Not inside a git repository
- No GitHub remote (`git remote get-url origin` doesn't resolve to a github.com URL)
- `gh auth status` fails (not authenticated)
- The change is trivial: typo fixes, formatting/whitespace, comment-only edits, doc-only edits, dependency version bumps with no behavior change

If any of these apply, say so briefly and move on — do not block.

## Steps

1. **Confirm applicability.** Run `git remote get-url origin` and `gh auth status`. If either fails, skip per above.
2. **Determine entry path and build content:**
   - **From `writing-plans`** (a spec + plan exist): label `enhancement`. Title: short imperative summary (no prefix). Body:
     ```
     ## Summary
     <1-3 sentence paraphrase of the spec's problem/goal>

     ## Spec & Plan
     - Spec: docs/superpowers/specs/<file>.md
     - Plan: docs/superpowers/plans/<file>.md

     ## Why
     <1-2 sentences: user-facing effect / motivation>
     ```
   - **From `systematic-debugging`** (root cause confirmed): label `bug`. Title: short symptom description. Body:
     ```
     ## Bug
     <1-2 sentences: what the user observes going wrong>

     ## Root Cause
     <1-3 sentence summary of the confirmed root cause>

     ## Fix Approach
     <1-2 sentences on the planned fix>
     ```
   Keep both bodies short — a seed/pointer, not a duplicate of the spec. If the repo has an issue-triggered automation (e.g. an AI-summary-comment workflow), that's another reason to keep the body lightweight rather than exhaustive.
3. **Create the issue:** `gh issue create --title "<title>" --body "<body>" --label <bug|enhancement>`. Capture the returned issue number/URL.
4. **Carry the issue number into the branch name** created by `using-git-worktrees` (e.g. `fix/42-search-suggestion-filter-bug`, `feature/43-...`). This is how the number survives a compaction boundary or a long gap before the PR exists, without relying on conversation memory — recoverable anytime via `git branch --show-current | grep -oE '^[a-z]+/[0-9]+'`.
5. **Remember for later:** when the PR is eventually created, include `Closes #<N>` in the PR body so the issue auto-closes on merge.
