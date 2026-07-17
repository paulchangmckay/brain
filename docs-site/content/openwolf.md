---
title: "OpenWolf Integration"
description: "The self-learning memory and enforcement layer OpenWolf adds on top of Claude Code."
---

- OpenWolf maintains three project files: `.wolf/anatomy.md` (file map, checked before reading any project file), `.wolf/memory.md` (chronological action log), and `.wolf/cerebrum.md` (learned preferences, patterns, and a Do-Not-Repeat list).
- `.wolf/buglog.json` records every fixed bug with its error message, root cause, fix, and tags — checked before attempting a fix, appended to after one.
- Protocol enforcement rules (when to check/update each file) live in `.claude/rules/openwolf.md`, referenced from `CLAUDE.md` § 3 Infrastructure Layer.
- A background daemon (`openwolf daemon start`, PM2-based) runs self-learning crons; `openwolf status` reports health.

This page is a stub — a fuller synthesis of the OpenWolf mechanism is written later, incrementally.

Source of truth: `.claude/rules/openwolf.md` and `CLAUDE.md` § 3.
