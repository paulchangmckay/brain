---
title: "model-routing"
description: "Use when deciding which model to route an Agent/subagent task to, or when deciding whether to cap reasoning/thinking effort for a task. Elaborates on the compressed model-routing rule in CLAUDE.md Section 3."
---

# Model Routing

The `Agent` tool supports a `model` override (`sonnet`, `opus`, `haiku`, `fable`). CLAUDE.md Section 3 carries the compressed policy inline (visible every session, since dispatch decisions happen fast and mid-flow); this skill holds the reasoning and edge cases behind it.

## Quick Reference

| Model | Use for |
|---|---|
| Haiku | Mechanical subagent work: log/output inspection, single-file lookups, grep-and-report tasks, anything where the "thinking" is really just retrieval |
| Sonnet | Default — most subagent dispatches and all inline work unless one of the other rows clearly applies |
| Opus | Complex multi-file architecture or reasoning tasks: cross-cutting refactors, ambiguous root-cause debugging, design tradeoff analysis |

## Why this split

Haiku is meaningfully cheaper and faster for tasks that don't need reasoning depth — a subagent reading a build log for an error string doesn't benefit from Opus-level reasoning, it benefits from finishing fast. Reserving Opus for genuinely complex work means the cost only shows up where the extra reasoning quality actually changes the outcome.

## Effort / thinking-budget capping

Default effort for routine work. Only reach for extended/deeper thinking when a task has real branching complexity — an architectural tradeoff, a subtle bug with multiple plausible causes, a design with several interacting constraints. Reflexively invoking maximum effort on mechanical tasks (a rename, a straightforward CRUD addition, a config edit) burns thinking tokens without changing the output quality.

**Edge case:** when in doubt between Sonnet and Opus for a subagent task, default to Sonnet — it's easy to re-dispatch a single failed/unsatisfying subagent result at a higher tier than to have over-spent on every dispatch by default.
