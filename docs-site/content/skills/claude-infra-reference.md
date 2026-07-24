---
title: "claude-infra-reference"
description: "Use when registering, troubleshooting, or looking up details about custom agents under ~/.claude/Agents/, local plugin registration via claude plugins init, the brand/document skill convention, browser automation (playwright MCP vs html-export), or the mattpocock/skills external integration."
---

# Claude Infra Reference

Lookup-style reference detail moved out of the global `CLAUDE.md` (which now only carries a one-line pointer to this skill) — read this on demand when doing one of the specific tasks named in the description above, not as passive session-wide context.

## Custom Agents
- **Location:** `~/.claude/Agents/<agent-name>/` — each has its own CLAUDE.md, skills/, templates/, outputs/, scripts/
- **Open with:** `claude ~/.claude/Agents/<agent-name>/`
- **Gitignore note:** `Agents/` is gitignored — edit files there directly (no worktree needed). Only `skills/` and `hooks/` under `~/.claude` are git-tracked.

## Custom Plugin Registration
- **Local plugins** (no upstream git repo): `claude plugins init <name> --with agents` → scaffolds at `~/.claude/skills/<name>/`, auto-loads as `<name>@skills-dir` — no marketplace or install step needed
- **YAML agent frontmatter:** quote any `description:` value that contains `: ` (colon-space) or the parser silently drops all frontmatter
- **Do NOT** manually edit `installed_plugins.json` — source type validation blocks loading even with a valid `installPath`; use `claude plugins validate <path>` to check before wiring
- **Submodule ≠ registered plugin:** a skill file existing inside a git submodule (e.g. `superpowers/skills/<name>/`) does not make it invocable via the Skill tool — check `~/.claude/plugins/installed_plugins.json` for the plugin name before assuming a submodule's skills are live. Fix for an unregistered local-repo plugin (needs a `.claude-plugin/marketplace.json`, which `superpowers` has): `claude plugin marketplace add <path-to-repo>` then `claude plugin install <plugin>@<marketplace-name>`. A restart is required afterward — skill discovery is computed at session start, so the newly installed skill will still throw `"Unknown skill"` in the same session even after a successful install.

## Brand / Document Skill Convention
- **Brand/structure separation:** In document skill briefs, never hardcode brand values (hex codes, font names, sizes) — say "Apply Brand Spec Card" and let `~/.claude/brand/brand-guide.md` be the only source. Only format-structural constraints (DXA widths, slide count, `No \n in paragraphs`) belong in the skill file itself.
- **Brand source of truth:** `~/.claude/brand/brand-guide.md` → read at runtime by `~/.claude/skills/brand/SKILL.md` → outputs Brand Spec Card → referenced by all document briefs. Updating brand-guide.md propagates everywhere automatically.

## Browser Automation
- A `playwright` MCP server (`@playwright/mcp`) is registered in `~/.claude.json`'s top-level `mcpServers` (the mechanism that's actually live — not `mcp_servers.json`, which is disconnected from Claude Code's config surface) for interactive browser automation (navigate/click/type/screenshot/DOM read). Distinct from the `html-export` skill (static screenshot/PDF export of a finished page); use `playwright` when you need to actually interact with a running app. Note: `html-export`'s own Playwright pipeline is currently broken (ESM/CJS conflict in `~/.claude/package.json` + no local `playwright` npm package) — needs a fix before it works again.

## External Skill Integrations (mattpocock/skills)
- Installed via the `npx skills` CLI (`npx skills@latest add mattpocock/skills <skill-names...> --global --copy -y`; the `-s/--skill` flag does not reliably filter in non-interactive mode — pass skill names positionally, or install everything and prune unwanted ones with `npx skills remove <names...> --global -y`). Installed as real copies (`--copy`), not symlinks into `~/.agents/skills/`, so they live fully inside this git repo like every other custom skill.
- **grill-me** (user-invoked, `/grill-me`) + **grilling** (model-invoked primitive it wraps) — relentless one-question-at-a-time interview to stress-test a plan. `grilling` may also be reached for automatically by other skills; `grill-me` never invokes anything except `grilling`.
- **codebase-design** (model-invoked) — deep-module design vocabulary (interface/seam/adapter/deletion test). Installed standalone, not merged into `senior-engineering-partner`; reach for it alongside `senior-engineering-partner` REVIEW:/EXPLAIN: modes when the topic is module/interface shape, not general code correctness. Includes `DEEPENING.md` and `DESIGN-IT-TWICE.md` references.
- **domain-modeling** (model-invoked) — active glossary/ADR discipline, writes `CONTEXT.md` and `docs/adr/`. Distinct from `understand-anything:understand-domain`, which only reads existing code into a graph and never writes back to the repo. Includes `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` references.
- **teach** (user-invoked, `/teach`) — stateful multi-session tutoring workspace (`MISSION.md`, `lessons/`, `reference/`, `learning-records/`, `assets/`). Personal/educational output — exempt from the `brand` hard-gate. Treats the current directory as the workspace: only invoke from a dedicated learning directory, never from `~/.claude` itself.
- **handoff** (user-invoked, `/handoff`) — locally modified from upstream: saves to `.wolf/handoffs/<UTC-timestamp>-handoff.md` instead of the OS temp dir, for discoverability via OpenWolf and worktree-friendliness. Because it's modified, re-running the install for `handoff` will overwrite the local edit — reapply the `.wolf/handoffs/` change after any upstream update.
- **Note:** `grill-me`, `teach`, and `handoff` are enforced user-invoked at the tool level — calling `Skill({skill: "grill-me"})` etc. throws `disable-model-invocation` and fails. They can only be triggered by the user typing the slash command directly; Claude cannot self-invoke or self-verify them.
- Not installed from this repo (considered and skipped): `ask-matt`, `code-review`, `diagnosing-bugs`, `grill-with-docs`, `implement`, `improve-codebase-architecture`, `prototype`, `setup-matt-pocock-skills`, `tdd`, `to-issues`, `to-prd`, `triage`, `writing-great-skills`, and the `general/` category skills — out of scope for this integration pass, revisit individually if a need arises.
