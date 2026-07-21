# Tooling Friction Hardening — Design

## Context

"The Pipeline" artifact and `~/.claude/CLAUDE.md` Section 3 document eight friction points encountered while actually running this repo's Claude Code setup: two worktree-tool gotchas (wrong-repo targeting, absolute-path edits escaping the worktree), a stale-hooks-mid-worktree gap, a submodule-commit-transfer gap, a plugin-registration drift that caused `Skill()` calls to fail once already, a missing browser-automation capability for real click-through verification, and a PR-merge race that silently dropped content between two of the same session's pushes. Two more (no browser automation, PR-merge race) round out the eight.

Five parallel research passes (this session, prior to this doc) confirmed all eight are real, not stale:

- **Worktree mechanics**: no existing precondition check prevents `EnterWorktree` from silently targeting the wrong repo; nothing detects an absolute-path edit escaping an active worktree; nothing reminds a session that hooks changed by a merge aren't live until restart.
- **Concurrency**: `.wolf/memory.md` is append-only (safe) and `anatomy.md`/`buglog.json` use atomic temp+rename writes (safe from corruption), but `cerebrum.md` has no write hook at all — it's hand-edited by the model. Separately, `hooks/session-start.js` derives its own session ID from wall-clock minute granularity (distinct from Claude Code's real per-session UUID, which `hooks/pre-skill-gate.js` already reads correctly off the hook payload) and unconditionally overwrites a shared `.wolf/hooks/_session.json` — two sessions starting in the same minute clobber each other's state. This is a confirmed live bug, not a hypothetical.
- **Plugin registration**: `installed_plugins.json`'s recorded `gitCommitSha` for `superpowers@superpowers-dev` (`c584da0d...`) already does not match the submodule's live HEAD (`1d971e2...`) — file contents still happen to match today, but nothing would catch it the day they don't.
- **Browser automation**: a `playwright` MCP server is already configured in `mcp_servers.json`, but `settings.json` has zero permission/enablement entries for it. `html-export`'s own separate Playwright pipeline is documented as broken (ESM/CJS conflict, missing local package) — out of scope here per the scoping decision below.
- **Merge-race safety**: neither `verification-before-completion` nor `superpowers:finishing-a-development-branch` fetch or diff the remote after a push/merge. Branch protection setup exists only as ad hoc `gh api` calls recorded in `buglog.json`/`cerebrum.md`, not as a committed, reproducible script.

## Goals

- Give `EnterWorktree` misuse (wrong repo) and worktree-escaping absolute-path edits a real, hook-enforced check instead of relying on remembered prose.
- Make the "hooks aren't live mid-worktree" gap impossible to silently miss after a merge.
- Turn submodule commit transfer between worktree clones into a one-command operation.
- Fix the confirmed `session-start.js` session-ID collision bug, and add a non-blocking staleness warning to `cerebrum.md` writes.
- Catch plugin/submodule registration drift automatically, on a recurring cadence, before it causes another silent `Skill()` failure.
- Make the already-configured Playwright MCP server actually usable.
- Close the merge-race evidence gap in the two skills that make completion/merge claims, and make branch protection setup reproducible instead of tribal knowledge.

## Non-Goals

- Fixing `html-export`'s own broken Playwright pipeline — discovered along the way, but out of scope per the browser-automation scoping decision (the friction item was specifically about interactive verification, which the MCP server addresses).
- A hard-lock concurrency model for `cerebrum.md` — mtime-warn only, per the concurrency scoping decision. A future round can revisit if the warn-only approach proves insufficient.
- Extending atomic-write or lock protection to `anatomy.md`/`buglog.json` — their existing temp+rename pattern was assessed as adequate; this design does not touch them.
- Pushing any submodule-side skill change upstream. `finishing-a-development-branch` lives in the `superpowers` submodule (third-party upstream, not a personal fork) — its change lands on the existing `local-customizations` branch per CLAUDE.md Section 6, never pushed to `obra/superpowers`.
- A general CI/CD pipeline or GitHub Actions workflow — `setup-branch-protection.sh` is a local script invoked manually per repo, not an automated pipeline.

## 1. Worktree Mechanics

**`hooks/worktree-guard.js`** (new PreToolUse hook):

- Matcher on `EnterWorktree`: compare the session's actual cwd against `${CLAUDE_CWD:-$HOME/.claude}` (the same primary-repo resolution the existing stale-worktree Stop hook already uses). On mismatch, **block** the call — there's no legitimate case for `EnterWorktree` firing from a secondary project — with a message pointing at the working substitute: `git worktree add <path> -b <branch> origin/<base>`.
- Matcher on `Edit`/`Write`: when the session is inside an active worktree (reusing `using-git-worktrees`' existing `GIT_DIR` vs `GIT_COMMON_DIR` detection), and the tool's `file_path` argument is absolute and resolves outside the worktree directory, **warn** (do not block) — legitimate reasons exist to touch a file outside the worktree on purpose, so this should surface the risk, not prevent it.

**Stop-hook addition**: after a merge/pull into main, if the touched files include anything under `hooks/` or `settings.json`, print a visible reminder that new hook behavior isn't live until the session restarts. Extends the existing Stop-hook block that already checks for stale merged worktrees at session end.

**`scripts/submodule-transfer.sh <submodule-path> <source-worktree> <commit-sha>`**: automates the known-good sequence — create a named branch at `<commit-sha>` in the source worktree's submodule clone, then `git fetch <path-to-source-submodule-clone> <branch-name>` + `git branch -f <branch-name> FETCH_HEAD` in the target clone — as one command instead of the manual multi-step process currently recorded only in CLAUDE.md prose.

## 2. Shared-State Concurrency

**Fix `hooks/session-start.js`**: replace its wall-clock-minute-derived session ID with Claude Code's real `session_id`, read off the hook's stdin JSON payload exactly as `hooks/pre-skill-gate.js` already does. Scope `.wolf/hooks/_session.json`'s contents (or its filename, following the `_skill-gate-<session>--<skill>.json` naming precedent) per real session ID, so two sessions starting in the same minute can no longer overwrite each other's `files_read`/`edit_counts` state.

**`hooks/cerebrum-write-guard.js`** (new PreToolUse hook, matcher on `Edit`/`Write` targeting `cerebrum.md`): reuses `pre-read-check.js`'s mtime-comparison pattern — records the file's mtime at last read for this session, and **warns** (non-blocking) if the current mtime has changed since, meaning another session wrote to it in between.

## 3. Registration & Tooling Config

**`scripts/plugin-health-check.js`** (new): compares `installed_plugins.json`'s recorded `gitCommitSha` for `superpowers@superpowers-dev` against `git -C ~/.claude/superpowers rev-parse HEAD`, and separately verifies every `superpowers:*` skill CLAUDE.md's process table references actually exists in the installed plugin cache. Reports drift to the daemon log (and/or `.wolf/memory.md`) rather than failing silently.

Added as a new entry in **`.wolf/cron-manifest.json`**, alongside the existing anatomy-rescan/token-audit/cerebrum-reflection jobs — exact cadence (candidates: matching the 6h anatomy-rescan, or the weekly token-audit) is an open question for the plan stage.

**Enable Playwright MCP**: add the permission/enablement entries `settings.json` needs for the `playwright` server already defined in `mcp_servers.json` to actually be usable without extra prompting. `claude-infra-reference`'s existing note about the server gets updated to reflect that it's enabled, not just configured.

## 4. Merge-Race Safety

**`verification-before-completion`**: add a new row to its Gate Function / Common Failures table specifically for claims about a push/merge having landed — `git fetch origin && git diff origin/<branch> HEAD` (or against the intended file set) before stating the claim, closing the gap where the skill currently treats "evidence" as a point-in-time result with no concept of the remote moving underneath it.

**`superpowers:finishing-a-development-branch`**: add the same fetch-and-diff step to its Option 2 (push + PR) path, after `git push -u origin <feature-branch>` and before declaring the PR ready. Since this skill lives in the `superpowers` submodule (see Non-Goals), the change is committed in the submodule's own checkout and folded into the existing `local-customizations` branch there — not pushed upstream.

**`scripts/setup-branch-protection.sh`** (new): commits the known-good `gh api repos/<owner>/<repo>/branches/main/protection` sequence — the `--input -` JSON-heredoc form that avoids the `-f` shorthand's 422 (non-JSON types), plus the already-learned caveat that classic branch protection needs a paid plan or a public repo. Idempotent, parameterized by owner/repo.

## Files Changed

| File | Change |
|------|--------|
| `~/.claude/hooks/worktree-guard.js` | New — blocks wrong-repo `EnterWorktree`, warns on worktree-escaping absolute-path edits |
| `~/.claude/settings.json` | Extend existing Stop hook with a post-merge hooks/settings.json-touched reminder; add Playwright MCP permission/enablement entries |
| `~/.claude/scripts/submodule-transfer.sh` | New — automates named-branch submodule commit transfer between worktree clones |
| `~/.claude/hooks/session-start.js` | Fix — use real `session_id` instead of wall-clock-derived ID; scope `_session.json` per session |
| `~/.claude/hooks/cerebrum-write-guard.js` | New — mtime-warn on `Edit`/`Write` targeting `cerebrum.md` |
| `~/.claude/scripts/plugin-health-check.js` | New — compares `installed_plugins.json` gitCommitSha to submodule HEAD; flags missing referenced skills |
| `~/.claude/.wolf/cron-manifest.json` | Add periodic `plugin-health-check.js` task |
| `~/.claude/skills/claude-infra-reference/SKILL.md` | Update Playwright MCP note from "configured" to "enabled" |
| `~/.claude/skills/verification-before-completion/SKILL.md` | Add fetch-and-diff evidence row for push/merge claims |
| `~/.claude/superpowers/skills/finishing-a-development-branch/SKILL.md` (submodule, `local-customizations` branch) | Add fetch-and-diff step to push+PR path |
| `~/.claude/scripts/setup-branch-protection.sh` | New — reproducible `gh api` branch-protection setup |

## Open Questions for the Plan Stage

- `plugin-health-check.js`'s cron cadence — matching the 6h anatomy-rescan job, the weekly token-audit job, or its own interval.
- Exact `settings.json` permission/enablement syntax needed for the `playwright` MCP server — no existing example to copy from in this repo (zero prior `mcp`-related entries), so this needs direct investigation of Claude Code's settings schema during implementation.
- Whether `worktree-guard.js`'s `EnterWorktree` check should be a single hook file with two matchers (as drafted above) or two separate hook files, given the project's existing convention of one hook file per concern (e.g. `pre-skill-gate.js` / `post-skill-record.js` as a pair rather than one combined file).
- Exact internal structure of `.wolf/hooks/_session.json` (needed to scope it per-session correctly) — to be confirmed by reading the file directly during implementation, not assumed from this design.
