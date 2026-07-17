---
title: "Knowledge Graph"
description: "understand-anything's knowledge graph over ~/.claude itself."
---

- `~/.claude` is tracked in git, and its `understand-anything` knowledge graph is rebuilt incrementally after changes via `/understand-anything:understand ~.claude` — regular commits keep rebuilds cheap (a handful of batches instead of a full 32-batch rebuild).
- `langsmith-plugin`, `superpowers`, and `skills/senior-engineering-partner` are git submodules — synced with `git submodule update`, never `git add`-ed directly.
- Submodule remotes are third-party upstreams, not personal forks; local changes live on a `local-customizations` branch, re-fast-forwarded after each new submodule commit rather than pushed upstream.

Source of truth: `CLAUDE.md` § 6 Knowledge Graph.
