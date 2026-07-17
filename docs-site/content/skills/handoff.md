---
title: "handoff"
description: "Compact the current conversation into a handoff document for another agent to pick up."
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to `.wolf/handoffs/<UTC-timestamp>-handoff.md` in the project root (create the directory if it doesn't exist) - not the OS temp directory. This keeps the handoff discoverable via OpenWolf's anatomy scan and lets it survive across worktrees.

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
