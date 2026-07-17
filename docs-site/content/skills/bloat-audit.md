---
title: "bloat-audit"
description: ">"
---

Scan the whole tree, not a diff. Rank findings biggest cut first. Exclude
the same paths `debt-ledger` excludes: `.git`, `node_modules`, and every
submodule path listed in `.gitmodules` — vendored/upstream code isn't this
repo's bloat to report.

## Tags

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library already ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

## Hunt

Deps the stdlib or platform already ships, single-implementation interfaces,
factories with one product, wrappers that only delegate, files exporting one
thing, dead flags and config, hand-rolled stdlib. Dependency-bloat findings
(`package.json`/`requirements.txt` vs. actual imports) are model judgment —
read the manifest and the imports and reason about it. No tooling dependency
(no `depcheck` etc.) — would only cover JS anyway, and this repo also has
Python/bash/skill-file content such a tool can't see.

## Output

One line per finding, ranked: `<tag> <what to cut>. <replacement>. [path]`.
End with `net: -N lines, -M deps possible.` Nothing to cut: `Lean already. Ship.`

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security
holes, and performance route to `senior-engineering-partner`'s `AUDIT:` mode
or a normal code-review pass instead. Lists findings, applies nothing.
One-shot.
