# Skill-Writing Checklist (delta only)

This repo's mature skills (e.g. `senior-engineering-partner`) already
follow Progressive Disclosure: frontmatter, <500-line body, `references/`
for detail. Don't re-derive that from scratch — check the two things
below, which are easy to get wrong even when the general shape is right.

## 1. Write descriptions "pushy," not neutral

A skill's `description` is its only trigger mechanism — Claude is
conservative about invoking skills, so a neutral description
under-triggers.

**Weak:** "Handles PDF processing."
**Strong:** "Reads PDFs, extracts text/tables, merges, splits, rotates,
watermarks, encrypts, OCRs. Use whenever a `.pdf` file is mentioned or a
PDF output is requested."

State both what the skill does *and* the concrete situations that should
trigger it — and, where a neighboring skill could plausibly also match,
say what distinguishes them (see `markitdown`'s description for a real
example: it explicitly contrasts "viewing/extracting" against
`document-skills`' "creating/editing/filling forms").

## 2. Size-budget checklist

Before finishing a generated skill, check:

- [ ] Frontmatter has both `name` and `description`; if `description`
      contains a colon-space (`: `), it's quoted (unquoted breaks YAML
      parsing — see `claude-infra-reference`'s Custom Plugin Registration
      note)
- [ ] Body is under ~500 lines. If it's close, move detail to
      `references/`, not padding down
- [ ] Any `references/` file over ~300 lines gets a table of contents at
      the top
- [ ] Domain- or framework-specific variants live as separate files
      under `references/` (e.g. `aws.md`/`gcp.md`/`azure.md`), not as
      branches inside one large file — so an invocation only loads the
      branch it needs
- [ ] No invented example content presented as if it were real (a
      generated skill's worked examples should be clearly labeled as
      examples, not implied to be actual prior runs)
