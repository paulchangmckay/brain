---
title: "OpenWolf Integration"
description: "The self-learning memory and enforcement layer OpenWolf adds on top of Claude Code."
---

A fresh conversation with an AI coding agent starts with no memory of
anything that came before it — not the decision made last week, not the bug
that took an hour to root-cause, not the convention the user already asked
for twice. OpenWolf exists to close that gap. It's a project-scoped runtime
layer, rooted in a `.wolf/` directory inside the project itself, that gives
the harness persistent memory and lets it get measurably better at working
on that specific project over time, instead of relearning the same ground
every session.

That memory is split across a small set of files, each doing a distinct
job rather than duplicating the others. One is a map of the project's own
structure, kept up to date so the agent doesn't have to re-discover the
shape of the codebase from scratch at the start of every session — a
standing answer to "where does this live" instead of a fresh search each
time. Another is a plain chronological log: a record of what actually
happened, in order, that a later session (or a human) can scan to
reconstruct how the project got to its current state. A third distills
that raw history into something more durable — learned preferences,
recurring patterns, and specifically a running list of mistakes not to
repeat, so a correction the user gave once doesn't have to be given again.
The fourth is a searchable history of bugs and their fixes, checked before
a new fix is attempted and appended to after one lands, so the same failure
mode doesn't get independently re-debugged from zero every time it
resurfaces.

None of that happens just because it's documented somewhere — a file
nobody is required to check is a file that quietly goes stale. What makes
these files reliable is the same enforcement mechanism described on the
[Infrastructure Layer](/overview/infrastructure-layer) page: protocol
rules define exactly when each file should be read and when it should be
updated, and hooks are what actually check and enforce those rules at the
moment an action happens, rather than leaving it to the agent's judgment
in the moment. The protocol is what turns "the agent should probably keep
notes" into a mechanism that reliably does.

Keeping that memory current would still be a manual chore if it depended
on someone remembering to run it — so a background daemon runs a set of
self-learning crons that consolidate and refine the memory files on their
own schedule. The problem this solves is upkeep: memory that has to be
manually curated tends to be forgotten under deadline pressure, while
memory that updates itself in the background stays useful without asking
anyone to stop and do the bookkeeping.

Source of truth: `.claude/rules/openwolf.md` and `CLAUDE.md` § 3.
