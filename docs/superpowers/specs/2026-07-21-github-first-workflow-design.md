# GitHub-First Workflow for `~/.claude` — Design

## Context

`~/.claude` is git-tracked but has never had a remote — every commit so far (127 of them) landed straight on `main` from local sessions. CLAUDE.md §2 already documents a GitHub-integrated pipeline (`github-issue-first` before code touches, `requesting-code-review` before merge, explicit-approval-only merges) and §3 already references worktree/PR mechanics, but none of it has ever actually run: `github-issue-first` no-ops silently whenever `git remote get-url origin` fails to resolve, which it always has.

The user has learned more about GitHub and wants `~/.claude` development to stop being local-first, using `https://github.com/paulchangmckay/brain` as the remote. That repo is otherwise used as the storage root for the `gbrain` MCP server (a *separate* personal-knowledge system — people/companies/concepts/decisions — with its own local git repo, currently 0 commits, no remote). Scoping questions resolved this out: `brain` will host `~/.claude` only; the knowledge base stays untouched for now; the repo keeps its current name despite the mismatch.

**Correction, discovered during Task 4 execution:** this doc originally stated the remote was "empty, 0 commits" — that was never actually verified against the remote (only the local `~/brain` directory, which is genuinely 0-commit, was checked; the two were conflated). The remote in fact has 3 commits from 2026-06-29 — "Initial commit", "Add files via upload" (a 220KB `claude-transfer.zip`, too small to be a full `~/.claude` backup), "Delete claude-transfer.zip" — leaving a trivial current tree (one `README.md`, "# brain"). Shares no history with `~/.claude`. User decision: force-push, after tagging the remote's current state locally as a recoverable backup first (see Task 4 in the plan for the exact sequence).

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

## 1. Pre-Existing Working-Tree State (must land before push)

Grilling surfaced that the working tree already carries uncommitted changes unrelated to this spec: `CLAUDE.md` has a ~20-line diff (prior `session-reflect` Phase 2 learnings — e.g. the `CLAUDE_CWD` dead-variable note, submodule-transfer script reference), plus modified `.wolf/anatomy.md`, `buglog.json`, `cerebrum.md`, `memory.md`, `observations.md`. None of it touches the "Worktree merge pattern" bullet this spec rewrites, so there's no content conflict — but it must be resolved before this spec's own commits, so history stays separable and the initial push starts from a fully-committed tree:

1. Commit the existing accumulated-learnings diff (`CLAUDE.md` + `.wolf/*.md`) as its own commit, separate from this spec's changes.
2. Add `.wolf/_writecount-*.json`, `.wolf/*.md.bak`, and `docs-site/.wolf/` to `.gitignore` — confirmed ephemeral per-session runtime state (same category as the already-gitignored `.wolf/_skill-gate-*.json` / `.wolf/_last-seen-head`), just missing from the existing pattern list. Commit the `.gitignore` addition; do not commit the stray files themselves.

## 2. Remote Wiring, Doc Fix, and Push (bootstrapping order)

Grilling also surfaced a bootstrapping paradox: if branch protection (§3, below) goes live *before* this spec's own CLAUDE.md fix is committed, that commit would need to go through the very worktree/PR flow the fix is meant to finish enabling — which doesn't exist yet. Resolution: do all local commits first, while `main` is still directly writable, and only apply protection once the repo is in its target end-state.

Order:
1. Add `origin` remote: `git remote add origin https://github.com/paulchangmckay/brain.git`.
2. Make the CLAUDE.md §3 merge-pattern fix (below) as its own commit, directly on local `main` — this is setup work finishing the mechanism, not subject to the mechanism yet.
3. Fetch the remote and tag its current tip locally as `pre-claude-first-push-backup` (recoverable backup — see Context's "Correction" note: the remote is not actually empty), then push with `git push --force-with-lease -u origin main`. Both local and remote default branch are already `main` — no rename needed. `gh` is already authenticated with `repo` scope, so no additional auth setup.
4. Only then apply branch protection (§3).

## 3. Branch Protection

Run the existing script as-is (no modification needed):

```
scripts/setup-branch-protection.sh paulchangmckay brain main
```

This applies `required_pull_request_reviews: { required_approving_review_count: 0 }` (solo maintainer — the gate is "went through a PR," not "got approved by a second person") and `enforce_admins: true`, so direct pushes to `main` — including from the repo owner — are rejected by GitHub from this point forward. Confirmed idempotent per the script's existing test suite (`scripts/setup-branch-protection.test.js`).

Grilling also raised the script's hardcoded `required_status_checks: { strict: true, contexts: [] }` — with zero contexts, no CI check is actually required to merge, but `strict: true` still requires a PR branch to be up-to-date with `main` before merging, and this repo has no GitHub Actions workflow behind that constraint. **Decision: keep the script as-is, unmodified.** The friction (occasional rebase/update before merging a long-lived branch) is minor for a solo-maintainer repo with infrequent concurrent branches, and isn't worth diverging from the already-tested script.

## 4. CLAUDE.md §3 Merge-Pattern Fix

Current text (the bullet to replace):

> **Worktree merge pattern:** After committing in a worktree, `git checkout main` fails from inside it (main is checked out in the parent). Exit sequence: `ExitWorktree` (keep) → `git -C /Users/paulmckay/.claude merge <branch>` → `git worktree remove .claude/worktrees/<name> --force` → `git branch -d <branch>`.

Replacement sequence:

> **Worktree merge pattern:** After committing in a worktree, `git checkout main` fails from inside it (main is checked out in the parent), and — now that branch protection is active — a local `git merge` into `main` would be rejected by GitHub on push anyway. Exit sequence: `ExitWorktree` (keep) → push the branch (`git push -u origin <branch>`) → `gh pr create` → wait for explicit user approval to merge (per CLAUDE.md §2's existing "never merge without an explicit yes" rule, unchanged) → `gh pr merge --squash` → `git -C /Users/paulmckay/.claude pull origin main` → `git worktree remove .claude/worktrees/<name> --force` → `git branch -d <branch>`.

Squash merge is the default merge strategy: worktree branches may carry several WIP commits, and squashing keeps `main` at one clean commit per logical change. This is a convention choice, not a GitHub setting — `gh pr merge` takes the strategy as a flag per invocation.

No other CLAUDE.md sections reference the old local-merge pattern; §2's table already describes the issue → worktree → TDD → verification → review → explicit-approval-merge pipeline this fix aligns §3 with.

## Files Changed

| File | Change | Commit |
|------|--------|--------|
| `~/.claude/CLAUDE.md`, `.wolf/anatomy.md`, `.wolf/buglog.json`, `.wolf/cerebrum.md`, `.wolf/memory.md`, `.wolf/observations.md` | Land pre-existing accumulated `session-reflect` learnings, unrelated to this spec | 1 (pre-existing state) |
| `~/.claude/.gitignore` | Add `.wolf/_writecount-*.json`, `.wolf/*.md.bak`, `docs-site/.wolf/` | 2 (pre-existing state) |
| `~/.claude/CLAUDE.md` | §3 "Worktree merge pattern" bullet rewritten: local `git merge` → push branch / `gh pr create` / explicit-approval wait / `gh pr merge --squash` / `git pull` | 3 (this spec) |
| `~/.claude` (git config) | Add `origin` remote → `github.com/paulchangmckay/brain`; tag its pre-existing tip as `pre-claude-first-push-backup`; force-push (`--force-with-lease`) all commits through #3 | — (`git remote add`/`git tag`/`git push`, not a commit) |
| GitHub (`paulchangmckay/brain`) | Branch protection applied to `main` via existing `scripts/setup-branch-protection.sh`, run *after* the push above | — (API call, not a commit) |

## Verification

- `git status --porcelain` is clean before the `origin` remote is added (confirms commits 1–3 landed and nothing was left stray).
- `.gitignore` contains the three new patterns, and `git status --porcelain` no longer lists `_writecount-*`/`.bak`/`docs-site/.wolf/` as untracked.
- `git remote -v` shows `origin` pointing at the correct URL.
- `git log pre-claude-first-push-backup --oneline` shows the remote's 3 pre-existing commits, confirming the backup tag captured them before the force-push.
- `git ls-remote origin main` resolves after push, and `git log origin/main --oneline -1` matches local `main` HEAD (which must include the CLAUDE.md §3 fix commit).
- `gh api repos/paulchangmckay/brain/branches/main/protection --jq .enforce_admins.enabled` returns `true` — this is sufficient evidence; no live-fire direct-push test against `main` (avoids a throwaway commit/reset cycle against a now-protected branch for no added certainty).
- CLAUDE.md §3 no longer contains a `git -C ... merge` instruction; grep confirms.
