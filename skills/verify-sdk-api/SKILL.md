---
name: verify-sdk-api
description: Use before writing exact code against a third-party package, SDK, or API whose exception hierarchy, current-vs-deprecated surface, or actual resolvable install on this Python/Node version isn't already verified in this session — documentation and training-data knowledge of a library's API can be stale, wrong, or version-specific.
---

# Verify SDK/API Behavior

## Overview

Spin up an ephemeral, throwaway install of a pinned package version, check what actually resolved and what a named symbol's real signature/docstring/exception hierarchy is, then discard the install. Verified facts, not documentation guesses, go into your spec/plan/code.

## When to Use

- About to write code against a specific exception class, and you're not certain it exists with that name in the pinned version
- About to use an API method that might be deprecated in favor of a newer one
- A version pin in `requirements.txt`/`package.json` looks unusual, or a dependency resolver might silently backtrack to an older/crippled release
- Don't use for packages already imported and working in the current project's own venv/node_modules — introspect those directly instead of re-verifying ephemerally

## Quick Reference

| Task | Command |
|---|---|
| Does this pip spec actually resolve to what I asked for? | `scripts/verify-python.sh install '<spec>'` |
| What's the real signature/MRO/docstring of a Python symbol? | `scripts/verify-python.sh inspect '<spec>' <dotted.path> [...]` |
| Does this npm spec actually resolve to what I asked for? | `scripts/verify-js.sh install '<pkg>@<version>'` |
| What's the real export shape of a JS symbol? | `scripts/verify-js.sh inspect '<pkg>@<version>' <exportName> [...]` |

Both scripts accept `--timeout <seconds>` (default 180) — raise it for known-heavy packages (torch, etc.) rather than letting the default trip early.

## Implementation

**Python example** — verifying an exception class before catching it:

```bash
scripts/verify-python.sh inspect "pinecone==9.1.0" "pinecone.exceptions.NotFoundException"
```

Reports the real MRO, `__init__` signature, public attributes, and docstring — confirms the class exists under that exact name and how to construct/catch it, instead of trusting training-data memory of the library's shape.

**JS example** — checking a package's actually-resolved version before pinning it:

```bash
scripts/verify-js.sh install "some-pkg@^2.0.0"
```

Reports the real resolved version and declared dependencies — catches a resolver silently landing on an unexpected release.

**JS introspection is weaker than Python's, by necessity:** JS has no universal runtime signature-reflection equivalent to Python's `inspect` module. `verify-js.sh inspect` reports the best it can — `fn.length` (arity), `fn.toString()` (source-level signature, good for parameter names, never for types), and a best-effort grep of any shipped `.d.ts` files for a declared type signature. Treat a JS inspect result as weaker evidence than a Python one, and say so when reporting findings back.

## Common Mistakes

- **Treating a docs/metadata read as equivalent to running the real install.** Reading a package's declared dependencies (PyPI `requires_dist`, npm `package.json`) confirms what it depends on, not whether the installer can actually resolve those pins on the current interpreter/runtime version — a resolver can silently backtrack to an old, broken release with no error. Run the real (or ephemeral) install before treating a metadata-based conclusion as final.
- **Skipping cleanup verification.** Both scripts clean up their own ephemeral directory via `trap cleanup EXIT` — you don't need to `rm -rf` anything yourself after calling them.
- **Assuming JS introspection is as strong as Python's.** It isn't (see above) — don't report a `fn.toString()` read with the same confidence as a Python `inspect.signature()` result.
