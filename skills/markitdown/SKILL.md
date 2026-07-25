---
name: markitdown
description: Convert a file or URL to Markdown for quick, read-only viewing or pulling content into context — PDF, Office docs, images, audio, HTML, EPUB, ZIP, Outlook .msg, web pages, and YouTube links. Use for reading/extracting/summarizing content, not for creating, editing, or filling forms in documents (use document-skills:pdf/docx/pptx/xlsx for that).
---

# markitdown Skill — Convert Files & URLs to Markdown

Wraps the [microsoft/markitdown](https://github.com/microsoft/markitdown) CLI
(MIT) for fast, read-only conversion of files and URLs to Markdown — for
pulling content into context, not for authoring or editing documents.

## When to Use

- "Summarize this PDF/DOCX/PPTX" — read-intent, use this skill
- "What's in this audio file / image / HTML page?"
- "Convert this folder of PDFs to Markdown files"
- "Pull the transcript from this YouTube video"
- **NOT** for "fill out this PDF form", "create a DOCX report", "edit this
  spreadsheet" — those go to `document-skills:pdf/docx/pptx/xlsx` instead.
  Same file type can go either way; the verb decides which skill.

## Step 1: Verify / Install

```bash
markitdown --version
```

Expected: `markitdown 0.1.6` (or newer). If this errors, **or** prints an
unexpectedly old version (`0.0.x`), (re)install:

```bash
brew install ffmpeg
pipx install --python python3.11 'markitdown[all]'
```

**Do not drop `--python python3.11`.** On this machine's default Python
(3.14), `pipx install 'markitdown[all]'` does not error — it silently
backtracks to a crippled `markitdown==0.0.2`, because two of the `[all]`
extras (`xlrd`, `youtube-transcript-api~=1.0.0`) have no Python-3.14-
compatible release. Always re-run `markitdown --version` after installing
to confirm you got the real version, not just that the command exited 0.

`ffmpeg` is required by the audio-transcription extra (`pydub` needs it to
decode non-WAV audio).

## Step 2: Convert a Single File or URL

```bash
markitdown path/to/file.pdf
markitdown https://example.com
markitdown "https://youtube.com/watch?v=VIDEO_ID"
```

Output is Markdown on stdout — read directly into context. This is the
default case; nothing is written to disk. (The bare CLI accepting URLs and
YouTube links isn't documented in `markitdown --help`, but is confirmed
working behavior — it detects the `http(s)://` scheme and fetches
automatically.)

## Step 3: Save to a File

```bash
markitdown file.pdf > file.md
```

Normal shell redirection — use when the user wants a persistent `.md` file
on disk, not just content read into context.

## Step 4: Batch-Convert a Folder

```bash
for f in *.pdf; do markitdown "$f" > "${f%.pdf}.md" 2>"${f%.pdf}.err"; done
```

Swap `*.pdf` for whatever extension(s) the folder actually contains. A
failed conversion does **not** stop the loop — a plain `for` loop (no
`set -e`) continues to the next file. Every file gets a `.err` sibling
(empty for a successful conversion, a traceback for a failed one) since
the redirect applies unconditionally; only a failed file also leaves an
empty `.md`. After the loop, check for failures:

```bash
find . -maxdepth 1 -name '*.md' -empty
```

Any file listed there failed to convert — check its matching `.err` file
for the reason. Clean up the `.err` files once reviewed
(`rm -f *.err`) — they're a debugging aid, not part of the deliverable.

## Known Limitations

- **No LLM image captioning.** Images convert with basic embedded metadata
  only (EXIF, etc.) — no description of image *content*. This keeps output
  deterministic and avoids requiring an `OPENAI_API_KEY`. A blank or
  near-empty result for an image with no metadata is expected, not a bug.
- **Audio transcription needs internet access.** It uses
  `speechrecognition`'s default backend (Google's free web Speech API) —
  not a local/offline model. Subject to Google's rate limits.

## Overlap with document-skills

For PDF/DOCX/PPTX/XLSX, this skill and `document-skills:pdf/docx/pptx/xlsx`
both technically apply — pick based on intent, not file type:
reading/extracting/summarizing → this skill; creating, editing, or filling
forms → `document-skills`.
