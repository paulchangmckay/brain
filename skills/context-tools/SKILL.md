---
name: context-tools
description: Use before a Bash command or WebFetch call expected to return more than roughly 15KB of output — routes it through context-mode's sandboxed MCP tools (ctx_execute, ctx_fetch_and_index, ctx_search) instead, so the raw payload never enters context, only a summary or targeted query result does.
---

# context-tools — Sandboxed Execution & Fetch

Wraps [mksglu/context-mode](https://github.com/mksglu/context-mode)'s MCP
tools, registered standalone (no plugin, no hooks — see
`docs/superpowers/specs/2026-07-27-context-mode-integration-design.md`).
Because it's standalone, nothing enforces this automatically: reaching for
these tools instead of raw `Bash`/`WebFetch`/`Read` is a judgment call this
skill exists to prompt, not something a hook will catch if skipped.

## When to Use

- A `Bash` command whose output you expect to exceed ~15KB and where you
  only need a summary, a specific value, or a pass/fail signal — not the
  full raw output. (15KB matches the existing `post-bash-truncate.js` warn
  threshold already in this environment, for consistency.)
- A `WebFetch` target that's a large page (docs, a long article, API
  reference) where you'll want to search/query specific sections rather
  than read the whole thing once.
- Any file or output you expect to need to *search within* more than once
  in the same session — index it once, query it repeatedly, instead of
  re-reading.

## When NOT to Use

- Small, one-off reads or commands — the sandboxing has no payoff there
  and just adds a tool-call round-trip.
- Anything already covered by this repo's own re-read dedup
  (`hooks/pre-read-check.js`) — that mechanism already prevents redundant
  re-reads of unchanged files within a 10-minute window.

## Tools

| Tool | Use for |
|---|---|
| `ctx_execute` | Run a shell/code snippet; only stdout enters context, full output stays queryable |
| `ctx_execute_file` | Process a file's contents without the raw content entering context |
| `ctx_batch_execute` | Multiple commands, concurrent, same containment guarantee |
| `ctx_fetch_and_index` | Fetch a URL, convert to Markdown, index it (24h TTL cache) instead of dumping the full page into context |
| `ctx_index` / `ctx_search` | Index arbitrary markdown/text, then query it with fuzzy/BM25-ranked search instead of re-reading the whole thing |
| `ctx_stats` | Report context savings / session summary for this integration |
| `ctx_purge` | Delete all indexed content — use if the local SQLite state grows stale or needs a reset |

**Avoid:** `ctx_doctor`, `ctx_upgrade`, `ctx_insight` — the first two assume
a plugin install (this one is standalone) and aren't guaranteed to behave
correctly; `ctx_insight` opens a hosted dashboard whose network behavior
hasn't been verified against this environment's local-only expectations.

## Uninstall / Rollback

Installation unconditionally deploys a self-heal SessionStart hook
(`context-mode-cache-heal.mjs`) into `~/.claude/hooks/` on first boot, with
no config flag to suppress it — see the design spec's "documented
exception" section for why this happens and why it's confirmed inert. It's
included in the removal commands below.

```bash
claude mcp remove context-mode
npm uninstall -g context-mode
rm -rf ~/.claude/context-mode/
rm ~/.claude/hooks/context-mode-cache-heal.mjs
# then manually remove the matching SessionStart entry from ~/.claude/settings.json
```
