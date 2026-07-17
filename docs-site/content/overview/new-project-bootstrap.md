---
title: "New Project Bootstrap"
description: "How a project gets its .wolf/ directory and self-learning memory."
---

- Any project starting work without a `.wolf/` directory should invoke the `wolf-init` skill, or run manually:
  - `openwolf init` — creates `.wolf/` and registers Claude Code hooks
  - `openwolf scan` — builds the initial anatomy map
  - `openwolf daemon start` — starts background self-learning crons (requires PM2)
  - `openwolf status` — confirms health

Source of truth: `CLAUDE.md` § 4 New Project Bootstrap.
