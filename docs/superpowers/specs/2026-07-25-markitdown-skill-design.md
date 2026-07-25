# markitdown skill

**Status:** Approved, grilled
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

Verified against actual PyPI metadata during grilling (not assumed): the
`[all]` extra pulls in PDF/Office/Azure/YouTube-transcript deps plus
`speechrecognition` + `pydub` for audio — **not** `openai-whisper`/`torch`.
There is therefore no Python-3.14 compatibility risk from `[all]` (this
machine's only `PATH` Python is 3.14.5); an earlier draft of this spec
assumed a torch dependency and a python3.11 pipx fallback for it, both
dropped as unnecessary once the real dependency tree was checked.

The one real environment gap: `pydub` needs `ffmpeg` to decode non-WAV
audio, and `ffmpeg` isn't currently installed on this machine. Install
order:

```bash
brew install ffmpeg
pipx install 'markitdown[all]'
```

If `pipx install` still fails after that, surface the actual error rather
than guessing at a workaround — no speculative fallback for a problem not
observed in practice.

`SKILL.md` documents a verify-then-install pattern matching `html-export`:

```bash
markitdown --version   # verify
```

If this errors, run the two install commands above.

**Known limitations, documented in `SKILL.md`:**
- LLM-based image captioning (markitdown's optional feature that passes an
  OpenAI client to describe image content) is explicitly **not** wired
  up — images convert with basic metadata only. Keeps behavior
  deterministic and avoids an `OPENAI_API_KEY` dependency.
- Audio transcription (`speechrecognition`'s default backend) calls
  Google's free web Speech API — it requires internet access and is
  subject to Google's rate limits. It is **not** a fully offline/local
  transcription path, despite the rest of the skill's format support
  being offline.

### Invocation

Direct CLI usage via the Bash tool, documented in `SKILL.md`:

```bash
markitdown path/to/file.pdf
markitdown https://example.com
markitdown https://youtube.com/watch?v=...
```

**Single file, read into context:** output is Markdown on stdout, read
directly — the default case, nothing written to disk.

**Save to a file:** normal shell redirection —
`markitdown file.pdf > file.md`.

**Batch-convert a folder** (a real use case surfaced during grilling: the
user has folders of large PDFs they want converted to `.md` files on disk,
not piped into context every time): documented as a shell loop pattern in
`SKILL.md`, no wrapper script —

```bash
for f in *.pdf; do markitdown "$f" > "${f%.pdf}.md"; done
```

Errors from an individual file do **not** stop the batch — a plain `for`
loop already continues past a failed `markitdown` call by default (no
`set -e`), so one corrupted/unsupported file just produces an empty or
partial `.md` rather than aborting the rest of the folder. `SKILL.md` notes
reviewing stderr/empty outputs afterward.

### Error handling

No wrapper layer, so no custom error handling beyond the verify → install
step above. markitdown's own CLI errors (unsupported format, fetch
failure, missing extra for a given format) surface to the user as-is; in a
batch loop they're per-file and non-fatal, per the batch pattern above.

## Verification

No unit-testable logic — this is a documentation-only skill (a `SKILL.md`
plus an external CLI dependency), not application code. Verification is
manual:
1. `brew install ffmpeg`, then `pipx install 'markitdown[all]'`, confirm
   `markitdown --version` succeeds.
2. Convert one sample of each of: a local PDF, a local DOCX, a local image,
   and a web page URL — confirm each produces readable Markdown on stdout.
3. Run the batch-loop pattern over a folder with at least one large PDF and
   one intentionally-broken/unsupported file — confirm valid files produce
   correct sibling `.md` files and the broken file doesn't halt the loop.
4. Confirm the skill's `description` triggers correctly by asking Claude to
   "summarize this PDF" (should route to markitdown, read-intent) versus
   "fill out this PDF form" (should route to `document-skills:pdf`,
   edit-intent) in a scratch conversation.

## Out of scope

- No LLM-based image captioning (no `OPENAI_API_KEY` wiring) — revisit only
  if a concrete need for image description arises.
- No dedicated batch script — the shell-loop pattern documented in
  `SKILL.md` covers the folder-of-PDFs use case without a file to maintain;
  add a real script only if the one-liner proves insufficient in practice.
- No changes to `document-skills:pdf/docx/pptx/xlsx` — this spec only adds
  disambiguating wording to the new skill's own description.
- No offline/local audio transcription — `speechrecognition`'s default
  backend requires internet access to Google's free API; switching to a
  local model (e.g. `openai-whisper`) is a separate, heavier decision not
  taken here.
