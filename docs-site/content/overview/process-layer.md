---
title: "Process Layer"
description: "Which skill to invoke for which moment in the workflow."
---

- A trigger table maps moments in the workflow (before feature work, before touching code, when a bug appears, before a PR, ...) to the skill that must run — see the [Skills Reference](/skills) for each skill's own page.
- Core gated flow: `brainstorming` → `grilling` → `writing-plans` → `github-issue-first` → `test-driven-development` → `using-git-worktrees` → implementation → `verification-before-completion` → `requesting-code-review` → merge.
- A three-tier **Project Tier** system (0 Prototype, 1 MVP, 2 Production) scales how much rigor and how many gates are active, with defined promotion triggers (real customer data, multi-tenancy, PII/GDPR, a second contributor, public internet exposure).

Source of truth: `CLAUDE.md` § 2 Process Layer.
