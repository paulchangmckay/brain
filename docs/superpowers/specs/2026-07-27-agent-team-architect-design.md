# agent-team-architect skill

**Status:** Approved, grilled
**Date:** 2026-07-27

## Context

The user pointed at [revfactory/harness](https://github.com/revfactory/harness) (8.5k
stars) — a Claude Code plugin whose meta-skill turns "build a harness for this
project" into an auto-generated agent team (`.claude/agents/`) plus the skills
those agents use, selected from 6 architecture patterns (pipeline,
fan-out/fan-in, expert pool, producer-reviewer, supervisor, hierarchical
delegation) — and asked what's worth adopting into this repo's existing
thin-harness/fat-skills setup.

Research (two parallel `Explore` subagents, plus direct fetches of the
source repo) established:

- **`model-routing`** (`skills/model-routing/SKILL.md`) is prose-only
  guidance (Haiku for mechanical work, Sonnet default, Opus for genuinely
  complex reasoning; explicit "default to Sonnet when in doubt" tie-break).
  No hook enforces it — nothing currently wires the `Agent` tool's `model`
  parameter automatically.
- Exactly **one** custom agent exists today: `ba`
  (`skills/ba-agent/agents/ba.md`, `model: sonnet`), documented by
  `claude-infra-reference` as living under the centralized, gitignored
  `~/.claude/Agents/<name>/` convention — output-store pattern, opened as
  its own session.
- **Zero references anywhere** in this repo to Claude Code's Agent Teams
  experimental feature (`TeamCreate`, `SendMessage`-to-team-member,
  `TaskCreate`/`TaskUpdate` as team primitives, or
  `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) — confirmed by grep across
  `.claude/`, `CLAUDE.md`, `skills/`, `.wolf/`. (One unrelated hit:
  `TaskCreate`/`TaskList` as the ordinary Claude Code task-tracking tool
  set, gated by `CLAUDE_CODE_ENABLE_TASKS=1` — a different feature.)
- `superpowers/skills/subagent-driven-development/SKILL.md` already
  implements a real multi-agent workflow using only the `Agent` tool:
  dispatch a fresh implementer subagent per task, a task-reviewer subagent
  after each, and a final whole-branch reviewer — functionally harness's
  Pipeline + Producer-Reviewer patterns, without Team primitives or
  harness's naming.
- Mature skills in this repo (`skills/senior-engineering-partner/`) already
  follow harness's Progressive Disclosure convention: YAML frontmatter,
  <500-line body, a `references/` subdirectory for detail, "read this
  reference early" pointers. This is existing house style, not a gap.
- The skill-gate hook (`hooks/pre-skill-gate.js`) gates exactly one skill —
  `writing-plans` — requiring a `grilling`/`grill-me` marker from earlier in
  the session. It does not gate any other skill by name, so a new skill is
  free to define its own entry conditions.
- All six of harness's reference docs (`agent-design-patterns.md`,
  `orchestrator-template.md`, `team-examples.md`, `skill-writing-guide.md`,
  `skill-testing-guide.md`, `qa-agent-guide.md`) and its `SKILL.md` are
  written in Korean. Nothing here is copy-paste; everything is read,
  translated, and rewritten against this repo's actual conventions.

Design decisions confirmed with the user during brainstorming:

1. Build a genuine new skill (not just harvesting reference docs into
   existing skills) — the repo has no repeatable way to spin up a
   domain-specific agent team today, and that's a real gap.
2. Do **not** adopt Agent Teams / the experimental flag. Generated "teams"
   are sequences/fans of `Agent`-tool subagent dispatches, matching the
   proven `subagent-driven-development` approach.
3. Generated agents/skills live **project-local** (`.claude/agents/` +
   `.claude/skills/` in the target project), not under the centralized
   `~/.claude/Agents/` convention — the team travels with the project it
   serves, matching harness's own layout and Claude Code's native
   per-project subagent discovery.
4. The skill is **exempt** from the brainstorming→grilling→writing-plans
   gate — treated as a scaffolding/bootstrap utility like `wolf-init`, not
   feature work. Its own Phase 0-2 already does structured domain discovery;
   routing that through the full gate too would be discovery-on-discovery.
5. Name it **`agent-team-architect`**, not "harness" — this repo's
   `CLAUDE.md` already uses "harness" to mean the whole thin-harness/
   fat-skills environment; reusing the word for one skill inside it would
   collide with that existing vocabulary.

Further decisions confirmed during grilling:

6. **Delegate, don't duplicate `subagent-driven-development`.** When a
   generated team uses the producer-reviewer pattern, the generated
   `ORCHESTRATION.md` references `subagent-driven-development` for that
   phase's execution rather than re-describing an implementer/reviewer loop
   from scratch — one workflow owns that logic, not two that can drift.
7. **Pattern selection is an explicit decision tree**, not loose
   case-by-case judgment — encoded in `references/agent-design-patterns.md`
   (see Phase 2 below), so a generated team's pattern choice has a
   checkable rationale rather than varying run-to-run.
8. **Drift detection is concrete**: Phase 0 diffs current
   `.claude/agents/*.md` + `.claude/skills/*/SKILL.md` against what the
   prior `.claude/ORCHESTRATION.md` documents (agent list, model
   assignments, governing pattern), flagging undocumented-on-disk files,
   documented-but-missing files, and model/role mismatches.
9. **Model-routing is inherited verbatim**, tie-break included — no
   separate heuristic invented for agent-role assignment. The one
   clarification: a QA/reviewer role is evaluated by what the review
   itself requires (usually genuine judgment), not by how mechanical the
   surrounding pipeline looks — applying model-routing's existing
   "retrieval vs. real thinking" test correctly, not a new rule.
10. **Extend/maintain requests get a phase-selection matrix** (mirroring
    harness's own), so adding one agent to an existing team doesn't
    re-walk full domain analysis and pattern selection from scratch. See
    Phase 0 below.
11. **Phase 6 validation requires explicit consent before running.**
    Generating files is free; dry-run dispatching one `Agent` call per
    generated agent is real, team-size-multiplied spend. The skill pauses
    after Phase 5, shows what was generated, and asks before validating.
12. **Self-targeting guard.** If the target project resolves to
    `~/.claude` itself, the skill warns about the existing centralized
    `~/.claude/Agents/` convention (`ba`'s pattern, per
    `claude-infra-reference`) before proceeding, rather than silently
    creating a second, inconsistent agent convention in the same repo. It
    warns, not refuses — this repo is still a legitimate target if the
    user genuinely wants a project-local team here.
13. **Skill-overlap check (Phase 4) covers both scopes** — project-local
    `.claude/skills/` and this repo's global `~/.claude/skills/` library.
    If a role's need is already covered by an existing global skill (e.g.
    a QA agent needing only `senior-engineering-partner`'s REVIEW: mode),
    the generated agent references that global skill instead of Phase 4
    generating a redundant project-local duplicate.

## Design

### Scope

A new skill that, given a description of a project/domain, decomposes the
work into specialist roles, picks a dispatch pattern, and generates:
- `.claude/agents/<name>.md` per agent (in the **target** project, not this
  repo, unless the target project *is* this repo)
- `.claude/skills/<name>/SKILL.md` (+ optional `references/`) for the
  skills those agents use
- A short orchestration doc describing dispatch order/dependencies

It does not touch Agent Teams primitives, does not modify this repo's gate
hooks, and does not manage the target project's `.wolf/` setup (that's
`wolf-init`'s job, invoked separately if the target project wants it).

### File layout

```
skills/agent-team-architect/
├── SKILL.md
└── references/
    ├── agent-design-patterns.md   # 6-pattern taxonomy, dispatch-shape framing
    ├── dispatch-sequencing.md     # replaces harness's orchestrator-template.md
    ├── team-examples.md           # worked examples, translated + mechanism-swapped
    ├── skill-writing-checklist.md # delta only vs senior-engineering-partner's existing practice
    ├── qa-agent-guide.md          # boundary-crossing comparison + incremental QA
    └── validation-checklist.md    # replaces harness's skill-testing-guide.md
```

### SKILL.md frontmatter

```yaml
---
name: agent-team-architect
description: "Designs a domain-specific team of specialized subagents and the skills they use for a project — decomposing a task into roles, picking a dispatch pattern (pipeline, fan-out/fan-in, expert pool, producer-reviewer, supervisor, hierarchical delegation), and generating .claude/agents/*.md + .claude/skills/*/SKILL.md in the target project. Trigger on 'build/design a team for this project', 'set up an agent team for X', 'I need specialized agents for Y'."
---
```

### Workflow (SKILL.md body, adapted from harness's 6 phases)

0. **Phase 0 — Audit.** Read the target project's `.claude/agents/`,
   `.claude/skills/`, and `.claude/ORCHESTRATION.md` if present.

   **Self-targeting guard:** if the target resolves to `~/.claude` itself,
   warn that this repo already uses the centralized `~/.claude/Agents/`
   convention (`ba`'s pattern) before proceeding — don't silently create a
   second, inconsistent agent convention here. Continue only on explicit
   confirmation.

   **Drift detection** (when `ORCHESTRATION.md` exists): diff the agent
   list, model assignments, and governing pattern it documents against
   what's actually on disk in `.claude/agents/*.md` and
   `.claude/skills/*/SKILL.md`. Flag three kinds of mismatch: files present
   but undocumented, files documented but missing, and model/role
   mismatches (e.g. `ORCHESTRATION.md` says an agent is `haiku` but the
   file says `opus`).

   **Classify the request** and select phases accordingly:

   | Request type | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
   |---|---|---|---|---|---|---|
   | New build (no existing team) | Full | Full | Full | Full | Full | Ask first |
   | Add one agent to existing team | Skip | Placement only | New agent only | Only if a new skill is needed | Update existing doc | Ask first |
   | Add/modify a skill only | Skip | Skip | Skip | Full | Update existing doc | Ask first |
   | Architecture change | Skip | Full | Affected agents only | Affected skills only | Full rewrite | Ask first |
   | Pure audit/sync (no change requested) | Skip | Skip | Skip | Skip | Skip | **Skip** — report drift and stop |

   A pure audit request reports Phase 0's drift findings and stops there;
   it does not proceed into generation or validation unless the user then
   asks to fix what was found (which re-enters the table above at the
   appropriate row).

1. **Phase 1 — Domain analysis.** Identify the domain, the distinct task
   types (generation, validation, editing, analysis, etc.), and check for
   overlap with agents/skills already present (Phase 0 output). Explore the
   target codebase for stack/structure context if it's a coding project.
2. **Phase 2 — Pattern selection.** Choose from the 6 patterns via the
   decision tree in `references/agent-design-patterns.md`:
   - Tasks have sequential dependencies → **Pipeline** (sequential `Agent`
     calls, each fed the prior's output).
   - Tasks are independent and parallelizable → **Fan-out/fan-in**
     (parallel `Agent` calls in one message, `run_in_background` where
     independent, results collected and merged).
   - Which agent handles the work depends on the input → **Expert pool**
     (conditional dispatch, one of several agent definitions chosen per
     input).
   - Output needs a quality gate before acceptance → **Producer-reviewer**
     — delegate execution to `subagent-driven-development`'s existing
     implementer→reviewer loop rather than re-describing it; the generated
     `ORCHESTRATION.md` references that skill by name for this phase.
   - Work is open-ended and needs re-planning based on intermediate
     results → **Supervisor** (the controlling Claude session itself
     dispatches and re-dispatches; no agent file generated for the
     supervisor role itself in Phase 3, only for what it dispatches).
   - A role itself needs to break down further into sub-tasks →
     **Hierarchical delegation** (a top-level agent's own prompt instructs
     it to dispatch further `Agent` calls).
   A hybrid (different patterns per phase of a larger task) is allowed,
   applying the tree separately per phase.
3. **Phase 3 — Agent definitions.** Generate `.claude/agents/<name>.md` per
   role. Every agent gets an explicit `model:` chosen by inheriting
   `model-routing`'s table verbatim, tie-break included (mechanical/
   retrieval role → `haiku`; default/when in doubt → `sonnet`;
   architecture/ambiguous-reasoning role → `opus`) — never a blanket
   `opus`. A QA/reviewer role is judged by what the review itself requires
   (usually real judgment), not by how mechanical the surrounding pipeline
   looks. Check existing agents in the target project first to avoid
   accumulating duplicate roles under different names (harness's own
   Phase 3-0 concern, kept).
4. **Phase 4 — Skill generation.** Generate the skill(s) each agent uses
   under `.claude/skills/`, following this repo's existing Progressive
   Disclosure convention (frontmatter with an actively-worded
   `description`, <500-line body, `references/` for detail, size-budget
   checklist in `references/skill-writing-checklist.md`). Check for
   overlap in **both** scopes before generating: the target project's own
   `.claude/skills/`, and this repo's global `~/.claude/skills/` library.
   If an existing global skill already covers a role's need, the generated
   agent references that global skill instead of a new project-local one
   being created.
5. **Phase 5 — Orchestration doc.** Always write (or update, per the Phase
   0 matrix) a standalone `.claude/ORCHESTRATION.md` in the target project
   — never conditionally appended to the target's `CLAUDE.md` — documenting
   dispatch order, dependencies, which pattern from Phase 2 governs each
   phase, and which phases (if any) delegate to `subagent-driven-development`
   rather than being self-contained. A standalone file keeps this skill's
   output self-contained and diffable independent of whatever the target
   project's `CLAUDE.md` already contains; this replaces harness's
   live-team orchestrator-template, since there's no running team to
   configure, only a documented call sequence.

   **Pause here.** Show what was generated (agent count, roles, model
   assignments, skills created vs. referenced) and ask before proceeding to
   Phase 6 — dry-run dispatch is real, team-size-multiplied cost, and the
   user should see the shape of the output before that spend happens.

6. **Phase 6 — Validation** (only on explicit go-ahead). Per
   `references/validation-checklist.md`: confirm each generated skill's
   `description` actually triggers on its intended phrasing (ask in a
   scratch conversation, compare against a plausible non-triggering
   phrase); dry-run dispatch one `Agent` call per generated agent
   definition to confirm it runs without error; for QA-role agents
   specifically, confirm they read both sides of an interface/boundary
   rather than just checking file existence (from `qa-agent-guide.md`'s
   "boundary-crossing comparison" — the single most novel piece of
   harness's guidance, kept close to its original form).

### Gate behavior

No `writing-plans` gate, no `brainstorming`/`grilling` requirement to
invoke this skill — it is scaffolding, like `wolf-init`. Its own Phase 0-2
is the discovery step. No changes to `hooks/pre-skill-gate.js` or
`hooks/post-skill-record.js`.

### Integration points

- **`CLAUDE.md` §2 routing table**: add one row after the `wolf-init` row:
  `Need a repeatable multi-agent setup for a project/domain | agent-team-architect (scaffolding, not gated by brainstorming — generates project-local .claude/agents/ + .claude/skills/)`.
- **`claude-infra-reference` skill**: add a short note under the existing
  Custom Agents section distinguishing this from the `ba`-style centralized
  `~/.claude/Agents/` convention — teams generated by
  `agent-team-architect` are project-local, not global, and are not opened
  via the `claude ~/.claude/Agents/<name>/` pattern.
- **`.claude/rules/openwolf.md`**: no change. Generated projects get their
  own `.wolf/` via `wolf-init`, invoked separately if wanted — out of this
  skill's scope.
- **No `settings.json` changes, no new hooks, no experimental flags.**

### What's explicitly not ported from harness

- Agent Teams primitives (`TeamCreate`/`SendMessage`-to-team/`TaskCreate`)
  — replaced entirely by `Agent`-tool dispatch shapes.
- Blanket `model: "opus"` for every generated agent — replaced by
  per-role `model-routing` selection.
- The Korean-language source text — everything is rewritten, not
  translated verbatim, so terminology matches this repo's existing skill
  vocabulary (e.g. "dispatch" not "team," "subagent" not "team member").
- The `harness-100` sister repo (100 pre-built domain team packages) —
  out of scope for this spec; noted below as a possible future input if a
  generated team from `agent-team-architect` ever wants a pre-built
  starting point.

## Verification

No application logic to unit-test — this is a documentation-only skill
(SKILL.md + references), like `markitdown` or `github-issue-first`.
Verification is manual, per the skill's own Phase 6:

1. Invoke `agent-team-architect` against a real target (e.g. the NHL Stats
   Project) with a concrete domain request; confirm it produces a
   sensible Phase 0 audit before generating anything, and pauses after
   Phase 5 to ask before running Phase 6.
2. Confirm generated `.claude/agents/*.md` files each have an explicit,
   role-appropriate `model:` field (not all `opus`), inherited from
   `model-routing`'s table.
3. Confirm generated `.claude/skills/*/SKILL.md` files pass the same
   Progressive Disclosure shape as `senior-engineering-partner`
   (frontmatter present, body under budget, `references/` used for
   overflow), and that no generated skill duplicates something already in
   the global `~/.claude/skills/` library.
4. Confirm the skill's own `description` triggers correctly on "build a
   team for this project" / "design an agent team for X" in a scratch
   conversation, and does not fire on unrelated multi-step requests.
5. On explicit go-ahead, dry-run dispatch one generated agent and confirm
   it executes without error.
6. Re-invoke against the same target with a one-agent "add" request;
   confirm the Phase 0 matrix skips domain analysis and only runs
   placement + the new agent's definition, and that `ORCHESTRATION.md` is
   updated rather than rewritten from scratch.
7. Invoke a pure audit request (no changes) against a target with a
   deliberately introduced mismatch (e.g. hand-edit an agent's `model:`
   after generation); confirm Phase 0 reports the drift and stops without
   entering generation or validation.
8. Invoke against `~/.claude` itself; confirm the self-targeting guard
   warns about the centralized `~/.claude/Agents/` convention before
   proceeding.

## Out of scope

- Agent Teams / `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` adoption — revisit
  only if a future need genuinely requires live inter-agent messaging that
  sequential/parallel dispatch can't express.
- Centralizing generated agents under `~/.claude/Agents/` — project-local
  only, per the design decision above.
- Routing `agent-team-architect` invocations through
  brainstorming/grilling/writing-plans — scaffolding utility, exempt by
  design.
- Importing or wiring up `harness-100`'s pre-built domain packages — noted
  as a possible future input, not built here.
- Any change to `hooks/pre-skill-gate.js`, `hooks/post-skill-record.js`, or
  `settings.json`.
