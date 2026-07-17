---
title: "debt-ledger"
description: ">"
---

Every deliberate shortcut should carry a `wolf-debt: <ceiling>, <upgrade
trigger>` comment (see CLAUDE.md §3). This skill collects them into one
ledger so a deferral can't quietly become permanent.

## Scan

Run the deterministic scanner and present its output verbatim — do not
re-summarize or re-rank it, it is already complete:

```bash
node scripts/wolf-debt-scan.js "${CLAUDE_CWD:-.}"
```

It already excludes `.git`, `node_modules`, and every submodule path listed
in `.gitmodules`, and tags any marker with no comma-separated second clause
as `no-trigger` — the ones most likely to silently rot.

## Boundaries

Read-only, changes nothing. If asked to persist the ledger, write the same
output to `.wolf/debt.md`. One-shot — no session state, no hook.
