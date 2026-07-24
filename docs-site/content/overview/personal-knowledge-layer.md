---
title: "Personal Knowledge Layer"
description: "The brain MCP server and how it relates to cerebrum and native auto-memory."
---

Not everything worth remembering belongs to a single project, and this
harness keeps that distinction explicit rather than letting one memory
system absorb everything. The `brain` MCP server is a filesystem server
rooted at `~/brain/`, organized into a handful of subdirectories — people,
companies, concepts, decisions — that hold knowledge meant to outlive any
one codebase: who someone is, what a company does, a concept worth defining
once and referring back to, or a decision made outside the context of a
specific piece of code. Before answering a question that touches any of
that — about a person, a company, or a past decision — the relevant `brain`
subdirectory gets listed and read first, rather than answered from
recollection alone. Significant decisions get written back the same way,
so the layer accumulates rather than resets.

That's deliberately kept separate from `.wolf/cerebrum.md`, which is
project-specific: patterns, conventions, and corrections that only make
sense in the context of the codebase they were learned in. A convention
about how one project names its test files has no business living
alongside a personal note about a person or a company — mixing the two
would make both harder to trust. There's a third layer again, distinct from
both: Claude Code's native auto-memory, which persists facts about working
with the coding agent itself — preferences, feedback, recurring friction —
across every project, but is not a place for either cross-project personal
knowledge or project-specific implementation patterns.

The reason all three stay separate rather than converging into one memory
store is that each answers a different question — "what do I know about
this person or company," "what has this specific codebase taught me," and
"what have I learned about working with this tool" are genuinely different
things, and a system that let them blur would eventually give confidently
wrong answers to at least one of them.

Source of truth: `CLAUDE.md` § 5 Personal Knowledge Layer.
