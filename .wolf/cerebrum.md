# Cerebrum

> OpenWolf's learning memory. Do not edit manually unless correcting an error.
> Last updated: 2026-08-13

## User Preferences
- Wants "why" before implementation — explain rationale, then act. Prefers ranked/prioritized lists over exhaustive surveys.
- Consolidate over proliferate: merge overlapping tools/skills into one home rather than installing both.
- Combined-skill design pattern: auto-always for internal/Claude-facing targets (cerebrum), conditional + approval-gated for shared/team targets (CLAUDE.md).
- Given a 3-way AskUserQuestion with a labeled "Recommended" option and clear tradeoffs, consistently picks it immediately with no back-and-forth (confirmed 4x: submodule handling, cerebrum split, grilling hard-block, backup-branch approach). Safe to lead with a strong recommendation.
- Prefers Anthropic document-skills plugins (`document-skills:pdf/docx/pptx/xlsx`) over calling underlying libraries directly.
- Has a defined personal brand (brand-guide.md) — every output must apply the Brand Spec Card dynamically, never hardcoded values.
- Wants third-party skills wired into CLAUDE.md's routing/Process Layer, not just installed to disk — "make sure these get used."
- Wants the document-type prompt (`all/pptx/docx+pdf/skip`) kept in `/ba` — values flexibility to stop at markdown-only.

## Key Learnings — Skill & Tooling Design
- Sub-agents (Bash/Read/Write/WebFetch/TodoWrite only) can't invoke the Skill tool or sustain interactive multi-turn dialogue — comms/brand/discovery-gateway work belongs at the parent SKILL.md level; resumed sub-agents treat further messages as coordinator relay and fail stage gates, looping indefinitely.
- Brand Spec Card must ship as a machine-readable `### Brand Spec JSON` block alongside the text card, or downstream skills silently ignore it (PPTX/DOCX/XLSX each drifted independently).
- Discovery Gateway pattern (named-dimension input-quality scoring + structured Q&A round before proceeding) is a reusable way to turn a passive skill into an active practitioner; more reliable than heuristic length checks.
- Mermaid brand theming needs explicit `classDef` + `:::className` on every node — theme variables alone only affect line/text color, not node fill.
- Cross-artifact consistency (matching labels/actor names across generated docs) is a distinct QA phase from per-artifact observe checks — must run after all individual observes pass.
- `understand-anything` graphs go stale fast for actively-edited dirs; don't trust keyword search over recently changed files — Read directly instead.
- Standalone `.md` skill files in `~/.claude/skills/` are silently ignored — must be `<name>/SKILL.md` in a directory.
- `pip`/`pipx` can silently backtrack to an old crippled package version when an extra lacks a wheel for the current Python (no error) — always verify the actually-installed version after any unpinned install, don't trust exit code 0.
- `npx skills@latest add ... --skill=<list>` ignores the filter in non-interactive mode and installs everything — let it over-install, prune with `remove`, verify via `ls`/`git status` not the CLI summary.

## Do-Not-Repeat
- Do NOT build new agents/tooling under `~/` — always under `~/.claude/` (tracked codebase).
- Do NOT skip test/sample files mentioned in a spec — create them during the build, don't assume they'll be added later.
- Do NOT install two skills/plugins covering the same concept — audit for overlap, consolidate.
- Do NOT write unquoted colon-space (`: `) in YAML frontmatter `description:` fields — quote the whole value.
- Do NOT hardcode brand values (hex, fonts, sizes) anywhere but `brand-guide.md` — reference the Brand Spec Card dynamically.
- Do NOT run `understand-anything` on `~/.claude` without auditing `.understandignore` first (cache dirs dominate the scan).
- Do NOT leave `meta.json`'s `gitCommitHash` null after `git init` — patch it or incremental diffing breaks.
- Do NOT manually add an `installed_plugins.json` entry for a plugin with an invalid/missing source type — the loader rejects it before checking `installPath`.
- Do NOT add an empty `[[allowlists]]` block to `.gitleaks.toml` "for documentation" — a check-less allowlist is a fatal config error, not a no-op. Omit until there's a real scoped exception.
- Do NOT chain multiple edits to external-project files without a Read-verify step — OpenWolf hooks can silently revert edits outside `~/.claude`.
- Do NOT treat a subagent's report as verified fact for file-existence/state claims — check directly before acting, especially right after plan approval.
- Do NOT build a filesystem path from a harness-supplied identifier (session_id, tool_input fields) without a strict character allowlist first — unsanitized values enable path traversal.

## Decision Log
- BA agent brand/comms split: brand visual specs + document-skills invocation live at the parent `SKILL.md`; brand voice lives in the sub-agent's own CLAUDE.md; comms/FAQ co-authoring runs interactively at parent level. Sub-agents stay limited to deterministic, non-interactive work.
- `session-reflect` is two-phase: Phase 1 (cerebrum) auto-always; Phase 2 (CLAUDE.md) conditional + approval-gated — avoids installing a competing audit flow (declined `claude-md-management` plugin for this reason).
- senior-engineering-partner installed as a **reference library only** (21+ domain modules, tiered rigor ladder) — its own gate sequence duplicates existing brainstorming→TDD→verification gates, so wired references into CLAUDE.md's Process Layer instead of adding a competing gate.
- Installed the full 13-skill `taste-skill` set (not just the 3 general-purpose ones) per explicit user request; mitigated aesthetic-variant conflict risk via an explicit routing table in `claude-infra-reference` rather than declining the riskier variants.