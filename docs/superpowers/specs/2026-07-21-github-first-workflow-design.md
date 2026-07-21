# GitHub-First Workflow for `~/.claude` — Design

## Context

`~/.claude` is git-tracked but has never had a remote — every commit so far (127 of them) landed straight on `main` from local sessions. CLAUDE.md §2 already documents a GitHub-integrated pipeline (`github-issue-first` before code touches, `requesting-code-review` before merge, explicit-approval-only merges) and §3 already references worktree/PR mechanics, but none of it has ever actually run: `github-issue-first` no-ops silently whenever `git remote get-url origin` fails to resolve, which it always has.

The user has learned more about GitHub and wants `~/.claude` development to stop being local-first, using `https://github.com/paulchangmckay/brain` as the remote. That repo currently exists (public, empty, 0 commits) and is otherwise used as the storage root for the `gbrain` MCP server (a *separate* personal-knowledge system — people/companies/concepts/decisions — with its own local git repo, currently 0 commits, no remote). Scoping questions resolved this out: `brain` will host `~/.claude` only; the knowledge base stays untouched for now; the repo keeps its current name despite the mismatch.

Preflight already run during brainstorming:
- `gitleaks detect --source . --log-opts="--all"` across the full 127-commit history: **no leaks found**. Safe to push to a public repo.
- `~/.claude/scripts/setup-branch-protection.sh` already exists (built in a prior session per `.wolf/buglog.json` bug-029/bug-030) and requires the target repo to be public for classic branch protection to work on a personal (non-paid) GitHub plan — `brain` already satisfies that.
- `github-issue-first` (`skills/github-issue-first/SKILL.md:13-21`) already gates its no-op purely on `git remote get-url origin` resolving to a `github.com` URL plus `gh auth status` succeeding — both will be true the moment the remote is added, so it needs no code change to activate.

## Goals

- Add `github.com/paulchangmckay/brain` as `origin` for `~/.claude` and push full history.
- Apply branch protection to `main` via the existing script, so GitHub itself rejects direct pushes and requires a PR.
- Resolve the one place CLAUDE.md contradicts itself: §3's "Worktree merge pattern" bullet currently instructs a local `git merge` that bypasses the PR/review flow §2 already documents. Rewrite it to a PR-based sequence.

## Non-Goals

- `~/brain` (the personal-knowledge repo) — stays local-only, untouched, separate future decision.
- Renaming the `brain` repo — user confirmed keeping the name despite the content mismatch.
- Any CI/CD pipeline or GitHub Actions workflow — out of scope; this is repo wiring + branch protection + doc fix, not automation.
- Changing worktree creation mechanics (`EnterWorktree`, `git worktree add`) — unaffected, only the merge tail-end changes.
- Retroactively filing GitHub issues for past work — `github-issue-first` applies going forward only.

## 1. Remote Wiring

```
git remote add origin https://github.com/paulchangmckay/brain.git
git push -u origin main
```

Both local and remote default branch are already `main` — no rename needed. `gh` is already authenticated with `repo` scope (confirmed), so no additional auth setup.

## 2. Branch Protection

Run the existing script as-is (no modification needed):

```
scripts/setup-branch-protection.sh paulchangmckay brain main
```

This applies `required_pull_request_reviews: { required_approving_review_count: 0 }` (solo maintainer — the gate is "went through a PR," not "got approved by a second person") and `enforce_admins: true`, so direct pushes to `main` — including from the repo owner — are rejected by GitHub. Confirmed idempotent per the script's existing test suite (`scripts/setup-branch-protection.test.js`).

## 3. CLAUDE.md §3 Merge-Pattern Fix

Current text (the bullet to replace):

> **Worktree merge pattern:** After committing in a worktree, `git checkout main` fails from inside it (main is checked out in the parent). Exit sequence: `ExitWorktree` (keep) → `git -C /Users/paulmckay/.claude merge <branch>` → `git worktree remove .claude/worktrees/<name> --force` → `git branch -d <branch>`.

Replacement sequence:

> **Worktree merge pattern:** After committing in a worktree, `git checkout main` fails from inside it (main is checked out in the parent), and — now that branch protection is active — a local `git merge` into `main` would be rejected by GitHub on push anyway. Exit sequence: `ExitWorktree` (keep) → push the branch (`git push -u origin <branch>`) → `gh pr create` → wait for explicit user approval to merge (per CLAUDE.md §2's existing "never merge without an explicit yes" rule, unchanged) → `gh pr merge --squash` → `git -C /Users/paulmckay/.claude pull origin main` → `git worktree remove .claude/worktrees/<name> --force` → `git branch -d <branch>`.

Squash merge is the default merge strategy: worktree branches may carry several WIP commits, and squashing keeps `main` at one clean commit per logical change. This is a convention choice, not a GitHub setting — `gh pr merge` takes the strategy as a flag per invocation.

No other CLAUDE.md sections reference the old local-merge pattern; §2's table already describes the issue → worktree → TDD → verification → review → explicit-approval-merge pipeline this fix aligns §3 with.

## Files Changed

| File | Change |
|------|--------|
| `~/.claude` (git config) | Add `origin` remote → `github.com/paulchangmckay/brain`, push full history |
| GitHub (`paulchangmckay/brain`) | Branch protection applied to `main` via existing `scripts/setup-branch-protection.sh` |
| `~/.claude/CLAUDE.md` | §3 "Worktree merge pattern" bullet rewritten: local `git merge` → push branch / `gh pr create` / explicit-approval wait / `gh pr merge --squash` / `git pull` |

## Verification

- `git remote -v` shows `origin` pointing at the correct URL.
- `git ls-remote origin main` resolves after push, and `git log origin/main --oneline -1` matches local `main` HEAD.
- `gh api repos/paulchangmckay/brain/branches/main/protection --jq .enforce_admins.enabled` returns `true` — this is sufficient evidence; no live-fire direct-push test against `main` (avoids a throwaway commit/reset cycle against a now-protected branch for no added certainty).
- CLAUDE.md §3 no longer contains a `git -C ... merge` instruction; grep confirms.
