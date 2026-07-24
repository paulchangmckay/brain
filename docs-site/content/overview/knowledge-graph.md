---
title: "Knowledge Graph"
description: "understand-anything's knowledge graph over ~/.claude itself."
---

Alongside the memory layers described in the
[Personal Knowledge Layer](/overview/personal-knowledge-layer) page, this
repo maintains a structural knowledge graph of itself using the
`understand-anything` tooling. It works by analyzing a codebase's file
structure and the relationships between files — imports, references,
groupings — and turning that into an interactive graph that's useful for
onboarding someone new or exploring the architecture of a codebase that's
grown too large to hold in your head at once.

Because the graph is a snapshot, it needs periodic re-analysis as the
codebase actually changes underneath it; a graph built once and never
refreshed drifts from reality the same way any other stale documentation
does. This is a supporting tool for navigating the repo, not part of how the
harness enforces its own rules — the layers covered elsewhere in this
overview do that work.

Source of truth: `CLAUDE.md` § 6 Knowledge Graph.
