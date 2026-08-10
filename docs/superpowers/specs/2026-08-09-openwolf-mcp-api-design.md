# OpenWolf MCP API — Design

## Context

User pointed at [tadata-org/fastapi_mcp](https://github.com/tadata-org/fastapi_mcp)
(exposes FastAPI endpoints as MCP tools) and asked to implement it and find
uses for it in this repo. `~/.claude` has no existing FastAPI app — its
scripting convention is entirely Node/shell (`scripts/*.js`, `scripts/*.sh`),
zero Python at the top level (confirmed: no `pyproject.toml`,
`requirements.txt`, or `Pipfile`; `python3`/`pip3` present, `uv` not
installed). So this spec builds a small, real FastAPI service from scratch
whose purpose is to expose OpenWolf's own data (`.wolf/anatomy.md`,
`.wolf/buglog.json`, `.wolf/memory.md`, `.wolf/cerebrum.md`) as read-only
endpoints, then wraps it with fastapi_mcp so a Claude Code session can query
"what bugs have we hit with X" / "what do we know about Y" via MCP tool
calls instead of reading and grepping those files directly.

The user confirmed this is meant to become an actually-used tool (not a
throwaway demo), and approved exposing all four OpenWolf data sources.

A related but separate ask — reviewing the rest of `~/.claude` for other
places fastapi_mcp could plug in — is **out of scope for this spec**. That's
a written research report, not application code; it doesn't need a spec,
plan, or TDD, and is delivered separately after this build.

## Scope

Build `mcp-services/openwolf-api/`: a FastAPI app exposing five read-only
GET endpoints over OpenWolf's own data files, mounted with fastapi_mcp,
served by uvicorn, kept running via PM2, and registered as an HTTP-transport
MCP server via a new repo-root `.mcp.json`.

Out of scope: write/mutation endpoints (this is read-only reporting, not a
way to edit `.wolf/` files); auth (see Security below); caching (files are
small enough to re-read per request); any client other than Claude Code's
MCP integration.

## Architecture

**Why a persistent PM2 daemon over on-demand:** fastapi_mcp mounts an
HTTP/SSE MCP endpoint on top of the FastAPI ASGI app — it does not speak
stdio. Claude Code's `mcpServers` config can only *connect* to an
already-running HTTP server, not spawn one on demand the way it does for
stdio servers. A "real, always-queryable tool" therefore requires the
service to already be up when a session starts, which means a persistent
background process. This repo already runs the OpenWolf daemon and gbrain
autopilot under PM2, so this reuses that same lifecycle model rather than
introducing a new one.

**Alternatives considered and rejected:**
- *Session-scoped stdio wrapper* (spawn-on-connect, exit when the session
  ends): avoids an idle port, but fastapi_mcp has no native stdio
  transport — this would need a hand-rolled stdio↔HTTP bridge (or the
  external `mcp-proxy` package) for a benefit (not occupying one localhost
  port) that doesn't matter on a single dev machine. Rejected as needless
  complexity.
- *Manual start, unregistered*: simplest to build, but the server isn't
  there when wanted, which contradicts the stated "real tool" goal.
  Rejected.

## File Structure

```
mcp-services/openwolf-api/
  app.py              # FastAPI app, routes, fastapi_mcp mount
  requirements.txt     # fastapi, fastapi-mcp, uvicorn
  .venv/                # gitignored
  tests/
    test_app.py         # pytest + FastAPI TestClient
.mcp.json               # new, repo root — registers the http MCP server
```

`mcp-services/` is a new top-level directory, kept separate from `scripts/`
(Node/shell tooling convention) since this is a different language and a
long-running service rather than a one-shot script.

## Endpoints

All GET, all read-only. Each function's docstring becomes the MCP tool
description fastapi_mcp hands to the LLM, so docstrings must be precise
about what the endpoint returns and its filters — this is the primary
interface an LLM will read, not just human documentation.

- `GET /bugs?q=&tag=&file=` — search `buglog.json` entries by free-text
  match against `error_message`/`root_cause`/`fix`, by `tags` membership,
  or by `file`. No params returns the full list.
- `GET /bugs/{bug_id}` — single bug by id (e.g. `bug-001`). 404 if absent.
- `GET /memory?limit=` — most recent N entries from `memory.md` (default a
  reasonable cap, e.g. 20, to avoid dumping the whole log by default).
- `GET /cerebrum?section=` — `cerebrum.md` content, optionally filtered to
  one section (Preferences / Learnings / Do-Not-Repeat). No `section`
  returns the full file.
- `GET /anatomy?path_prefix=` — `anatomy.md` file listing, optionally
  filtered to entries whose path starts with `path_prefix`.

## Data Access

Files are read directly from disk on every request — they're small
(hundreds to a few thousand lines) and read frequency will be low (session
start / occasional query), so caching would add invalidation complexity for
no measurable benefit.

**Path resolution:** per the repo's portable-repo-hygiene rule (no hardcoded
absolute paths in tracked files), `app.py` locates `.wolf/` relative to its
own file location (`Path(__file__).resolve().parents[1] / ".wolf"`,
i.e. two levels up from `mcp-services/openwolf-api/app.py` to the repo
root), never via a hardcoded `/Users/paulmckay/...` path or `Path.home()`
assumption about where `.claude` lives.

**Parsing:** `buglog.json` is loaded via `json.load`. `memory.md` and
`cerebrum.md` are parsed on entry/section boundaries already used by
OpenWolf's own append convention (each memory entry is a distinct
timestamped block; cerebrum sections are markdown `##` headers) — exact
parsing rules confirmed against the real files during implementation, not
guessed here. `anatomy.md` listing is parsed from its existing
`` `path` — description (~N tok) `` bullet format.

## fastapi_mcp Wiring

```python
from fastapi_mcp import FastApiMCP

app = FastAPI()
# ... route definitions ...
mcp = FastApiMCP(app)
mcp.mount()
```

`mount()` is called after all routes are registered (fastapi_mcp inspects
the app's route table at mount time). This exposes the MCP endpoint at
`/mcp` on the same ASGI app — no separate process for the MCP layer.

## Process Management

Served by `uvicorn app:app --host 127.0.0.1 --port 8765` (port checked free
during exploration). Kept running via PM2:

```
pm2 start "uvicorn app:app --host 127.0.0.1 --port 8765" \
  --name openwolf-mcp-api --cwd mcp-services/openwolf-api
```

No checked-in `ecosystem.config.js` — none exists elsewhere in the repo as
a precedent (OpenWolf's own daemon is started via its CLI, not a committed
PM2 config file), so this follows the same direct-`pm2 start` pattern
rather than introducing a new convention.

## MCP Registration

New repo-root `.mcp.json` (does not currently exist):

```json
{
  "mcpServers": {
    "openwolf-api": {
      "type": "http",
      "url": "http://127.0.0.1:8765/mcp"
    }
  }
}
```

Chosen over adding an entry to the global `~/.claude.json` `mcpServers` map
(which already lists gbrain/playwright/pinecone/context-mode/hf-mcp-server)
because a project-root `.mcp.json` is git-tracked and portable, and because
`~/.claude.json` edits have previously been observed to be blocked by the
auto-mode classifier (per CLAUDE.md §3) — a new tracked file avoids that
entirely. Per the "Skill symlinks / MCP registration are not live
mid-session" lesson already in CLAUDE.md, this server will not be callable
in the session that creates it — it becomes available starting the next
session.

## Security

Tier 0 (prototype, local-only, single dev; per CLAUDE.md's project-tier
table, security floor only: no secrets in code, no injection). Applied
here as:

- Bind `127.0.0.1` only — never reachable off the local machine.
- No authentication — read-only, non-sensitive local dev data, single
  local trusted client (Claude Code on the same machine). fastapi_mcp
  supports `Depends()`-based auth if this ever needs to change (e.g. if
  the service were ever bound beyond localhost), but nothing here
  currently warrants it.
- Before wiring endpoints up, grep `buglog.json`/`memory.md`/`cerebrum.md`
  for obvious secret-shaped content (API keys, tokens, credentials) as a
  sanity check — these files are meant to hold error messages and
  learnings, not secrets, but it costs nothing to confirm before exposing
  them over HTTP.
- No mutation endpoints at all — eliminates injection/write-corruption
  risk to `.wolf/` state by construction rather than by validation.

## Testing Plan

pytest + FastAPI `TestClient` (in-process, no network, no PM2/uvicorn
needed to run tests). Per endpoint: one happy-path test against real
`.wolf/` fixture data (small fixture copies checked into `tests/`, not the
live repo's `.wolf/` files, so tests don't depend on the current state of
the user's actual bug log) and one edge case (empty filter result, missing
`bug_id` → 404, etc.). TDD during implementation: write each endpoint's
test first per the repo's standard `test-driven-development` gate.

## Edge Cases

- `buglog.json` grows over time (currently ~3700 lines) — no pagination in
  this version; if it becomes a real problem, add `limit`/`offset` to
  `/bugs` as a follow-up, not preemptively.
- `memory.md`/`cerebrum.md` entry-boundary parsing must tolerate the file
  format drifting slightly over time (these are hand- and hook-appended
  logs) — parser should degrade to "return the raw section" rather than
  throwing if a boundary doesn't match the expected pattern exactly.
- PM2 process surviving a machine restart is not handled by this spec
  (matches the existing OpenWolf daemon / gbrain autopilot behavior, which
  also aren't configured to auto-resurrect — confirmed via `pm2 list`
  returning empty before this work started).
