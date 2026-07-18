# Architecture Diagram Generator skill

**Status:** Approved, grilled
**Date:** 2026-07-17

## Context

The user found [Cocoon-AI/architecture-diagram-generator](https://github.com/Cocoon-AI/architecture-diagram-generator)
(MIT, ~6.5k stars) — a Claude skill that generates standalone dark-themed
HTML+SVG system architecture diagrams (self-contained file, inline SVG, no
external deps besides two pinned CDN scripts for export). Wants it added to
`~/.claude/skills/` and adapted to fit existing conventions — specifically
full brand compliance rather than installed as-is.

Source skill layout (from upstream `main` at time of writing):
```
architecture-diagram/
├── SKILL.md
└── resources/
    └── template.html
```

Its design system is a dark technical theme: slate-950 background, JetBrains
Mono, and 6 distinct semantic hues (cyan=frontend, emerald=backend,
violet=database, amber=cloud, rose=security, orange=message-bus) that let a
reader tell component types apart at a glance. Export is a built-in `⋯`
toolbar (Copy/PNG/PDF via `html2canvas` + `jsPDF`, both pinned via CDN with
SRI hashes).

This repo's `brand/brand-guide.md` (single source of truth for all outputs,
read by the `brand` skill) restricts any one document to **one accent color**
(Taupe *or* Slate, not both) plus Charcoal/Linen/Off-White, and explicitly
says: "If you need more emphasis, use scale, weight, or spacing, not a new
color." Six hues cannot survive that constraint, so the core design problem
is: how do you keep 6-7 component types visually distinguishable using only
one accent color?

Considered and rejected:
- **Icon + border-style matrix** — Feather icons per category instead of
  text tags. Rejected: icons would need to be hand-inlined as raw SVG paths
  to stay self-contained (feather is normally CDN-loaded), and still needs a
  legend to learn what each icon means.
- **Full monochrome, category only in label text** — every box looks
  identical; category lives in the label copy. Rejected: defeats the point
  of an architecture diagram as a glanceable artifact.

## Design

### File layout

```
skills/architecture-diagram/
├── SKILL.md
├── LICENSE
└── resources/
    └── template.html
```

Keeps upstream's own `resources/` split (the one deviation from
`dataviz`/`exec-dashboard`'s single-file convention — justified because the
reusable template is a genuinely separate, sizeable asset, exactly as
upstream ships it). `LICENSE` is the upstream MIT text, copied verbatim —
more correct than the no-`LICENSE` precedent set by the informal
mattpocock-derived skill installs, since this repo has an explicit MIT file
and the content is being substantially adapted, not just referenced.

### Frontmatter

```yaml
---
name: architecture-diagram
description: Create brand-compliant architecture diagrams as self-contained HTML+SVG files. Use when the user asks for system, infrastructure, cloud, security, or network topology diagrams.
---
```

### Brand integration

Add a new `## Format: Architecture Diagram` section to
`brand/brand-guide.md` — the same pattern every other output format (PDF,
Deck, Email, Business Card) already uses there. `SKILL.md` gets an explicit
gate line, matching `exec-dashboard`'s convention:

> **Gate:** Invoke the `brand` skill first to get the Brand Spec Card for
> "Architecture Diagram" before building.

This keeps `brand-guide.md` the single source of truth; future palette edits
propagate to this skill automatically instead of needing a second edit here.

The new `Format:` section's content is a direct transcription of the matrix
and rules below — no separate drafting pass is needed, since every decision
in it is already made by this spec (unlike the existing `Format:` sections,
which set original policy for their output type).

### Category differentiation matrix (replaces the 6-hue system)

Three orthogonal signals replace color-per-category:

| Signal | Values |
|---|---|
| **Fill tone** | Off-White = standard component · Linen = boundary/grouping container (region, cluster, VPC) · White + 2px Taupe border = emphasized/entry-point component |
| **Border style** | Charcoal 1.5px solid = standard component · Slate dashed `4,4` = security group / trust boundary · Khaki dashed `8,4` = region/cloud boundary |
| **Category tag** | Small uppercase Poppins 700 7px tag in Slate, positioned above each component label: `BACKEND` / `DATABASE` / `SECURITY` / `CLOUD` / `FRONTEND` / `MESSAGE BUS` / `EXTERNAL` |

**Single accent (Slate)** is used only for: category tags, connectors
(arrows), and their labels. Arrow *type* (data flow vs. auth/security flow)
is differentiated by solid-vs-dashed stroke plus the arrow's label text
(`HTTPS`, `JWT + PKCE`, `TLS`) — not by a second color. Arrow labels are
Slate, matching their line, per the "label color matches the element it's
labeling" rule below.

Rationale for Slate specifically: `brand-guide.md`'s color table already
names Slate the "secondary accent, data visualization" color, so this is the
brand-intended choice for a technical/diagram artifact, not an arbitrary
pick.

**Boundary and arrow label color rule:** a label's text color always matches
the color of the element it identifies — a region/cloud boundary (Khaki
border) gets a Khaki label, a security-group boundary (Slate border) gets a
Slate label, an arrow (Slate line) gets a Slate label. This makes every
label self-identifying without a legend lookup, and introduces no new color.

**Taupe usage is intentionally narrow:** Taupe appears in exactly two
places — the ◆ mark (see Header changes), and optionally the border of a
single emphasized/entry-point component box. It is never used for category
differentiation, boundaries, arrows, or labels. At most one component per
diagram may use the Taupe-bordered emphasis treatment.

### Typography

Poppins throughout the diagram itself (component labels, sublabels,
annotations, category tags, legend) — these are labels, not body copy, same
precedent as `exec-dashboard`'s chart tick labels and legends. Lora is
reserved for the narrative paragraphs inside the three summary cards below
the diagram (those are explanatory prose, closer to `exec-dashboard`'s
`InsightBox` narrative text than to a diagram label).

Font sizes carry over unchanged from upstream's ladder: 12/11px component
name, 9px sublabel, 8px annotation, 7px tiny label/tag.

**Component sizing must increase to fit the added tag line.** Upstream's
spacing rules (60px standard component height, 80-120px for larger
components, 40px minimum gap) were tuned for 2 lines of monospace text. This
design adds a 3rd line (the category tag) and switches to proportional
Poppins, which has different metrics than JetBrains Mono. Upstream's
concrete pixel values are a starting point, not a fixed constraint:
standard component height increases from 60px to ~72-76px, and the
80-120px "larger component" range increases proportionally (~92-136px), to
comfortably fit name + sublabel + tag without overflow. The underlying
*rules* (minimum 40px vertical gap, message buses placed in the gap,
legends placed below all boundaries) carry over unchanged — only the
absolute pixel values tied to box height shift.

### Header changes

- Drop the cyan pulse-dot decoration (`Common Mistakes` #5 in
  `brand-guide.md`: "unnecessary decoration") and the slate-950 SVG
  background grid pattern (a busy dot-grid doesn't fit "elements need space
  to exist")
- Add the ◆ mark (Taupe `#6b5b54`, ≥24px, per brand's minimum-size rule)
  beside the title, replacing the pulse-dot as the header's leading visual
  element. This is the *mark*, a separate brand concern from the content's
  single Slate accent — placing it doesn't violate the one-accent-per-doc
  rule, same as `exec-dashboard`'s header treats its own ◆ mark separately
  from its `COLORS.primary`/`COLORS.secondary` content accents.
- Recolor toolbar chrome (buttons, hover states) to Off-White/Linen/Charcoal
  to sit on the new light page background
- Replace the emoji toolbar icons (📋 🖼️ 📄) with inlined Feather icon SVG
  paths — `copy`, `image`, `file-text` — at the brand's standard
  `stroke-width: 1.5`, sized to the button, Charcoal (or Slate on hover),
  since `brand-guide.md` explicitly bans decorative/illustrative icons in
  favor of Feather/Heroicons. None of these three are in the guide's curated
  per-role icon tables (those tables are domain vocabulary for BA/PM/Ops
  deliverables, not an exhaustive UI whitelist), but they are real Feather
  icons used at the brand's standard style — `file-text` in particular
  already appears in the Foundation table ("Documents, reports"), a direct
  semantic match for the PDF button. Paths are inlined (not CDN-loaded) to
  keep the output self-contained, same reasoning as the rejected
  icon-differentiation approach in Context above.
- **Leave the Copy/PNG/PDF export mechanics untouched**: same
  `html2canvas`/`jsPDF` CDN scripts, same pinned versions, same SRI hashes,
  same `copyAsImage()`/`downloadPNG()`/`downloadPDF()` functions. This is
  pure plumbing with no brand surface, and it's more reliable right now than
  this repo's own `html-export` skill, whose Playwright pipeline is
  currently broken (per `claude-infra-reference`).
- Swap the Google Fonts `<link>` from JetBrains Mono to
  `Poppins:wght@400;600;700;800` + `Lora:wght@400;500` (exact string already
  used by `exec-dashboard`'s Step 5)

### Page background

Off-White `#fafaf8` (brand's primary page background) replaces
slate-950. Linen `#f5f2ed` is available for boundary/grouping containers per
the fill-tone table above — this keeps within brand's "maximum 2 background
colors per document" rule.

### Legend

Restyled to show the fill-tone + border-style + tag combinations (a small
key: 3 boxes showing each fill tone, 3 line samples showing each border
style) rather than 6 color swatches — same content, recast to the new
differentiation system.

### Summary cards

The three info cards below the diagram drop their leading colored
`card-dot` entirely (upstream used arbitrary rose/amber/violet dots with no
semantic payload — they didn't map to any category in the differentiation
matrix). Card headings become a plain Poppins 700 heading with no leading
dot, relying on typographic weight alone for emphasis, per the same
"scale/weight/spacing, not color" rule already driving the rest of this
design — this is a pure decoration removal, not a recoloring, since the
dot's original color carried no meaning to preserve.

### Delivery checklist (end of SKILL.md, mirrors exec-dashboard's)

- [ ] `brand` skill was invoked and "Architecture Diagram" Brand Spec Card confirmed
- [ ] Only Off-White/Linen/Charcoal/Slate/Taupe used; Slate is the only content accent; Taupe appears only on the mark and (at most) one emphasized/entry-point component border — never for category differentiation
- [ ] Poppins for all diagram labels/tags, Lora only in summary-card prose
- [ ] Every component box has a fill tone + border style + category tag per the matrix (no bare color-only differentiation), sized to comfortably fit all 3 text lines (~72-76px standard height)
- [ ] Boundary and arrow labels match the color of the element they identify (Khaki/Slate/Slate)
- [ ] Summary cards have no leading color dot — heading weight only
- [ ] ◆ mark present in header, ≥24px
- [ ] Export toolbar (Copy/PNG/PDF) present and functional, using inlined Feather icon SVGs (not emoji), CDN scripts' SRI hashes unmodified
- [ ] Output is a single self-contained `.html` file (embedded CSS, inline SVG, only Google Fonts + the two pinned export CDN scripts as external refs)

## Verification

No unit-testable logic — this is a markdown skill + HTML template, not
application code. Verification is manual: generate one sample diagram
recreating upstream's "web app" example (React frontend → Node/Express API →
PostgreSQL → Redis cache) using the new skill definition, open the resulting
HTML in a browser, and confirm it against the delivery checklist above —
brand colors only, mark present, category tags legible, export toolbar
produces a working PNG/PDF/clipboard copy.

## Out of scope

- No automated sync/pull mechanism from the upstream repo — this is a
  one-time adapted copy, following the precedent set by the
  mattpocock-derived skills (`grill-me`, `codebase-design`, etc.), not a git
  submodule. Revisit only if the user wants to track upstream updates.
- No changes to `html-export`'s broken Playwright pipeline — out of scope
  for this task, noted only as context for why the built-in CDN toolbar is
  being kept rather than routed through it.
