---
name: architecture-diagram
description: Create brand-compliant architecture diagrams as self-contained HTML+SVG files. Use when the user asks for system, infrastructure, cloud, security, or network topology diagrams.
---

# Architecture Diagram Skill

Create professional technical architecture diagrams as self-contained HTML files with inline SVG graphics and CSS styling, styled to Paul McKay's brand system.

> Adapted from [architecture-diagram-generator](https://github.com/Cocoon-AI/architecture-diagram-generator) by Cocoon AI (MIT License, see `LICENSE`), restyled for brand compliance.

**Gate:** Invoke the `brand` skill first to get the Brand Spec Card for "Architecture Diagram" before building.

## Design System

### Color Palette

Only brand palette colors are used — no exceptions:

| Color | Hex | Role in this skill |
|---|---|---|
| Off-White | `#fafaf8` | Page background, standard component fill |
| Linen | `#f5f2ed` | Region/cluster/VPC boundary fill |
| Charcoal | `#2a2a28` | Body text, standard component border |
| Slate | `#5a7a8a` | The single content accent — category tags, connectors, security-group borders, and any label matching a Slate element |
| Khaki | `#a89980` | Sublabels, region/cloud boundary borders, and any label matching a Khaki element |
| Taupe | `#6b5b54` | The ◆ mark, and the border of at most one emphasized/entry-point component per diagram — never used for category differentiation |

### Category Differentiation (no per-category color)

Six-plus component types (frontend, backend, database, cloud, security, message bus, external) are told apart using three signals instead of six hues:

1. **Fill tone** — Off-White (standard) · Linen (boundary/grouping container) · White + 2px Taupe border (emphasized/entry-point, max 1 per diagram)
2. **Border style** — Charcoal 1.5px solid (standard) · Slate dashed `4,4` (security group / trust boundary) · Khaki dashed `8,4` (region/cloud boundary)
3. **Category tag** — small uppercase Poppins 700 7px tag in Slate, positioned above the component name: `BACKEND` / `DATABASE` / `SECURITY` / `CLOUD` / `FRONTEND` / `MESSAGE BUS` / `EXTERNAL`

**Label color always matches the element it identifies:** a region boundary (Khaki border) gets a Khaki label; a security-group boundary (Slate border) gets a Slate label; an arrow (Slate line) gets a Slate label. No new colors are introduced by labels.

### Typography

Poppins for everything in the diagram itself — component names, sublabels, tags, boundary labels, arrow labels, legend. Lora is reserved for the narrative prose inside the three summary cards below the diagram.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&family=Lora:wght@400;500&display=swap" rel="stylesheet">
```

Font sizes: 11-12px component name, 9px sublabel, 8px annotation, 7px tag/tiny label.

### Component Sizing

Standard component height is **72-76px** (not 60px) to fit three lines (tag + name + sublabel) with proportional Poppins metrics, which run wider and taller than the monospace font this skill was originally designed around. "Larger" components (multi-line lists, e.g. a bucket list) use **92-136px**. Minimum vertical gap between components stays **40px**; place inline connectors (message buses) in that gap, not overlapping either component.

### Component Box Pattern

Standard component (any category — differentiation is the tag, not the box style):

```svg
<rect x="X" y="Y" width="W" height="76" rx="6" fill="#fafaf8" stroke="#2a2a28" stroke-width="1.5"/>
<text x="CENTER_X" y="Y+18" fill="#5a7a8a" font-size="7" font-weight="700" text-anchor="middle" letter-spacing="0.05em">CATEGORY</text>
<text x="CENTER_X" y="Y+38" fill="#2a2a28" font-size="11" font-weight="600" text-anchor="middle">Component Name</text>
<text x="CENTER_X" y="Y+56" fill="#a89980" font-size="9" text-anchor="middle">sublabel / tech detail</text>
```

Emphasized/entry-point component (use for **at most one** component per diagram):

```svg
<rect x="X" y="Y" width="W" height="76" rx="6" fill="#ffffff" stroke="#6b5b54" stroke-width="2"/>
<!-- same tag/name/sublabel text pattern as above -->
```

Region/cloud boundary:

```svg
<rect x="X" y="Y" width="W" height="H" rx="12" fill="#f5f2ed" stroke="#a89980" stroke-width="1" stroke-dasharray="8,4"/>
<text x="X+12" y="Y+18" fill="#a89980" font-size="10" font-weight="600">Region label</text>
```

Security group / trust boundary:

```svg
<rect x="X" y="Y" width="W" height="H" rx="8" fill="transparent" stroke="#5a7a8a" stroke-width="1" stroke-dasharray="4,4"/>
<text x="X+8" y="Y+14" fill="#5a7a8a" font-size="8">sg-name :port</text>
```

### Arrows

```svg
<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
  <polygon points="0 0, 10 3.5, 0 7" fill="#5a7a8a" />
</marker>
```

All connector lines are Slate, solid for standard data flow, dashed (`5,5`) for auth/security flow. Differentiate flow *type* through the dash pattern and the arrow's label text (e.g. `HTTPS`, `JWT + PKCE`, `TLS`) — never through a second color. Draw arrows early in the SVG (right after `<defs>`) so they render behind component boxes.

### Legend

Place below all boundaries (at least 20px below the lowest boundary's bottom edge). Show:
- 3 fill-tone swatches (Off-White / Linen / White+Taupe) with labels
- 3 border-style line samples (Charcoal solid / Slate dashed / Khaki dashed) with labels
- The list of category tag words in use, as plain Slate 8px text (tags are self-explanatory once printed on each box — no swatch needed)

### Header

- ◆ mark, Taupe, ≥24px, leading the title — no pulse-dot or other decoration
- No background grid pattern (Off-White is a clean flat background)
- Export toolbar `⋯` toggle unchanged in behavior; icons are inlined Feather SVG paths (`copy`, `image`, `file-text`) at `stroke-width: 1.5`, not emoji — brand explicitly bans decorative/illustrative icons
- Toolbar chrome (buttons, borders, hover states) uses Off-White/Linen/Charcoal

### Summary Cards

Three cards below the diagram. Heading is a plain Poppins 700 label — no leading color dot (upstream's dot color was arbitrary and carried no category meaning; dropped rather than recolored). Body copy is Lora.

### Export Toolbar (built-in, unchanged mechanics)

Every diagram ships with a single `⋯` toggle. Click it to reveal Copy / PNG / PDF buttons — high-DPI PNG to clipboard (scale: 2), high-DPI PNG download, or a one-page PDF via jsPDF. Keep these intact when generating a new diagram:
- The two pinned CDN scripts in `<head>` (SRI hashes, `crossorigin="anonymous"`):
  - `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js` — `integrity="sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H"`
  - `https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js` — `integrity="sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/"`
  - Do not modify the hashes; if the CDN version is bumped, recompute the hash.
- `id="report-container"` on the outermost `.container` div
- `.toolbar` markup/CSS and the `copyAsImage()`/`downloadPNG()`/`downloadPDF()` functions, with `backgroundColor: '#fafaf8'` in every `html2canvas(...)` call (not upstream's `#020617` — this must match the new page background or exported images show the wrong fill in transparent regions)
- Each button holds a fixed icon `<svg>` plus a `<span class="label">` — the export functions must swap `label.textContent` only (e.g. to `✓ Copied!`), never the whole button's `textContent`, or the icon gets wiped

Caveats carried over from upstream: clipboard API needs a user gesture and a secure context (https/file/localhost); SVG `<foreignObject>` renders inconsistently in html2canvas, so stick to plain `<svg>` shapes and `<text>`.

## Template

Copy and customize the template at `resources/template.html`. Key customization points:
1. Update the `<title>` and header text
2. Modify SVG viewBox dimensions if needed (default: `1000 x 900`)
3. Add/remove/reposition component boxes using the patterns above
4. Draw connection arrows between components
5. Update the three summary cards
6. Update footer metadata

## Output

Always produce a single self-contained `.html` file with:
- Embedded CSS (no external stylesheets except Google Fonts)
- Inline SVG, including inlined Feather icon paths for the toolbar (no external images, no CDN icon script)
- Only the two pinned export CDN scripts (`html2canvas`, `jspdf`) as external JS

## Delivery Checklist

- [ ] `brand` skill was invoked and "Architecture Diagram" Brand Spec Card confirmed
- [ ] Only Off-White/Linen/Charcoal/Slate/Taupe used; Slate is the only content accent; Taupe appears only on the mark and (at most) one emphasized component border
- [ ] Poppins for all diagram labels/tags, Lora only in summary-card prose
- [ ] Every component box has a fill tone + border style + category tag per the matrix, sized to comfortably fit all 3 text lines (~72-76px standard height)
- [ ] Boundary and arrow labels match the color of the element they identify
- [ ] Summary cards have no leading color dot
- [ ] ◆ mark present in header, ≥24px
- [ ] Export toolbar present and functional, using inlined Feather icon SVGs (not emoji), CDN scripts' SRI hashes unmodified
- [ ] Output is a single self-contained `.html` file
