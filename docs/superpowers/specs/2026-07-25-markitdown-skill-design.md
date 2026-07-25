# markitdown skill

**Status:** Approved
**Date:** 2026-07-25

## Context

The user asked to implement [microsoft/markitdown](https://github.com/microsoft/markitdown)
(MIT) as a global Claude Code skill — a Python tool + CLI that converts a wide
range of file types and URLs into Markdown, optimized for feeding content
into LLM context rather than for producing polished, editable output.

This machine already has `document-skills:pdf/docx/pptx/xlsx` installed
(Anthropic marketplace plugins) covering read/write/edit of Office and PDF
formats. `.wolf/cerebrum.md` carries a standing rule (2026-06-25): don't
install two skills covering the same concept — audit for overlap first.
markitdown's format coverage overlaps document-skills for PDF/DOCX/PPTX/XLSX,
but its actual job is different: fast, read-only extraction ("dump this into
Markdown for context"), not authoring, editing, or form-filling. The two
skills are scoped by *intent* rather than by file type, so the overlap is
addressed through disambiguating wording rather than by picking only one
skill.

Research into this repo's existing conventions (`html-export`,
`document-skills:pdf`) found:
- No existing skill wraps a pip-installed Python CLI. `pipx` is the
  established pattern for isolated Python CLIs on this machine (`open-webui`,
  `streamlit`, `watchdog` are all pipx-installed); bare `pip` isn't even on
  `PATH`.
- `html-export` needed a dedicated wrapper script (`scripts/html-export.js`)
  because Playwright itself has no CLI — the script supplies viewport,
  output-naming, and PDF-format logic that would otherwise not exist.
  markitdown ships its own complete CLI (`markitdown <path-or-url>` →
  Markdown on stdout) that already does everything this skill needs, so that
  precedent doesn't transfer here.
- `document-skills:pdf` documents its Python usage inline in `SKILL.md`
  (a "Quick Start" snippet) rather than via a wrapper script, which is the
  closer precedent for a tool that already has a clean invocation surface.

## Design

### Scope

Read-only conversion of local files and URLs to Markdown, for pulling content
into context. Not for creating, editing, or filling forms in documents — that
remains `document-skills`' job.

Covered inputs: PDF, Office docs (DOCX/PPTX/XLSX), images (metadata only, no
LLM captioning), audio (transcription, via the `[all]` extras), HTML, EPUB,
ZIP, Outlook `.msg`, plus web page URLs and YouTube links (markitdown fetches
and converts these natively).

### File layout

```
skills/markitdown/
└── SKILL.md
```

No `scripts/` directory and no wrapper script — the installed `markitdown`
CLI is invoked directly via the Bash tool. There is no per-invocation logic
(argument transformation, output-file naming, format-specific settings) that
would justify a script, unlike `html-export`.

### Frontmatter

```yaml
---
name: markitdown
description: Convert a file or URL to Markdown for quick, read-only viewing or pulling content into context — PDF, Office docs, images, audio, HTML, EPUB, ZIP, Outlook .msg, web pages, and YouTube links. Use for reading/extracting/summarizing content, not for creating, editing, or filling forms in documents (use document-skills:pdf/docx/pptx/xlsx for that).
---
```

The description leans on intent verbs ("viewing," "pulling into context")
to disambiguate from `document-skills`' "creating, editing, filling forms"
wording, so the common case resolves without an extra question to the user.
Both skills remain independently, explicitly invocable by name for the
uncommon case where intent is genuinely ambiguous.

### Install

```bash
pipx install 'markitdown[all]'
```

Full `[all]` extras (PDF, Office, images, HTML, EPUB, ZIP, audio
transcription via `openai-whisper`, Azure Document Intelligence support).
`SKILL.md` documents a verify-then-install pattern matching `html-export`:

```bash
markitdown --version   # verify
```

If this errors, run the install command above.

LLM-based image captioning (markitdown's optional feature that passes an
OpenAI client to describe image content) is explicitly **not** wired up —
images convert with basic metadata only. This keeps the skill's behavior
deterministic and avoids an `OPENAI_API_KEY` dependency. Documented in
`SKILL.md` as a known limitation, not silently omitted.

### Invocation

Direct CLI usage via the Bash tool, documented in `SKILL.md`:

```bash
markitdown path/to/file.pdf
markitdown https://example.com
markitdown https://youtube.com/watch?v=...
```

Output is Markdown on stdout only — read directly into context. Nothing is
written to disk unless the user separately asks to save it (in which case,
normal shell redirection: `markitdown file.pdf > file.md`).

### Error handling

No wrapper layer, so no custom error handling beyond the verify → fallback
install step above. markitdown's own CLI errors (unsupported format, fetch
failure, missing extra for a given format) surface to the user as-is.

## Verification

No unit-testable logic — this is a documentation-only skill (a `SKILL.md`
plus an external CLI dependency), not application code. Verification is
manual:
1. Run `pipx install 'markitdown[all]'` and confirm `markitdown --version`
   succeeds.
2. Convert one sample of each of: a local PDF, a local DOCX, a local image,
   and a web page URL — confirm each produces readable Markdown on stdout.
3. Confirm the skill's `description` triggers correctly by asking Claude to
   "summarize this PDF" (should route to markitdown, read-intent) versus
   "fill out this PDF form" (should route to `document-skills:pdf`,
   edit-intent) in a scratch conversation.

## Out of scope

- No LLM-based image captioning (no `OPENAI_API_KEY` wiring) — revisit only
  if a concrete need for image description arises.
- No wrapper script, output-file management, or batch-conversion helper —
  the bare CLI covers the stated use case; add only if a real gap surfaces
  in use.
- No changes to `document-skills:pdf/docx/pptx/xlsx` — this spec only adds
  disambiguating wording to the new skill's own description.
