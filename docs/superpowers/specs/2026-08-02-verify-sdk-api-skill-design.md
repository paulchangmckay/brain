# verify-sdk-api Skill — Design

## Context

Observation 16 (`.wolf/observations.md`) flagged a repeating pattern across
sessions: needing to verify real third-party package/SDK behavior before
committing exact code into a spec, plan, or implementation, because
documentation and model training-data knowledge of a library's API can be
stale, wrong, or version-specific. Two concrete prior instances:

- **Pinecone Python client**: needed the real exception class hierarchy
  (`NotFoundException`, `PineconeApiException.status_code`) and the
  current-vs-deprecated API surface (`pc.indexes.create` with
  `IntegratedSpec`/`EmbedConfig` vs. the deprecated
  `create_index_for_model`) — each verified ad hoc via a throwaway venv,
  `pip install`, and `inspect.signature`/`inspect.getdoc`.
- **markitdown/pipx**: grilling read PyPI `requires_dist` metadata to
  disprove a suspected torch/Python-3.14 install risk and concluded a
  `pipx install --python python3.11` fallback was unnecessary. Actually
  running `pipx install 'markitdown[all]'` afterward revealed a different,
  real problem the metadata read missed entirely: pip silently backtracked
  to a crippled `markitdown==0.0.2` because `xlrd`/
  `youtube-transcript-api~=1.0.0` have no Python-3.14-compatible release —
  no error, just a wrong version installed.

Each check followed the same ad-hoc pattern (ephemeral install →
introspect → discard) reinvented from scratch each time. This spec
packages that workflow into a reusable skill.

## Scope

Covers both Python and JS/Node from the start (not deferred to a
follow-up), per the observation's own stated principle that this
generalizes beyond Python. Two distinct checks, mirrored per language:

1. **Install verification**: does installing an exact pinned
   requirement spec actually resolve to the requested version on the
   current interpreter, or does the resolver silently backtrack to an
   older/crippled version?
2. **Symbol introspection**: for an installed package, what is the real
   signature, docstring, and (for classes) MRO/bases of a named symbol?

Out of scope: private/scoped registries requiring auth (fail loudly, no
credential handling); a shared cross-language output format (each script
reports in its own ecosystem's natural terms); any long-term caching of
verification results (every invocation is a fresh ephemeral check — the
whole point is not trusting a possibly-stale prior result).

## File Structure

```
skills/verify-sdk-api/
  SKILL.md
  scripts/verify-python.sh   # install | inspect subcommands
  scripts/verify-js.sh       # install | inspect subcommands
```

Matches this repo's established convention for a scripted skill
(`skills/<name>/scripts/<name>.{sh,py,js}`, e.g. `html-export`,
`senior-engineering-partner`) rather than inlining bash directly in
`SKILL.md` — the two checks (install, inspect) are common enough
operations to warrant a deterministic, reusable script instead of
improvised bash each time.

## Script Behavior

### `scripts/verify-python.sh install <pip-requirement-spec> [--python <version>] [--timeout <seconds>]`

1. `mktemp -d` for an ephemeral venv location (never inside a git repo).
2. `python<version|3> -m venv <tmpdir>/venv` — no `activate`/`deactivate`;
   every subsequent step invokes `<tmpdir>/venv/bin/pip`/`bin/python3`
   directly by absolute path (verified this works identically to an
   activated shell, and makes cleanup a bare `rm -rf` with no shell-state
   concerns).
3. `timeout <seconds|180> <tmpdir>/venv/bin/pip install <requirement-spec>`
   (spec may include extras, e.g. `'markitdown[all]'`, or an exact pin,
   e.g. `pinecone==9.1.0`). Default 180s, overridable via `--timeout` for
   known-heavy packages (torch etc.) — a timeout exits clearly (124) with
   an explicit message rather than the caller waiting indefinitely.
4. Parse the top-level distribution name from the spec via a simple
   delimiter split on `[=<>!~; ` (verified this correctly extracts
   `pinecone`, `markitdown`, `scikit-learn`, etc. from every realistic
   spec shape). Report the **actually-resolved** installed version and
   declared dependencies via `<tmpdir>/venv/bin/python3 -c "import
   importlib.metadata as md; ..."` (`md.version(name)`, `md.requires(name)`
   — verified cleaner and more robust than parsing `pip show`'s
   human-readable text output) vs. what was requested — loudly flag a
   version mismatch.
5. `trap cleanup EXIT` removes the tmpdir unconditionally, including on
   failure, interrupt, or timeout.

### `scripts/verify-python.sh inspect <pip-requirement-spec> <dotted.symbol.path> [...] [--timeout <seconds>]`

1. Same ephemeral venv + timed install as above.
2. For each symbol path: import the module via `<tmpdir>/venv/bin/python3`,
   resolve the attribute chain. If it's a class, report MRO/bases,
   `__init__` signature (`inspect.signature`), docstring
   (`inspect.getdoc`), and public attributes. If it's a function/method,
   report signature + docstring. A wrong/nonexistent symbol path surfaces
   Python's own `AttributeError`/`ModuleNotFoundError` traceback directly
   — already informative enough, no custom wrapping needed.
3. Same unconditional cleanup.

### `scripts/verify-js.sh install <pkg>@<version> [--timeout <seconds>]`

Scratch `timeout <seconds|180> npm install <pkg>@<version>` into a temp
dir (never inside a git repo), then compares the resolved version in
`node_modules/<pkg>/package.json` against what was requested (verified
this file's `version` field correctly reflects the actually-resolved
version, not a stale cache) — same silent-downgrade check as Python.
Unconditional cleanup.

### `scripts/verify-js.sh inspect <pkg>@<version> <exportName> [...] [--timeout <seconds>]`

Same timed scratch install. JS has no universal runtime signature reflection
equivalent to Python's `inspect` module, so this check is **necessarily
weaker** and the skill documents that honestly rather than overpromising:

- For typed packages: grep the shipped `.d.ts` files for the symbol's
  declared type signature (best-effort, not a full TypeScript compiler
  load).
- For untyped/CommonJS packages: report exported keys, `fn.length`
  (arity), and `fn.toString()` (source-level signature — useful for
  parameter names, never for types).

### Output format (both scripts, both subcommands)

Plain, clearly-delimited text, not JSON. The only consumer is Claude
reading tool output directly in the same session — no downstream program
parses this output, so a machine-readable contract would be unused
complexity.

## SKILL.md

**Description (trigger):** "Use before writing exact code against a
third-party package/SDK/API whose exception hierarchy, current-vs-
deprecated surface, or actual resolvable install on this Python/Node
version isn't already verified in this session — spins up an ephemeral
install, introspects the real installed artifact, tears down, and hands
back verified facts instead of relying on documentation or training-data
knowledge."

Body documents both scripts' subcommands, the JS introspection
limitation explicitly, and the edge cases below.

## Implementation Process

The deliverable is a skill, not application code, so *authoring* the
`SKILL.md` + scripts content follows the `writing-skills` meta-skill
(RED-GREEN-REFACTOR-for-skills, pressure-scenario testing, SDO
description rules) rather than generic app-code TDD — the same way
`test-driven-development` governs "how do I write good app code" without
replacing the surrounding process scaffolding. The plan produced by
`writing-plans` should structure the skill-authoring tasks to follow
`writing-skills`' methodology specifically, while the standard
`github-issue-first → using-git-worktrees → verification-before-completion
→ requesting-code-review` pipeline still wraps the whole feature as usual.

## Edge Cases

- Extras/version syntax differs per ecosystem (`pkg[extra]==1.2.3` for
  pip vs. `pkg@1.2.3` for npm) — each script handles its own ecosystem's
  native syntax; no shared/normalized spec format across scripts.
- Private/scoped packages requiring registry auth — out of scope; the
  script fails loudly with a clear message rather than hanging waiting
  for credentials.
- Large packages (e.g. `torch`) — ephemeral install may be slow. Both
  install steps are wrapped in `timeout <seconds|180>` (overridable via
  `--timeout`) so a stuck resolver or genuinely heavy package fails
  loudly and quickly (exit 124) instead of hanging the calling session
  indefinitely with no signal. `SKILL.md` also documents raising
  `--timeout` proactively for known-heavy packages.
- Cleanup on script failure, interrupt (Ctrl-C), or timeout — handled
  generically by `trap cleanup EXIT` in both scripts, not just on the
  success path.

## Testing Plan

Per `writing-skills`' pressure-scenario methodology (applied during
implementation, not detailed further here): exercise both scripts against
at least one real package per language covering (a) a clean, correctly-
resolving install, (b) a version mismatch/silent-downgrade case, and (c)
a symbol-introspection case with a class (exception hierarchy) and a
function/method. Confirm cleanup actually removes the ephemeral
directory in both the success and a forced-failure path.
