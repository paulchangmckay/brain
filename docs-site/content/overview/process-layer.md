---
title: "Process Layer"
description: "Which skill to invoke for which moment in the workflow."
---

The Process Layer is the part of `CLAUDE.md` that decides, at any given
moment, which skill the agent is required to reach for. It's organized as a
trigger table: specific points in a workflow — before any feature work,
before touching code, when a bug or test failure appears, before merging or
opening a pull request — each maps to a required skill, rather than leaving
the agent to decide case by case whether process applies. The table itself,
and what each named skill actually does, lives on the
[Skills Reference](/skills) page; this page is about the shape of the flow,
not a restatement of every row.

The core of that flow is a gated sequence, and it's worth reading as a
narrative rather than an arrow-chain. Nothing gets built until
`brainstorming` has established intent and design — what's actually being
asked for, and roughly how it will work — because skipping straight to code
is where scope and assumptions quietly go unexamined. Once a design exists,
`grilling` puts it through a mandatory stress-test: a deliberate, structured
interrogation of the plan's soft spots, run before any implementation, not
after something has already gone wrong. Only once a design has survived that
does `writing-plans` turn it into concrete, ordered steps. Before a single
line of implementation code is touched, `github-issue-first` puts a durable
record of that plan into GitHub, so the reasoning behind the work outlives
the session that produced it. From there, `test-driven-development` and
`using-git-worktrees` govern how the code actually gets written — tests
before implementation, and an isolated workspace so in-progress work can't
bleed into the main checkout. Finally, nothing merges without clearing two
more gates: `verification-before-completion`, which demands evidence a
change actually works rather than an assertion that it does, and
`requesting-code-review`, which puts a review pass between "done" and
"merged."

Layered on top of that flow is a three-tier **Project Tier** system — 0
Prototype, 1 MVP, 2 Production — because not every project deserves the same
amount of ceremony. A throwaway prototype with no real data and a single
developer only needs a security floor: no secrets in code, no obvious
injection holes. An MVP with real users adds authentication, a real secrets
manager, basic CI, and input validation. A production system handling real
customer data runs the full, strict posture, with every merge-blocking gate
active. The point of tiering is that rigor should scale with what's actually
at stake rather than being maximal everywhere by default — but certain
triggers force an immediate promotion regardless of where a project started:
real customer data showing up, multi-tenant isolation becoming a
requirement, regulated data like PII or anything GDPR-relevant entering the
picture, a second contributor joining, or the project going out onto the
public internet. Any one of those is reason enough to escalate the tier
immediately, not at the next convenient checkpoint.

Source of truth: `CLAUDE.md` § 2 Process Layer.
