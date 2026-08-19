# Web Interface Guidelines Checklist

## Forms

- Every input has a `<label>` (or `aria-label` if a visible label truly
  doesn't fit the design).
- Use the correct `type`/`inputmode` (`email`, `tel`, `number`) so mobile
  keyboards match the expected input.
- Set `autocomplete` attributes on standard fields (email, name, address,
  etc.) — don't make users re-type what the browser already knows.
- Respect native spellcheck unless there's a specific reason to disable it
  (e.g. a code/username field).
- Show validation errors inline, next to the field that failed — not only
  as a summary at the top of the form.
- Warn before navigating away from a form with unsaved changes.

## Animation

- Honor `prefers-reduced-motion` with a real non-animated fallback, not
  just a shortened duration.
- Animate `transform` and `opacity` only — these are compositor-friendly.
  Animating `width`, `height`, `top`, or `left` forces layout on every
  frame.
- Never use `transition: all` — it silently animates every property that
  changes, including ones you didn't intend (and ones that hurt
  performance, like `box-shadow`).

## Typography

- Use a real ellipsis character or CSS `text-overflow: ellipsis`, not three
  literal periods.
- Use curly quotes and proper apostrophes in copy, not straight quotes.
- Use a non-breaking space between a number and its unit (`10&nbsp;MB`) so
  they never wrap onto separate lines.
- Avoid an orphaned single word on a paragraph's last line where the layout
  gives you control over it.

## Content handling

- Design an explicit empty state for every list/table — don't just render
  nothing when there's no data.
- Truncate long user-generated text predictably (with a "show more"
  affordance), rather than letting it break the layout.

## Images

- Always set explicit `width`/`height` or `aspect-ratio` to prevent layout
  shift while the image loads.
- Lazy-load images below the fold.
- Prioritize/preload the largest above-the-fold image — it's usually the
  page's LCP (Largest Contentful Paint) element.

## Navigation & state

- Reflect meaningful UI state in the URL (active filters, tab, page number)
  so it survives a refresh or gets preserved when shared.
- Confirm before a destructive action (delete, discard) rather than
  executing it immediately on click.

## Touch & interaction

- If disabling the default tap-highlight color, replace it with a
  deliberate custom pressed/active state — don't just remove feedback.
- Respect safe-area insets (`env(safe-area-inset-*)`) on notched devices.
- Make touch targets at least 44×44px.

## Dark mode & theming

- Set `<meta name="color-scheme">` and honor the native
  `prefers-color-scheme` media query.
- Set the `color-scheme` CSS property so browser-drawn native controls
  (date pickers, `<select>` dropdowns) match the theme instead of
  rendering with mismatched (often broken-looking) default styling.

## Internationalization

- Use `Intl.NumberFormat`, `Intl.DateTimeFormat`, and
  `Intl.RelativeTimeFormat` instead of hand-rolled formatting.
- Don't assume text direction or a fixed string length — leave room for
  text expansion when the UI will be translated (many languages run 30%+
  longer than English for the same meaning).

## Hydration safety

- Never render `Date.now()`, `Math.random()`, or other non-deterministic
  values directly into server-rendered markup — the client re-render won't
  match, triggering a hydration mismatch warning (or a full client-side
  reset of that subtree).
- Gate any browser-only API (`window`, `localStorage`, `document`) behind a
  client-only check or an effect hook — referencing them during the
  server-render pass throws or silently produces wrong output.

## Content & copy

- Write action labels in active voice describing the action ("Delete
  project", not "Deletion").
- Write specific, actionable error messages ("Email already in use", not
  "An error occurred").
