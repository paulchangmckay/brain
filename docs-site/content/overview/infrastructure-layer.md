---
title: "Infrastructure Layer"
description: "OpenWolf integration: hooks, gates, and worktree mechanics."
---

Everything the [Process Layer](/overview/process-layer) describes as a
"required" skill would just be a strongly worded suggestion without
something actually checking that it happened. That's the job of the
Infrastructure Layer: it's the enforcement mechanism sitting underneath the
process rules, built around OpenWolf and a set of Claude Code hooks that can
block an action outright rather than merely documenting that it shouldn't
happen. Two examples make the difference concrete. A pre-read-check hook
blocks the agent from re-reading a file it already read in the last ten
minutes if the file hasn't changed — a small guard against burning context
on redundant reads. A separate gate hook blocks the agent from invoking
`writing-plans` at all unless `grilling` has already run earlier in the same
session; the session-scoped check is a marker file, not a note in a prompt
the model could talk itself past. The broader OpenWolf protocol — how
`.wolf/anatomy.md` tracks the shape of the project's files, how
`.wolf/memory.md` keeps a running log of what happened in a session, how
`.wolf/buglog.json` accumulates a searchable history of bugs and their
fixes, and how `.wolf/cerebrum.md` distills that into durable, self-learned
patterns — is covered on its own [OpenWolf Integration](/openwolf) page.

Hooks aren't the only enforcement boundary. A second, independent layer sits
at the git commit boundary itself: a local pre-commit hook runs shellcheck
against shell scripts, an eslint security ruleset against JavaScript, and a
secret-scanner across whatever is staged, before a commit is allowed to
complete. It's deliberately redundant with the hook-based gates above —
enforcement that happens at two different points in the pipeline catches
more than either one would alone, and a hook that got bypassed or a skill
that got skipped still has a second chance to be caught here.

Git worktree isolation is part of this layer too, and it's worth being exact
about why it matters: it's a real mechanical constraint on where file edits
land, not just a convention for how to organize branches. An edit made with
an absolute path while working inside a worktree can still resolve to the
main working tree rather than the isolated copy, silently defeating the
isolation the worktree was supposed to provide. Getting a worktree's changes
back into the main line of work afterward follows a specific, ordered exit
and merge sequence — the exact steps are implementation detail for
contributors working in this repo day to day, not something this overview
needs to walk through, but the sequence exists precisely because a shortcut
here tends to reintroduce the isolation problem the worktree was meant to
solve.

Finally, this layer is where model routing lives as its own explicit
concern rather than an afterthought: cheaper, faster models are the default
for mechanical, well-defined work — log inspection, single-file lookups,
routine subagent tasks — while the more capable, more expensive models are
reserved for genuinely complex, multi-file reasoning where the extra
capability actually changes the outcome. Treating that as a routing
decision, rather than always reaching for the most powerful model available,
is itself a context-budget choice consistent with the philosophy described
on the [Core Philosophy](/overview/core-philosophy) page.

Source of truth: `CLAUDE.md` § 3 Infrastructure Layer and `.claude/rules/openwolf.md`.
