# Worked Examples

## Deep research team

**Domain:** investigate a topic from multiple angles, cross-validate,
produce a report.

**Pattern:** Fan-out/fan-in (research angles are independent) →
Producer-reviewer (draft report → review pass).

**Agents:**
- `web-researcher` (sonnet) — searches and summarizes web sources
- `academic-researcher` (sonnet) — searches and summarizes
  academic/technical sources
- `report-writer` (sonnet) — synthesizes both into a draft report
- `fact-checker` (opus) — cross-validates claims against sources, flags
  unsupported statements

**Dispatch sequence:**
1. Fan-out: `web-researcher` and `academic-researcher` in parallel
   (independent, `run_in_background`)
2. Fan-in: both results feed `report-writer`
3. Producer-reviewer: `fact-checker` reviews the draft; on rejection,
   `report-writer` is re-dispatched with the fact-checker's findings

## Code review team

**Domain:** parallel review of a change across independent angles,
merged into one report.

**Pattern:** Fan-out/fan-in.

**Agents:**
- `architecture-reviewer` (opus) — structural/design concerns
- `security-reviewer` (opus) — injection, auth, secrets handling
- `performance-reviewer` (sonnet) — obvious bottlenecks, N+1s
- `style-reviewer` (haiku) — formatting/convention adherence, mechanical

**Dispatch sequence:**
1. Fan-out: all four reviewers dispatched in parallel against the same diff
2. Fan-in: controlling session merges findings into one ranked report,
   deduplicating overlapping findings

Note the model spread: `style-reviewer` is genuinely mechanical (haiku),
the two judgment-heavy reviewers are opus, performance sits at the sonnet
default. This is what "never blanket opus" looks like in practice.

## Documentation team

**Domain:** generate API documentation from a codebase.

**Pattern:** Pipeline (endpoint discovery must complete before
descriptions/examples can be written) → Producer-reviewer (completeness
check).

**Agents:**
- `endpoint-scanner` (haiku) — mechanical: lists endpoints, signatures,
  existing docstrings
- `doc-writer` (sonnet) — writes descriptions and usage examples per
  endpoint
- `completeness-reviewer` (sonnet) — checks every discovered endpoint has
  a corresponding doc entry (a boundary-crossing comparison — see
  `qa-agent-guide.md`)

**Dispatch sequence:**
1. `endpoint-scanner` runs first, its output is the input list for step 2
2. `doc-writer` dispatched per endpoint (or in batches) using the
   scanner's output
3. `completeness-reviewer` (producer-reviewer pattern — delegates to
   `subagent-driven-development` if this is being executed as an
   implementation task, or a single dispatch if it's a one-shot
   generation)
