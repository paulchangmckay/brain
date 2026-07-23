---
title: "New Project Bootstrap"
description: "How a project gets its .wolf/ directory and self-learning memory."
---

Everything described in the [Infrastructure Layer](/overview/infrastructure-layer)
and [Process Layer](/overview/process-layer) pages is specific to how this
harness enforces itself — but none of it is specific to *this* repo. The
bootstrap step is what makes that portability concrete: it's how a brand-new
project, with no history and no tracking of its own, gets wired up with the
same enforcement this repo relies on.

Bootstrapping a project starts with an init step that creates that project's
own tracking directory and registers the same hook-based enforcement used
here — the pre-read checks, the skill-gating hooks, the commit-boundary
scans — so a fresh project isn't working from a weaker or looser version of
the rules. From there, a scan step builds an initial map of the project's own
files: a baseline understanding of what exists before any self-learning can
happen on top of it. Finally, a background daemon starts, running the same
self-learning memory loop this repo uses to accumulate patterns and
corrections over time, so the new project begins building its own project-
specific memory from day one rather than starting from a blank slate every
session.

The point of calling this out as its own page, rather than folding it into
the infrastructure description, is that the harness is designed to travel:
applying it to a new project is meant to be a short, repeatable bootstrap
sequence, not a one-off setup that only makes sense for `~/.claude` itself.

Source of truth: `CLAUDE.md` § 4 New Project Bootstrap.
