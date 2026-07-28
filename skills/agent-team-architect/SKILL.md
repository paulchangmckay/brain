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

## Phase 3 — Agent definitions

Generate `.claude/agents/<name>.md` per role in the target project.
Check existing agents there first (Phase 0 output) so roles don't
accumulate as near-duplicates under different names.

Every agent gets an explicit `model:`, chosen by applying
`model-routing`'s table exactly as written — no separate heuristic for
this skill:
- Mechanical/retrieval role (log inspection, single-file lookup,
  grep-and-report) → `haiku`
- Default, or genuinely in doubt → `sonnet`
- Complex multi-file architecture or ambiguous-reasoning role → `opus`

A QA/reviewer role is judged by what the review itself requires —
usually real judgment about correctness, not retrieval — not by how
mechanical the surrounding pipeline looks. That's model-routing's
existing test applied correctly, not a new rule. See
`references/qa-agent-guide.md` for the specific QA-agent template.

Each agent definition needs: role, principles, input/output contract,
error handling, and — when the role participates in a multi-agent phase
— a short note on what it hands off and to whom.

## Phase 4 — Skill generation

Generate the skill(s) each agent uses under `.claude/skills/`, following
this repo's own Progressive Disclosure convention: YAML frontmatter with
an actively-worded `description` (state what triggers it, not just what
it does — see `references/skill-writing-checklist.md`), a body under 500
lines, detail pushed to `references/` when the body would otherwise grow
past budget.

Before generating anything, check for overlap in **both** scopes:
1. The target project's own `.claude/skills/`
2. This repo's global `~/.claude/skills/` library

If an existing global skill already covers what a role needs (e.g. a QA
agent that just needs `senior-engineering-partner`'s REVIEW: mode), point
the generated agent at that skill instead of generating a redundant
project-local copy.

## Phase 5 — Orchestration doc

Write (or update, per the Phase 0 matrix) a standalone
`.claude/ORCHESTRATION.md` in the target project. Never append this to
the target's own `CLAUDE.md` — a standalone file stays self-contained and
diffable regardless of what else that `CLAUDE.md` contains. Document:
- Dispatch order and dependencies between agents
- Which Phase 2 pattern governs each phase of work
- Which phases (if any) delegate to `subagent-driven-development` rather
  than being self-contained

Template and worked examples: `references/dispatch-sequencing.md` and
`references/team-examples.md`.

**Pause here before Phase 6.** Show what was generated — agent count,
roles, model assignments, which skills were newly created vs. referenced
from the global library — and ask before running Phase 6. Generating
files is free; dry-run validation is not.

## Phase 6 — Validation (only on explicit go-ahead)

Follow `references/validation-checklist.md`:
- Confirm each generated skill's `description` triggers on its intended
  phrasing, and does not trigger on a plausible near-miss
- Dry-run dispatch one `Agent` call per generated agent definition,
  confirm it runs without error
- For QA-role agents specifically, confirm they read both sides of an
  interface/boundary rather than just checking that files exist
  (`references/qa-agent-guide.md`'s boundary-crossing comparison)

## What this skill deliberately does not do

- Does not use Agent Teams (`TeamCreate`/`SendMessage`-to-team/
  `TaskCreate`, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) — everything
  above is `Agent`-tool dispatch.
- Does not assign a blanket `model: opus` — every agent's model comes
  from `model-routing`.
- Does not manage the target project's `.wolf/` setup — that's
  `wolf-init`'s job, invoked separately if wanted.
- Does not require brainstorming/grilling/writing-plans to invoke —
  scaffolding, like `wolf-init`.
