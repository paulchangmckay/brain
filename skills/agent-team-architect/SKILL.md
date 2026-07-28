---
name: agent-team-architect
description: "Designs a domain-specific team of specialized subagents and the skills they use for a project — decomposing a task into roles, picking a dispatch pattern (pipeline, fan-out/fan-in, expert pool, producer-reviewer, supervisor, hierarchical delegation), and generating .claude/agents/*.md + .claude/skills/*/SKILL.md in the target project. Trigger on 'build/design a team for this project', 'set up an agent team for X', 'I need specialized agents for Y'."
---

# Agent Team Architect

Designs and generates a domain-specific team of specialized subagents
(`.claude/agents/`) and the skills they use (`.claude/skills/`) for a
target project — decomposing a task into roles, picking a dispatch
pattern, and producing files that travel with that project.

This is a scaffolding utility, not feature work: it does not require
brainstorming/grilling/writing-plans first. Its own Phase 0-2 is the
discovery step.

## Phase 0 — Audit

Read the target project's `.claude/agents/`, `.claude/skills/`, and
`.claude/ORCHESTRATION.md` if present.

**Self-targeting guard:** If the target resolves to `~/.claude` itself,
stop and warn: this repo already uses a centralized
`~/.claude/Agents/<name>/` convention (see `claude-infra-reference`) for
custom agents. Generating project-local `.claude/agents/` here would
introduce a second, inconsistent pattern. Ask for explicit confirmation
before continuing.

**Drift detection** (only when `.claude/ORCHESTRATION.md` already exists):
compare what it documents — agent list, `model:` assignments, governing
pattern — against what's actually on disk in `.claude/agents/*.md` and
`.claude/skills/*/SKILL.md`. Report three kinds of mismatch:
- On disk but undocumented
- Documented but missing on disk
- Model/role mismatch (e.g. doc says `haiku`, file says `opus`)

**Classify the request**, then follow this phase-selection matrix — most
requests don't need every phase:

| Request type | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---|---|---|---|---|---|---|
| New build (no existing team) | Full | Full | Full | Full | Full | Ask first |
| Add one agent to existing team | Skip | Placement only | New agent only | Only if a new skill is needed | Update existing doc | Ask first |
| Add/modify a skill only | Skip | Skip | Skip | Full | Update existing doc | Ask first |
| Architecture change | Skip | Full | Affected agents only | Affected skills only | Full rewrite | Ask first |
| Pure audit/sync (no change requested) | Skip | Skip | Skip | Skip | Skip | Skip — report drift and stop |

A pure audit request stops after reporting Phase 0's findings. It does
not generate or validate anything unless the user then asks to act on
what was found — which re-enters this table at the appropriate row.

## Phase 1 — Domain analysis

Identify the domain and the distinct task types involved (generation,
validation, editing, analysis, research, etc.). Cross-check against what
Phase 0 found already exists, so new roles don't duplicate old ones under
a different name. If the target is a coding project, explore its stack
and structure enough to ground agent roles in real file/module
boundaries rather than guessing.

## Phase 2 — Pattern selection

Pick a dispatch pattern per phase of work using the decision tree in
`references/agent-design-patterns.md`:

- Tasks have sequential dependencies → **Pipeline**
- Tasks are independent and parallelizable → **Fan-out/fan-in**
- Which agent handles the work depends on the input → **Expert pool**
- Output needs a quality gate before acceptance → **Producer-reviewer** —
  delegate to `subagent-driven-development`'s existing
  implementer→reviewer loop rather than re-describing it
- Work is open-ended and needs re-planning from intermediate results →
  **Supervisor** — the controlling session itself dispatches; no agent
  file is generated for the supervisor role
- A role needs to break down further into sub-tasks → **Hierarchical delegation**

A larger task can mix patterns by phase — apply the tree separately to
each phase rather than forcing one pattern over the whole thing.

None of this uses Claude Code's Agent Teams primitives
(`TeamCreate`/`SendMessage`-to-team/`TaskCreate`). Every pattern above is
expressed as `Agent`-tool dispatches — sequential calls, parallel calls
in one message, `run_in_background` fans — because that's this repo's
proven mechanism (see `subagent-driven-development`), and Agent Teams
requires an experimental flag this repo doesn't otherwise use.
