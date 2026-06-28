---
name: ba
description: Business Analysis documentation agent. Accepts a brief, produces a full BA package (process diagram, integration diagram, data map, SOP, executive summary), then optionally generates professional formatted documents (PPTX, DOCX, PDF, XLSX).
argument-hint: [brief]
---

# ba

## Phase 1: Sub-agent execution

Spawn the `ba-agent:ba` sub-agent with the user's brief as the prompt. Wait for it to complete.

The sub-agent handles:
- Brief normalisation and context object creation (intake)
- Artifact generation with observe checks: process diagram, integration diagram, data map, SOP
- BA package assembly: executive summary (SCR) + artifact manifest
- Mermaid PNG rendering and `docs-manifest.json` creation

---

## Phase 2 (parent level): Professional document creation

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

Wait for the Brand Spec Card output. Then locate the `### Brand Spec JSON` block in the brand skill's output and copy it as the `brandSpec` variable for all document-skill briefs below. Every brief references `brandSpec` for exact hex codes, font names, and weights — never describe brand values in freeform prose.

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
> **Design rules:** Apply `brandSpec` exactly:
> - Background: `brandSpec.colors.background`, accent: `brandSpec.colors.accent`
> - Headings: `brandSpec.typography.heading_font` weight `brandSpec.typography.heading_weight`
> - Body text: `brandSpec.typography.body_font` weight `brandSpec.typography.body_weight`
> - Mark: minimum `brandSpec.mark.min_size_px`px, placed `brandSpec.mark.placement`, color `brandSpec.mark.color`
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
> **Formatting rules:** Apply `brandSpec` exactly:
> - Heading font: `brandSpec.typography.heading_font` (never Arial or system default)
> - Body font: `brandSpec.typography.body_font` (never Arial or system default)
> - Table header fill: `brandSpec.colors.accent` with white text
> - Alternating body rows: `brandSpec.colors.background` / `brandSpec.colors.section_fill`
> - Callout box fill: `brandSpec.colors.section_fill`
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
> - Conditional formatting: highlight rows where Transformation contains "[inferred]" in `brandSpec.colors.supporting` (#a89980)
> - Header fill: `brandSpec.colors.accent` (#6b5b54) with white text
> - Alternating body rows: `brandSpec.colors.background` (#fafaf8) / `brandSpec.colors.section_fill` (#f5f2ed)
> - No hardcoded totals — if any aggregate rows are needed, use SUM() or COUNTA() formulas
> - Financial color conventions: blue fill for any manually-entered override cells, black text for formula cells
>
> Run `scripts/recalc.py` after creation to recalculate all formulas. Verify zero formula errors (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?) before reporting complete.
>
> Output: `[output_dir]/docs/data-map.xlsx`

---

## Phase 2.5 (parent level): Executive Dashboard

After professional documents complete (or are skipped), read the BA artifacts to offer a branded HTML dashboard.

**Read from the output directory:**
- `context.json` — process name, actors, systems, steps, data_fields, `has_metrics` flag
- `summary.md` — Resolution paragraph (insight) and first Open Item (recommendation)
- `data-map.md` — field rows for the breakdown table

**Determine dashboard variant:**
- If `context.json` contains `"has_metrics": true` → default to **KPI Dashboard**
- Otherwise → default to **Process Complexity Scorecard**

**Prompt the user:**

> **Phase 2.5: Executive Dashboard**
>
> Would you like a branded HTML dashboard with PNG + PDF export?
>
> - **KPI** — Data dashboard with KPI cards, metric chart, and data breakdown table *(recommended when brief contains quantitative data)*
> - **Scorecard** — Process complexity view: step count, integration count, field coverage, and actor distribution chart
> - **Skip** — No dashboard
>
> Reply: `kpi` / `scorecard` / `skip`

---

### If response is `kpi`

Invoke Skill: `exec-dashboard`

Pass this brief:

> Build a **KPI Dashboard** (Variant A) for process "[process_name]" using these BA artifacts:
>
> **Source files** (read all before writing App.tsx):
> - `[output_dir]/context.json` — actors, systems, data_fields
> - `[output_dir]/summary.md` — Resolution paragraph → `finding`; first Open Item → `recommendation`
> - `[output_dir]/data-map.md` — field rows → breakdown table (columns: Field | Source | Target | Type | Direction)
>
> **KPI cards** (4 max): extract the most significant quantitative fields from `data_fields`. Use field names as card labels and their volume/count/value as the metric. If fewer than 4 quantitative fields exist, supplement with: total fields mapped, total actors, total systems.
>
> **Chart**: Horizontal bar chart — Source System on Y-axis, count of fields from that system on X-axis. Title: "Data Coverage by Source System". Use data from `data-map.md`.
>
> **Insight box**: `finding` = first 1–2 sentences of the Resolution section from `summary.md`. `recommendation` = description of the first row in the Open Items table.
>
> **Dashboard title**: "[process_name] — Data Overview" with today's date.
>
> Output: `[output_dir]/docs/exec-dashboard/` (full project) and `[output_dir]/docs/exec-dashboard.html` (bundled single file).

After `exec-dashboard` completes, run:
```bash
node ~/.claude/skills/html-export/scripts/html-export.js [output_dir]/docs/exec-dashboard.html [output_dir]/docs/
```
Outputs: `[output_dir]/docs/exec-dashboard.png` and `[output_dir]/docs/exec-dashboard.pdf`.

---

### If response is `scorecard`

Invoke Skill: `exec-dashboard`

Pass this brief:

> Build a **Process Complexity Scorecard** (Variant B) for process "[process_name]" using these BA artifacts:
>
> **Source files** (read all before writing App.tsx):
> - `[output_dir]/context.json` — actors (list), systems (list), steps (list), data_fields, actor_step_map (if present)
> - `[output_dir]/summary.md` — Resolution paragraph → `finding`; first Open Item → `recommendation`
>
> **KPI cards** (exactly 4, computed from context.json and summary.md):
> 1. "Process Steps" = `steps.length`
> 2. "Systems Integrated" = `systems.length`
> 3. "Data Fields Mapped" = `data_fields.length`
> 4. "Open Items" = count of non-None rows in the Open Items table in `summary.md`
>
> **Chart**: Horizontal bar chart — actors on Y-axis, step count on X-axis. Title: "Step Distribution by Actor". Derive step count per actor from `actor_step_map` in context.json (if present), or count step labels containing each actor's name.
>
> **Breakdown table**: One row per actor. Columns: Actor | Role | Systems Involved | Steps. Derive from context.json actors and systems.
>
> **Insight box**: `finding` = Resolution paragraph from `summary.md`. `recommendation` = first Open Item.
>
> **Dashboard title**: "[process_name] — Process Complexity Scorecard" with today's date.
>
> Use the **Variant B App.tsx template** from the exec-dashboard skill (horizontal bar + actor table).
>
> Output: `[output_dir]/docs/exec-dashboard/` and `[output_dir]/docs/exec-dashboard.html`.

After `exec-dashboard` completes, run:
```bash
node ~/.claude/skills/html-export/scripts/html-export.js [output_dir]/docs/exec-dashboard.html [output_dir]/docs/
```

---

### After dashboard export completes

If a PPTX was generated in Phase 2, offer:
> Dashboard PNG is at `[output_dir]/docs/exec-dashboard.png`. Add it as a final slide to the PPTX executive deck? (y / skip)

If `y`: invoke `document-skills:pptx` with a brief to insert `exec-dashboard.png` as a new full-width slide titled "Executive Dashboard" at the end of `[output_dir]/docs/executive-deck.pptx`.

---

## Phase 3 (parent level): Communication documents

After professional documents complete (or are skipped), prompt:

> **Phase 3: Communication assets**
>
> Would you like stakeholder communication documents?
>
> - **3P** — A Progress/Plans/Problems executive update (30–60 seconds to read)
> - **FAQ** — A stakeholder FAQ sheet with sourced answers
> - **Both** — Both documents
> - **Skip** — No communication documents
>
> Reply: `3P` / `FAQ` / `both` / `skip`

Route based on response:
- `3P` or `both` → read `~/.claude/Agents/ba-agent/skills/comms-3p.md` and execute the full 3-stage co-authoring workflow inline in this conversation
- `FAQ` or `both` → read `~/.claude/Agents/ba-agent/skills/comms-faq.md` and execute the full 3-stage co-authoring workflow inline in this conversation
- `skip` → proceed to completion

If `both`: run 3P first, then FAQ. Each runs its full three-stage workflow independently.

---

## Phase 4: Completion

After all requested document skills and communication workflows complete, report:

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
