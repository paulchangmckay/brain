# Publish the docs-site publicly via GitHub Pages

**Date:** 2026-07-21
**Status:** Draft (pending user review + grilling)

## Summary

The `docs-site/` Blume site (built in [2026-07-15-blume-docs-site-design.md](2026-07-15-blume-docs-site-design.md)) was explicitly designed to stay local and unpublished — no remote existed on this repo at the time. The repo now has a public GitHub remote (`github.com/paulchangmckay/brain`) with branch protection on `main`. This spec reverses that anti-goal: audit the existing content for public safety, expand it into a real architecture explainer, polish it visually, and publish it via GitHub Pages with an auto-deploy workflow — so a visitor to the GitHub repo gets a UI/UX that explains the `~/.claude` "thin harness, fat skills" architecture rather than just a file tree.

## Goals

- Every page under `docs-site/content/` is safe for a public, non-technical-about-Paul audience: no real excerpts from `.wolf/` runtime files (cerebrum.md, memory.md, buglog.json), no personal identifying info beyond what's already exposed by the public repo itself, no content written in a private/internal tone.
- The 7 `content/overview/*.md` stub pages are expanded from CLAUDE.md-mirroring bullet lists into real explanatory prose aimed at a technical stranger evaluating the repo.
- A new architecture diagram, authored as native Mermaid syntax directly in the landing/overview markdown (using Blume's existing built-in Mermaid rendering — already wired up in `.blume/astro.config.mjs`'s `vite.optimizeDeps`), showing how skills, hooks, OpenWolf (`.wolf/`), Agents, and submodules relate. This becomes the site's landing/hero content.
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
- **Not** a rename of the `brain` repo, and not a separate `paulchangmckay.github.io` repo. The site publishes as a GitHub Pages *project site* at the `/brain/` subpath — accepted explicitly, not treated as a defect to engineer around.
- **Not** a standalone HTML+SVG diagram via the `architecture-diagram`/`brand` skill pipeline. Reconsidered during grilling: that skill's output format (self-contained HTML file) doesn't fit inline page content, and Blume already has dedicated Mermaid tooling. Native Mermaid is used instead — see Goals.

## Architecture

### Phases (sequential, each independently reviewable)

1. **Content safety audit** — read every file in `docs-site/content/` plus `docs-site/scripts/pull-skills.mjs` against the safety criteria above; fix issues inline (rewrite/redact/remove). Spot-check auto-generated skill pages rather than reading all 31 — but the sample is *targeted*, not random: prioritize skills most likely to carry personal/environmental content (`claude-infra-reference`, `model-routing`, `wolf-init`, `session-reflect`, and any skill with its own `references/`/nested-file subtree, since that's exactly the shape of the `my-environment.md` finding below). Random/light sampling already proved insufficient during this spec's own grilling pass. If a spot-check turns up a real problem in a *source* file (SKILL.md or a reference file), fix it there too, in scope — not deferred to a separate follow-up.
   - **Known finding, already confirmed during grilling:** `skills/senior-engineering-partner/references/my-environment.md` contains real personal/operational details (secrets-management approach, connected MCP servers, machine specifics) and is currently swept into the public site by `pull-skills.mjs`'s directory walk (it has no `SKILL.md` exemption — the walk picks up every `.md` file in a skill's tree). Add it to the sync script's existing filename denylist (same mechanism already used for `CONTRIBUTING.md` etc.) as a required fix in this phase.
   - Redactions to *auto-generated* content must happen at the source file or via the sync script's denylist — never by hand-editing generated output under `docs-site/content/skills/`, since `npm run sync` runs on every `predev`/`prebuild` and would silently regenerate and undo a hand-edit.
   - Produces a "safe to make public" site, not a findings list.
2. **Content expansion** — rewrite the 7 `content/overview/*.md` stubs into real prose: what problem the thin-harness/fat-skills model solves, why skills gate through brainstorm → grill → plan → TDD, how OpenWolf's memory layers (anatomy/cerebrum/memory/buglog) fit together. New prose written in this phase follows the same generic-description-only rule from the safety audit (no real `.wolf/` excerpts) — the rule isn't just retrospective cleanup, it constrains what gets written here too. Add one new architecture diagram as native Mermaid syntax (see Goals) in the landing page.
3. **Visual polish** — theme/typography/nav pass within Blume's existing Tailwind config; landing page restructured to lead with the diagram. Scope stops at what Blume's theming supports natively — a need to fight the framework is a signal to cut scope, not eject from Blume.
4. **Root README** — new `README.md` at repo root: a couple paragraphs on what the repo is, a prominent link to the published docs site (`https://paulchangmckay.github.io/brain/`). Checked against `.claude/rules/portable-repo.md` (no hardcoded local paths) before commit. Note: this link references phase 5's output before phase 5 lands — if phases merge as separate PRs, the link may briefly 404 until Pages is live. Accepted as low-stakes for a personal repo, not a blocker.
5. **Publish pipeline** — new `.github/workflows/deploy-docs.yml`: on push to `main` (path-filtered to `docs-site/**` and the workflow file), install deps → run existing `npm run sync` → `npm run build` → deploy via `actions/deploy-pages`. Before this can work, `blume.config.ts` (or whatever mechanism Blume exposes for it — confirmed during implementation, not guessed here) must set the site's base path so the deployed build resolves at `/brain/` rather than the currently-hardcoded `http://localhost:4321` root — otherwise internal links/assets 404 once live even though local `dev`/`build` look fine. This is a required part of this phase, not a follow-up. User must set Settings → Pages → Source: GitHub Actions once; this is called out explicitly at that point in implementation, not assumed done.

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
