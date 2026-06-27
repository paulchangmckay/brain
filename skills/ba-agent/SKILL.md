---
name: ba-agent
description: Business Analysis documentation plugin. Provides the ba-agent:ba sub-agent used by the /ba skill to produce BA packages (process diagrams, SOPs, data maps, executive summaries) from a brief.
---

# ba-agent

## Phases 1–5: Sub-agent execution

Spawn the `ba-agent:ba` sub-agent with the user's brief as the prompt. Wait for it to complete.

The sub-agent handles:
- Brief normalisation and context object creation (intake)
- Artifact generation with observe checks: process diagram, integration diagram, data map, SOP
- BA package assembly: executive summary (SCR) + artifact manifest
- Mermaid PNG rendering and `docs-manifest.json` creation
- Optional communication document co-authoring (3P update, FAQ sheet)

---

## Phase 4 (parent level): Professional document creation

After the sub-agent returns, read `docs-manifest.json` from the output directory.

Locate it at: `~/.claude/Agents/ba-agent/outputs/<process_name>/docs-manifest.json`

The `process_name` is reported by the sub-agent in its completion message, or can be found by listing `~/.claude/Agents/ba-agent/outputs/` for the most recently modified directory.

---

### Brand gate (parent level)

Before producing professional documents, invoke the brand skill to load Paul's brand specs for this session.

Invoke Skill: `brand`

Pass this context:
> Preparing a Business Analysis package. Outputs may include: PPTX executive deck, DOCX report, XLSX data map, PDF.
> Produce a Brand Spec Card covering: color palette, typography (headings and body), layout/margins, and voice/tone rules.

Wait for the Brand Spec Card output. It will be referenced in all document briefs below.

---

### Prompt the user

> **Phase 4: Professional documents**
>
> The BA package is ready. Would you like professional formatted documents?
>
> - **All** — PPTX executive deck + DOCX report + XLSX data map + PDF
> - **PPTX** — Executive slide deck only
> - **DOCX + PDF** — Written report in Word format, exported to PDF
> - **Skip** — Keep markdown outputs only
>
> Reply: `all` / `pptx` / `docx+pdf` / `skip`

---

### If response includes PPTX (`all` or `pptx`)

Invoke Skill: `document-skills:pptx`

Pass this brief to the skill:

> Create a 7-slide executive Business Analysis deck using the artifacts in `[output_dir]`.
>
> **Slide structure:**
> 1. **Cover** — Process name, prepared date, "Business Analysis Package" subtitle
> 2. **Executive Summary** — Three-section layout: Situation / Complication / Resolution pulled verbatim from `summary.md`. One content block per section.
> 3. **Process Flow** — Full-width image of `process.png`. Add a callout box listing the actor swimlanes.
> 4. **System Integration** — Full-width image of `integration.png`. Add a legend for edge label types (data flow, trigger, response).
> 5. **Data Landscape** — Table of the top 8–10 rows from `data-map.md` (prioritize fields with non-trivial transformations). Columns: Field | Source | Target | Transformation.
> 6. **Key Decisions & Pain Points** — Two-column layout: left column lists `decision_points` from `context.json`; right column lists `pain_points`. If either is empty, use a single-column layout with a note.
> 7. **Next Steps** — Bulleted list from the Resolution section of `summary.md`, plus any open items from the Open Items section.
>
> **Design rules:** Apply the Brand Spec Card from the brand gate above exactly — colors, typography, spacing, mark placement.
> - Every slide must have a visual element — diagram slides use images; others use shapes, icons, or table highlights.
> - No text-only slides. No centered body text. No accent lines under slide titles. No 3D effects or drop shadows.
>
> Output: `[output_dir]/docs/executive-deck.pptx`

---

### If response includes DOCX (`all` or `docx+pdf`)

Invoke Skill: `document-skills:docx`

Pass this brief to the skill:

> Create a professional Business Analysis report Word document using the artifacts in `[output_dir]`.
>
> **Document structure:**
> - Title page: Process name, prepared date, "Business Analysis Package", process owner (from context.json actors — most senior role)
> - Table of Contents (auto-generated, HeadingLevel only)
> - **Executive Summary** — Full content of `summary.md` (Situation, Complication, Resolution, Artifact Summary, Open Items)
> - **Process Documentation** — Embed `process.png` at full column width, followed by the full content of `sop.md` formatted as a numbered procedure
> - **System Integration** — Embed `integration.png` at full column width, with a paragraph explaining the systems and data flows from `context.json`
> - **Data Mapping** — Full `data-map.md` table with header row styling and alternating row shading
> - **Open Items** — Reproduce the Open Items section from `summary.md`, formatted as a checklist
>
> **Formatting rules:** Apply the Brand Spec Card from the brand gate above exactly — colors, typography, table header/body styling, callout box fills.
> - Page: US Letter (12240 × 15840 DXA). Margins: 1440 DXA (1 inch) all sides.
> - Header: Process name. Footer: page numbers.
> - Smart quotes. Table widths using DXA (never PERCENTAGE). No \n in paragraphs — use separate Paragraph elements.
>
> Output: `[output_dir]/docs/ba-report.docx`

---

### If response includes PDF (`all` or `docx+pdf`)

Invoke Skill: `document-skills:pdf`

Pass this brief to the skill:

> Convert `[output_dir]/docs/ba-report.docx` to PDF.
>
> Use LibreOffice headless conversion for fidelity. Preserve all formatting, images, and page layout.
>
> Output: `[output_dir]/docs/ba-report.pdf`

---

### If response includes XLSX (`all`)

Invoke Skill: `document-skills:xlsx`

Pass this brief to the skill:

> Convert the data mapping from `[output_dir]/data-map.md` into a professional Excel spreadsheet.
>
> **Requirements:**
> - Sheet name: "Data Map"
> - Header row: Field | Source System | Source Field | Target System | Target Field | Transformation | Notes
> - Freeze the header row and first column
> - Auto-filter on all columns
> - Column widths: auto-fit based on content (minimum 15 characters wide)
> - Conditional formatting: highlight rows where Transformation contains "[inferred]" in yellow
> - Color palette: Apply Brand Spec Card colors — header fill = accent color, alternating body rows = background + section fill. Highlighted [inferred] rows: yellow (per rule above).
> - No hardcoded totals — if any aggregate rows are needed, use SUM() or COUNTA() formulas
> - Financial color conventions: blue fill for any manually-entered override cells, black text for formula cells
>
> Run `scripts/recalc.py` after creation to recalculate all formulas. Verify zero formula errors (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?) before reporting complete.
>
> Output: `[output_dir]/docs/data-map.xlsx`

---

### Completion

After all requested document skills complete, report:

> **BA Package complete.** Outputs at `~/.claude/Agents/ba-agent/outputs/<process_name>/`:
>
> **Core artifacts (markdown):**
> - `process.mmd` / `process.png` — Process flow diagram
> - `integration.mmd` / `integration.png` — System integration diagram
> - `data-map.md` — Field-level data mapping
> - `sop.md` — Standard Operating Procedure
> - `summary.md` — Executive summary (SCR)
> - `index.md` — Artifact manifest
>
> **Professional documents** (if created):
> - `docs/executive-deck.pptx`
> - `docs/ba-report.docx`
> - `docs/ba-report.pdf`
> - `docs/data-map.xlsx`
>
> **Communication assets** (if created):
> - `comms/3p-update.md`
> - `comms/faq.md`
