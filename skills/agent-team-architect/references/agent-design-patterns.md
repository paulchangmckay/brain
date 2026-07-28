# Agent Team Design Patterns

Six dispatch patterns for decomposing work across specialized subagents,
and the decision tree for picking among them. None of these use Claude
Code's Agent Teams primitives — every pattern below is expressed as
`Agent`-tool dispatches, matching this repo's proven mechanism
(`subagent-driven-development`).

## Decision tree

Ask these questions in order; stop at the first match:

1. **Does output need a quality gate before acceptance?** → Producer-reviewer.
2. **Do the tasks have sequential dependencies** (task B needs task A's
   output)? → Pipeline.
3. **Are the tasks independent and parallelizable?** → Fan-out/fan-in.
4. **Does which agent handles the work depend on the input itself** (not
   on prior output)? → Expert pool.
5. **Does a single role need to break down further into sub-tasks it
   discovers as it goes?** → Hierarchical delegation.
6. **Is the work open-ended, needing re-planning after seeing
   intermediate results, with no fixed task list up front?** → Supervisor.

A larger task can mix patterns — apply this tree separately to each phase
of work rather than forcing one pattern over the whole thing.

## Pipeline

Sequential `Agent` calls, each fed the prior's output as part of its prompt.

```
result_a = Agent(prompt="...", subagent_type="...")
result_b = Agent(prompt=f"Given: {result_a}. Now...", subagent_type="...")
```

Use when: task B literally cannot start until task A's output exists
(e.g. "extract requirements" → "design schema" → "write migration").

## Fan-out / fan-in

Multiple `Agent` calls issued in a single message (parallel), or with
`run_in_background: true` when a caller wants to keep working while they
run. Results are collected and merged once all return.

```
Agent(description="...", prompt="...", run_in_background=true)
Agent(description="...", prompt="...", run_in_background=true)
# ...continue other work, or wait; merge results once notified
```

Use when: tasks don't depend on each other's output (e.g. "check
architecture," "check security," "check performance" — three independent
review angles merged into one report).

## Expert pool

Conditional dispatch — one of several agent definitions is chosen based
on properties of the input, not on any prior step's output.

```
if input_type == "pdf": Agent(subagent_type="pdf-specialist", ...)
elif input_type == "image": Agent(subagent_type="image-specialist", ...)
```

Use when: the right specialist depends on what's being handled, and
multiple specialists won't be needed for the same input.

## Producer-reviewer

Implementer dispatch, then reviewer dispatch against the implementer's
output; on rejection, a fix dispatch and re-review.

**Do not re-implement this loop from scratch.**
`subagent-driven-development` already does this — dispatch a fresh
implementer subagent per task, a task-reviewer subagent after each, and a
final whole-branch reviewer. When Phase 2 selects this pattern for a
generated team, the team's `ORCHESTRATION.md` should reference
`subagent-driven-development` for that phase, not restate its loop.

Use when: output quality benefits from a second, independent pass — most
implementation and content-generation work.

## Supervisor

The controlling Claude session itself (not a spawned agent) dispatches
and re-dispatches based on intermediate results, adjusting its plan as it
goes. No `.claude/agents/*.md` file is generated for the supervisor role
— only for the agents it dispatches.

Use when: the task list can't be fully known up front — each dispatch's
result changes what happens next.

## Hierarchical delegation

A top-level agent's own prompt instructs it to dispatch further `Agent`
calls itself (nested delegation) — the top-level agent acts as a
mini-supervisor for its own sub-task.

Use when: one role is genuinely too broad for a single dispatch, but its
sub-tasks aren't knowable until that role starts working (otherwise: just
split it into separate Phase-3 agents instead — prefer flat over nested
when the sub-tasks are already knowable).

## Choosing a model per agent in any pattern

Every generated agent gets its `model:` from `model-routing`'s table
(mechanical/retrieval → `haiku`; default/in doubt → `sonnet`; complex
multi-file/ambiguous-reasoning → `opus`) — never a blanket `opus`
regardless of pattern. A reviewer role in a producer-reviewer pattern is
judged by what the review requires, not by how mechanical the pipeline
around it looks.
