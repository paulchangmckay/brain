# Tailwind CSS Patterns

## Purging / content config

Classes only survive the production build if Tailwind's `content` globs
actually match the files using them, AND the class string appears
**literally** in the source — string concatenation like
`` `text-${color}-500` `` is invisible to Tailwind's static scanner and
gets silently dropped from the production build. Use a lookup object
mapping to full literal class strings instead of interpolating into a
utility name:

```js
// Wrong — invisible to the scanner, drops from production build
const cls = `text-${color}-500`;

// Right — every literal class string is scannable
const colorClasses = {
  red: 'text-red-500',
  blue: 'text-blue-500',
};
const cls = colorClasses[color];
```

## Dark mode

- Pick the `class` strategy (`darkMode: 'class'`) for a user-toggleable
  theme; use `media` strategy only if you want to follow the OS setting
  with no in-app override.
- Apply `dark:` variants directly alongside the light-mode utility on the
  same element (`bg-white dark:bg-gray-900`) rather than maintaining a
  parallel dark stylesheet.

## Responsive

- Mobile-first: write the base (unprefixed) utility for the smallest
  viewport, then layer `sm:`/`md:`/`lg:` overrides upward. Never write the
  desktop layout first and try to override it down for mobile.

## Cards

- `rounded-lg border p-4 shadow-sm` is a reasonable default surface.
- Use `divide-y` on a card list instead of manually adding a border to
  each child.

## Forms

- Use `focus-visible:ring-2`, not bare `focus:` — `focus-visible` only
  shows the ring for keyboard focus, not every mouse click.
- Keep consistent spacing between stacked fields (`space-y-4` on the
  container).

## Grids

- For a responsive card grid where the exact column count doesn't matter,
  `grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))]` beats manually
  breakpointing column counts at every screen size.

## Navigation

- `sticky top-0 z-10 backdrop-blur` for a translucent sticky header.
- Keep interactive nav elements as real `<button>`/`<a>` — styling alone
  doesn't make a `<div>` accessible or keyboard-operable.

## Common pitfalls

- Arbitrary values (`w-[137px]`) are an escape hatch, not a first choice —
  prefer the design-system scale (`w-32`, `w-36`) unless there's a genuine
  one-off constraint that doesn't fit the scale.
- `!important` overrides (`!text-red-500`) usually signal a specificity
  fight worth fixing at its source, not masking with a forced override.
