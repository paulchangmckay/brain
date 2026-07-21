# Tooling Friction Hardening — Design

## Context

"The Pipeline" artifact and `~/.claude/CLAUDE.md` Section 3 document eight friction points encountered while actually running this repo's Claude Code setup: two worktree-tool gotchas (wrong-repo targeting, absolute-path edits escaping the worktree), a stale-hooks-mid-worktree gap, a submodule-commit-transfer gap, a plugin-registration drift that caused `Skill()` calls to fail once already, a missing browser-automation capability for real click-through verification, and a PR-merge race that silently dropped content between two of the same session's pushes.

Five parallel research passes (this session, prior to this doc) confirmed all eight are real, not stale:

- **Worktree mechanics**: no existing precondition check prevents `EnterWorktree` from silently targeting the wrong repo; nothing detects an absolute-path edit escaping an active worktree; nothing reminds a session that hooks changed by a merge aren't live until restart.
- **Concurrency**: `.wolf/memory.md` is append-only (safe) and `anatomy.md`/`buglog.json` use atomic temp+rename writes (safe from corruption), but `cerebrum.md` has no write hook at all — it's hand-edited by the model. Separately, `hooks/session-start.js` derives its own session ID from wall-clock minute granularity (distinct from Claude Code's real per-session UUID, which `hooks/pre-skill-gate.js` already reads correctly off the hook payload) and unconditionally overwrites a shared `.wolf/hooks/_session.json` — two sessions starting in the same minute clobber each other's state. This is a confirmed live bug, not a hypothetical.
- **Plugin registration**: `installed_plugins.json`'s recorded `gitCommitSha` for `superpowers@superpowers-dev` (`c584da0d...`) already does not match the submodule's live HEAD (`1d971e2...`) — file contents still happen to match today, but nothing would catch it the day they don't.
- **Browser automation**: a `playwright` MCP server is already configured in `~/.claude/mcp_servers.json`, but that file appears disconnected from Claude Code's actual config surface — the mechanism that's actually live is `~/.claude.json`'s top-level `mcpServers` object (where `gbrain` is registered and working today) plus a per-project `enabledMcpjsonServers` allowlist. `settings.json` has zero MCP-related keys at all. `html-export`'s own separate Playwright pipeline is documented as broken (ESM/CJS conflict, missing local package) — out of scope here per the scoping decision below.
- **Merge-race safety**: neither `verification-before-completion` nor `superpowers:finishing-a-development-branch` fetch or diff the remote after a push/merge. Branch protection setup exists only as ad hoc `gh api` calls recorded in `buglog.json`/`cerebrum.md`, not as a committed, reproducible script.

A grilling pass (below the Non-Goals section) surfaced two further corrections: the worktree wrong-repo check as originally drafted was built on `CLAUDE_CWD`, a variable that is referenced with a `${CLAUDE_CWD:-default}` fallback in three places in `settings.json` but is never actually assigned anywhere in this repo — every one of those expressions silently evaluates to its hardcoded default regardless of the session's real location. And the `file_path`/`cwd` fields assumed available to `Edit`/`Write`-matched PreToolUse hooks are unverified in this repo (only a `Skill`-matcher hook, `pre-skill-gate.js`, is confirmed to read `session_id`/`cwd` from stdin JSON). Both are addressed below.

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

**`hooks/worktree-repo-guard.js`** (new PreToolUse hook, matcher on `EnterWorktree`): compares the hook's own `cwd` field (read from the PreToolUse stdin JSON payload, the same field `pre-skill-gate.js` already reads correctly for its `session_id`/`cwd`) against the literal constant `$HOME/.claude` — not `CLAUDE_CWD`, which is never actually assigned anywhere in this repo and would silently always evaluate to its hardcoded default. On mismatch, **block** the call — there's no legitimate case for `EnterWorktree` firing from a secondary project — with a message pointing at the working substitute: `git worktree add <path> -b <branch> origin/<base>`.

**`hooks/worktree-path-guard.js`** (new PreToolUse hook, matcher on `Edit`/`Write`, separate file per the repo's one-hook-per-concern convention): when the session is inside an active worktree (reusing `using-git-worktrees`' existing `GIT_DIR` vs `GIT_COMMON_DIR` detection), and the tool's `file_path` argument is absolute and resolves outside the worktree directory, **warn** (do not block) — legitimate reasons exist to touch a file outside the worktree on purpose, so this should surface the risk, not prevent it. Before writing this hook's real logic, first confirm `file_path` is actually present in the `Edit`/`Write` PreToolUse stdin payload via a throwaway diagnostic hook (see Sequencing, below) — this repo has no existing hook that parses `file_path` from JSON to copy from.

**Stop-hook addition**: after a merge/pull into main, if the touched files include anything under `hooks/` or `settings.json`, print a visible reminder that new hook behavior isn't live until the session restarts. Extends the existing Stop-hook block that already checks for stale merged worktrees at session end.

**`scripts/submodule-transfer.sh <submodule-path> <source-worktree> <commit-sha>`**: automates the known-good sequence — create a named branch at `<commit-sha>` in the source worktree's submodule clone, then `git fetch <path-to-source-submodule-clone> <branch-name>` + `git branch -f <branch-name> FETCH_HEAD` in the target clone — as one command instead of the manual multi-step process currently recorded only in CLAUDE.md prose.

## 2. Shared-State Concurrency

**Fix `hooks/session-start.js`** (implement first, within this phase): replace its wall-clock-minute-derived session ID with Claude Code's real `session_id`, read off the hook's stdin JSON payload exactly as `hooks/pre-skill-gate.js` already does. Scope `.wolf/hooks/_session.json`'s contents (or its filename, following the `_skill-gate-<session>--<skill>.json` naming precedent) per real session ID, so two sessions starting in the same minute can no longer overwrite each other's `files_read`/`edit_counts` state. Confirm the file's exact current structure by reading it directly during implementation before changing its scoping.

**`hooks/cerebrum-write-guard.js`** (new PreToolUse hook, matcher on `Edit`/`Write` targeting `cerebrum.md`; implement second, after the fix above): reuses `pre-read-check.js`'s mtime-comparison pattern — records the file's mtime at last read for this session (keyed by the now-corrected real session ID from `session-start.js`), and **warns** (non-blocking) if the current mtime has changed since, meaning another session wrote to it in between. If `worktree-path-guard.js` (Phase 1) hasn't already verified `file_path`'s presence in the `Edit`/`Write` stdin payload, do that diagnostic check here instead — whichever of the two lands first confirms it for the other.

## 3. Registration & Tooling Config

**`scripts/plugin-health-check.js`** (new): compares `installed_plugins.json`'s recorded `gitCommitSha` for `superpowers@superpowers-dev` against `git -C ~/.claude/superpowers rev-parse HEAD`, and separately verifies every `superpowers:*` skill CLAUDE.md's process table references actually exists in the installed plugin cache. Reports drift to the daemon log (and/or `.wolf/memory.md`) rather than failing silently.

Added as a new entry in **`.wolf/cron-manifest.json`**, alongside the existing anatomy-rescan/token-audit/cerebrum-reflection jobs, at a **daily** cadence — frequent enough that a submodule update or a new CLAUDE.md skill reference surfaces drift before the next session, without adding meaningful load (the check itself is just a couple of `git rev-parse`/file-existence calls).

**Enable Playwright MCP**: add a `playwright` entry to `~/.claude.json`'s top-level `mcpServers` object, the same way `gbrain` is already registered and working there — not `settings.json`, which has no MCP-related keys at all, and not `mcp_servers.json`, which appears disconnected from Claude Code's actual config surface. Whether `mcp_servers.json` should then be folded in or left alone is a separate open question (below) — verify what, if anything, reads it before deciding. `claude-infra-reference`'s existing note about the server gets updated to reflect that it's enabled, not just configured.

## 4. Merge-Race Safety

**`verification-before-completion`**: add a new row to its Gate Function / Common Failures table specifically for claims about a push/merge having landed — `git fetch origin && git diff origin/<branch> HEAD` (or against the intended file set) before stating the claim, closing the gap where the skill currently treats "evidence" as a point-in-time result with no concept of the remote moving underneath it.

**`superpowers:finishing-a-development-branch`**: add the same fetch-and-diff step to its Option 2 (push + PR) path, after `git push -u origin <feature-branch>` and before declaring the PR ready. Since this skill lives in the `superpowers` submodule (see Non-Goals), the change is committed in the submodule's own checkout and folded into the existing `local-customizations` branch there — not pushed upstream.

**`scripts/setup-branch-protection.sh`** (new): commits the known-good `gh api repos/<owner>/<repo>/branches/main/protection` sequence — the `--input -` JSON-heredoc form that avoids the `-f` shorthand's 422 (non-JSON types), plus the already-learned caveat that classic branch protection needs a paid plan or a public repo. Idempotent, parameterized by owner/repo.

## Files Changed

| File | Change |
|------|--------|
| `~/.claude/hooks/worktree-repo-guard.js` | New — blocks `EnterWorktree` when session cwd (from stdin JSON) doesn't match `$HOME/.claude` |
| `~/.claude/hooks/worktree-path-guard.js` | New — warns on an absolute-path `Edit`/`Write` that escapes an active worktree |
| `~/.claude/settings.json` | Extend existing Stop hook with a post-merge hooks/settings.json-touched reminder |
| `~/.claude/scripts/submodule-transfer.sh` | New — automates named-branch submodule commit transfer between worktree clones |
| `~/.claude/hooks/session-start.js` | Fix — use real `session_id` instead of wall-clock-derived ID; scope `_session.json` per session |
| `~/.claude/hooks/cerebrum-write-guard.js` | New — mtime-warn on `Edit`/`Write` targeting `cerebrum.md` |
| `~/.claude/scripts/plugin-health-check.js` | New — compares `installed_plugins.json` gitCommitSha to submodule HEAD; flags missing referenced skills |
| `~/.claude/.wolf/cron-manifest.json` | Add daily `plugin-health-check.js` task |
| `~/.claude.json` | Add `playwright` to top-level `mcpServers`, alongside the existing `gbrain` entry |
| `~/.claude/skills/claude-infra-reference/SKILL.md` | Update Playwright MCP note from "configured" to "enabled" |
| `~/.claude/skills/verification-before-completion/SKILL.md` | Add fetch-and-diff evidence row for push/merge claims |
| `~/.claude/superpowers/skills/finishing-a-development-branch/SKILL.md` (submodule, `local-customizations` branch) | Add fetch-and-diff step to push+PR path |
| `~/.claude/scripts/setup-branch-protection.sh` | New — reproducible `gh api` branch-protection setup |

## Sequencing

Phases 1, 3, and 4 are independently orderable — no phase depends on another. Phase 2 has one internal ordering constraint: `session-start.js`'s session-ID fix lands before `cerebrum-write-guard.js`, since the guard's per-session bookkeeping should key off the corrected session ID rather than the old wall-clock one.

One cross-phase note, not a hard dependency: `worktree-path-guard.js` (Phase 1) and `cerebrum-write-guard.js` (Phase 2) both need the same fact confirmed — whether `file_path` is present in the `Edit`/`Write` PreToolUse stdin JSON payload, unverified anywhere in this repo today. Whichever of the two is implemented first should confirm it via a throwaway diagnostic hook (dump stdin to a scratch file, run one real edit, inspect, delete the diagnostic); the second can then build directly on the confirmed field names without re-verifying.

## Open Questions for the Plan Stage

- Exact `mcpServers` entry syntax/fields needed for `playwright` in `~/.claude.json` (`gbrain`'s existing entry is the template, but `playwright`'s own required args/env may differ — confirm during implementation).
- Whether `~/.claude/mcp_servers.json` is dead weight safe to leave alone, or read by something else that should be reconciled once `playwright` is registered the working way in `~/.claude.json`.
- Exact internal structure of `.wolf/hooks/_session.json` (needed to scope it per-session correctly) — to be confirmed by reading the file directly during implementation, not assumed from this design.
