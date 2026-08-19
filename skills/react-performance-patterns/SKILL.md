---
name: react-performance-patterns
description: Use when reviewing or writing React or Next.js code for performance issues — suspected unnecessary re-renders, large bundle size, barrel-import bloat, async waterfalls, or slow server-side rendering/data fetching.
---

# React Performance Patterns

Impact-ranked performance checks for React and Next.js code, adapted from
Vercel's internal performance methodology. Fix bundle-size and server
bottlenecks before chasing individual re-render micro-optimizations — the
former usually dominates real-world load time.

See `references/checklist.md` for the full checklist, organized by area:
bundle size, re-renders, async waterfalls, server-side performance, and
list virtualization.

React/Next.js-specific — not relevant to non-React projects.
