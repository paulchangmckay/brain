---
name: html-export
description: "Export any local HTML file or URL to a pixel-perfect PNG screenshot and PDF using Playwright. Use after web-artifacts-builder produces bundle.html, or when any HTML artifact needs to be shared asynchronously, embedded in a slide deck, or archived as PDF."
---

# HTML Export Skill — Playwright Screenshot & PDF

Converts any local HTML file or live URL into a full-page PNG screenshot and a PDF using the Playwright Chromium browser already installed on this system.

---

## When to Use

- After `web-artifacts-builder` produces `bundle.html` — export before sharing asynchronously
- After `exec-dashboard` produces its output — to embed in PPTX or email
- Any time an interactive HTML artifact needs a static, shareable snapshot
- When an executive needs a PDF rather than a link

---

## Step 1: Locate Playwright

Playwright is already installed:

```bash
npx playwright --version  # verify
```

If this returns an error, install:
```bash
npm install -g playwright
npx playwright install chromium
```

---

## Step 2: Run the Export Script

The export script is at `~/.claude/skills/html-export/scripts/html-export.js`.

**Usage:**
```bash
# Export a local HTML file (relative or absolute path)
node ~/.claude/skills/html-export/scripts/html-export.js path/to/bundle.html

# Export to a specific output directory
node ~/.claude/skills/html-export/scripts/html-export.js path/to/bundle.html /path/to/output/

# Export a live URL
node ~/.claude/skills/html-export/scripts/html-export.js https://example.com
```

**Output:** Two files alongside the source (or in the specified directory):
- `<name>.png` — full-page screenshot at 1440px wide (standard exec presentation width)
- `<name>.pdf` — A4 PDF with print background colors preserved

---

## Step 3: Viewport & Quality Notes

Default settings are optimized for executive review:
- **Width:** 1440px (matches most presentation embed widths)
- **Device pixel ratio:** 2× (retina-quality PNG)
- **PDF format:** A4, landscape if the content is wider than it is tall
- **Wait:** `networkidle` — waits for all fonts, images, and async renders to complete before capture

For dashboards with animations or lazy-loaded data, add `--wait <ms>` to delay after load.

---

## Step 4: Embed in PPTX

After export, embed the PNG into a slide via the `pptx` skill:
```
Add the file at <path>.png as a full-bleed image on slide N, preserving aspect ratio.
```

Or reference the PDF in a doc via the `docx` or `pdf` skill.

---

## Notes

- The script uses the system Playwright installation — no project-level install needed
- PDFs preserve background colors (`printBackground: true`) — required for brand-colored charts
- If fonts don't render correctly, ensure the HTML file includes the Google Fonts link tag
- For files served by a local dev server, pass the `http://localhost:<port>` URL instead of the file path
