# Publish the docs-site publicly via GitHub Pages

**Date:** 2026-07-21
**Status:** Draft (pending user review + grilling)

## Summary

The `docs-site/` Blume site (built in [2026-07-15-blume-docs-site-design.md](2026-07-15-blume-docs-site-design.md)) was explicitly designed to stay local and unpublished — no remote existed on this repo at the time. The repo now has a public GitHub remote (`github.com/paulchangmckay/brain`) with branch protection on `main`. This spec reverses that anti-goal: audit the existing content for public safety, expand it into a real architecture explainer, polish it visually, and publish it via GitHub Pages with an auto-deploy workflow — so a visitor to the GitHub repo gets a UI/UX that explains the `~/.claude` "thin harness, fat skills" architecture rather than just a file tree.

## Goals

- Every page under `docs-site/content/` is safe for a public, non-technical-about-Paul audience: no real excerpts from `.wolf/` runtime files (cerebrum.md, memory.md, buglog.json), no personal identifying info beyond what's already exposed by the public repo itself, no content written in a private/internal tone.
- The 7 `content/overview/*.md` stub pages are expanded from CLAUDE.md-mirroring bullet lists into real explanatory prose aimed at a technical stranger evaluating the repo.
- A new architecture diagram (via the repo's own `architecture-diagram` skill, which gates through `brand`) shows how skills, hooks, OpenWolf (`.wolf/`), Agents, and submodules relate — this becomes the site's landing/hero content.
- Visual polish within Blume's existing Tailwind-based theming: cohesive palette/typography, a clear top-level nav (Overview / Architecture / Skills / OpenWolf), landing page leads with the diagram.
- A short root `README.md` (currently absent) that briefly introduces the repo and links to the published site as "start here."
- A GitHub Actions workflow that builds and deploys `docs-site/` to GitHub Pages automatically on push to `main` (scoped to `docs-site/**` and the workflow file, to avoid rebuilding on unrelated commits).
- Auto-generated skill pages (31, via the existing `pull-skills.mjs` sync script) stay auto-generated — no hand-editing individual skill pages as part of this work.

## Anti-goals

- **Not** a site-generator swap. Blume stays; this is a content/polish/publish pass on the existing pipeline, not a rebuild on Starlight/Docusaurus/etc.
- **Not** a diagram-first/interactive-explorer redesign (the `understand-anything`-style drill-down UI). Considered and explicitly rejected in favor of the lower-risk, already-working page-based site.
- **Not** a blanket redaction pass over the whole repo — the safety audit is scoped to `docs-site/content/` and the new README, not a re-audit of every SKILL.md or `.wolf/` file in place (those are covered by the existing gitleaks/portable-repo gates).
- **Not** hand-quoting real `.wolf/` excerpts even when "harmless" — described generically or with synthetic examples only, per explicit user decision (no case-by-case judgment calls here).
- **Not** wiring the root `package.json` (`dotclaude-hooks-lint`) into the docs build — `docs-site/` keeps its own independent toolchain, unchanged from the original design.
- **Not** a custom domain. Publishes at the default `github.io` URL — no DNS/CNAME setup in this pass.
- **Not** deep content on the vendored submodules (`superpowers`, `langsmith-plugin`, `senior-engineering-partner`) beyond acknowledging them as dependencies/credits in the architecture narrative — no deep-dive pages on their internals.
- **Not** enabling GitHub Pages itself — that's a one-time repo Settings change only the user can make; this work prepares everything needed but the user flips the switch.

## Architecture

### Phases (sequential, each independently reviewable)

1. **Content safety audit** — read every file in `docs-site/content/` plus `docs-site/scripts/pull-skills.mjs` against the safety criteria above; fix issues inline (rewrite/redact/remove). Spot-check a sample of auto-generated skill pages rather than auditing all 31 (any issue there is a SKILL.md issue, not a docs-site issue). Produces a "safe to make public" site, not a findings list.
2. **Content expansion** — rewrite the 7 `content/overview/*.md` stubs into real prose: what problem the thin-harness/fat-skills model solves, why skills gate through brainstorm → grill → plan → TDD, how OpenWolf's memory layers (anatomy/cerebrum/memory/buglog) fit together. New prose written in this phase follows the same generic-description-only rule from the safety audit (no real `.wolf/` excerpts) — the rule isn't just retrospective cleanup, it constrains what gets written here too. Add one new architecture diagram via the `architecture-diagram` skill (which internally gates through `brand`).
3. **Visual polish** — theme/typography/nav pass within Blume's existing Tailwind config; landing page restructured to lead with the diagram. Scope stops at what Blume's theming supports natively — a need to fight the framework is a signal to cut scope, not eject from Blume.
4. **Root README** — new `README.md` at repo root: a couple paragraphs on what the repo is, a prominent link to the published docs site. Checked against `.claude/rules/portable-repo.md` (no hardcoded local paths) before commit.
5. **Publish pipeline** — new `.github/workflows/deploy-docs.yml`: on push to `main` (path-filtered to `docs-site/**` and the workflow file), install deps → run existing `npm run sync` → `npm run build` → deploy via `actions/deploy-pages`. User must set Settings → Pages → Source: GitHub Actions once; this is called out explicitly at that point in implementation, not assumed done.

### Directory/file touchpoints

```
~/.claude/
  README.md                          # new, phase 4
  .github/
    workflows/
      deploy-docs.yml                # new, phase 5
  docs-site/
    content/
      overview/*.md                   # rewritten, phases 1 & 2
      skills/**/*.md                    # audited (spot-check), untouched otherwise
      index.md / architecture diagram    # new hero content, phase 2
    blume.config.ts                      # theme/nav tweaks, phase 3
```

## Testing / verification

- Phases 1–4: `npm run dev` inside `docs-site/`, review in-browser (nav, diagram rendering, new prose, no broken internal links); `npm run build` succeeds locally with no errors.
- Phase 5: after the workflow is added and the user has enabled Pages (Source: GitHub Actions), confirm the Actions run succeeds and the live `github.io` URL actually serves the site — not just that the YAML is well-formed. This is the real completion gate for the whole project, since "the workflow file looks right" is not evidence it works.
- Each phase is verified and confirmed before moving to the next, per `verification-before-completion` — no phase is marked done on the basis of the diff looking plausible.
