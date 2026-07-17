---
title: "Infrastructure Layer"
description: "OpenWolf integration: hooks, gates, and worktree mechanics."
---

- OpenWolf protocol enforcement (anatomy checks, buglog cross-references, memory updates) is detailed in [OpenWolf Integration](/openwolf) and enforced via `.claude/rules/openwolf.md`.
- Hooks provide real enforcement, not just prose: a pre-read-check blocks re-reads within 10 minutes, and a grilling-gate hook blocks `writing-plans` unless `grilling` already ran this session.
- A local git pre-commit hook runs shellcheck, eslint(security), and gitleaks on staged files.
- Worktree mechanics are load-bearing: absolute-path edits inside a worktree still hit the main working tree, and merging back out requires a specific exit/merge/remove sequence.
- Model routing guidance (Haiku vs. Sonnet vs. Opus, when to use extended thinking) lives here too.

Source of truth: `CLAUDE.md` § 3 Infrastructure Layer and `.claude/rules/openwolf.md`.
