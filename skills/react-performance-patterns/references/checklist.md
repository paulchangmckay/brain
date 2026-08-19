# React Performance Patterns Checklist

## Bundle size — barrel imports

- Importing from a package's barrel/index file
  (`import { Button } from 'ui-lib'`) can pull in the entire library even
  when the bundler theoretically supports tree-shaking, if the package
  doesn't correctly declare `sideEffects: false`.
- Prefer deep imports for large libraries
  (`import Button from 'ui-lib/Button'`), or confirm the library's
  `package.json` actually sets `sideEffects: false` before trusting barrel
  tree-shaking to work.

## Bundle size — code splitting

- Code-split anything not needed for first paint: modals, below-fold
  widgets, admin-only routes. Use `next/dynamic` or `React.lazy`.

## Re-renders

- Don't create new object/array/function literals inline as props on every
  render if the receiving child is memoized (`React.memo`) — a new literal
  every render defeats the memoization, since the child sees a "changed"
  prop every time. Use `useMemo`/`useCallback`, or hoist the literal
  outside the component if it doesn't depend on render-scoped values.
- Split large context providers by update frequency. A single context whose
  value changes often re-renders every consumer, even ones that only read
  parts of the value that didn't change. Either split into multiple
  contexts, or use a selector-based state library for high-frequency state.
- Avoid `useState` for continuously-updating values driven by
  animation/gesture (scroll position, drag position) — that re-renders the
  whole subtree on every frame. Use a ref, or a motion-library value
  (e.g. `useMotionValue`) instead.

## Async waterfalls

- Fetch sibling data in parallel (`Promise.all`, or parallel route/data
  loaders) when there's no real dependency between the requests — sequential
  `await`s that don't need to be sequential are a waterfall.

## Server-side performance (Next.js)

- Prefer Server Components for data-fetching-only, non-interactive UI —
  they ship zero JS to the client. Reserve Client Components for the
  smallest subtree that actually needs interactivity or client state.
- Cache/deduplicate repeated data fetches within a single request (React's
  `cache()`, or Next's built-in fetch memoization) instead of re-fetching
  the same resource from multiple components in the same render pass.

## Lists

- Virtualize any list rendering more than roughly a few hundred DOM nodes
  at once (`react-window`, `@tanstack/react-virtual`) rather than rendering
  the full array unconditionally.

## Diagnosis order

When performance-reviewing a page, check in this order — it matches actual
impact, not alphabetical convenience:
1. Bundle size (barrel imports, missing code-splitting)
2. Server-side bottlenecks (sequential fetches, missing dedup)
3. Re-render issues (memoization, context granularity)
4. List virtualization
