---
title: "Core Philosophy"
description: "The thin-harness, fat-skills operating principle."
---

This repo runs on a "thin harness, fat skills" split: the AI agent itself stays
a lightweight execution layer — deterministic shell tools, a handful of MCP
servers, basic filesystem commands — and almost all of the actual behavior
lives in structured documentation the agent reads and executes against,
rather than in prompt engineering or hard-coded logic.

`CLAUDE.md` is the root of that structure. It isn't a style guide the agent
might follow loosely — it's read as literal, structured data, and the rules
in it are enforced (see [Infrastructure Layer](/overview/infrastructure-layer)
for how). The bet underneath this design: context management, not model
capability, is the real bottleneck in agentic coding. Every layer described
in this reference — skill gating, memory tiers, git worktree isolation —
exists to protect the token window and keep the agent working from accurate,
current information instead of accumulated guesswork.

Source of truth: `CLAUDE.md` § 1 Core Philosophy.
