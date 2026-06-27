---
name: ba
description: Business Analysis documentation agent. Spawn the ba-agent:ba sub-agent with the user's brief as the prompt to produce a full BA package in isolation.
argument-hint: [brief]
---

Spawn the `ba-agent:ba` sub-agent with the user's brief as the prompt.

If the `ba-agent:ba` sub-agent is not available in this session (plugin not yet loaded), fall back to reading `~/.claude/Agents/ba-agent/CLAUDE.md` and following it inline, resolving all skill paths relative to `~/.claude/Agents/ba-agent/`.
