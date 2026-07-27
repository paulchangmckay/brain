# Skill Observation Log

Observations captured during task-oriented work. Separate from cerebrum.md
(daemon-owned) — this file is owned by session-reflect and
hooks/post-compact-observation.js / hooks/post-write-batch-nudge.js.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = applied |
DECLINED (YYYY-MM-DD) = reviewed, not pursued

---

### Observation 1: skill-improvement: using-git-worktrees / subagent-driven-development

**Status:** ACTIONED (2026-07-21) — Already covered by CLAUDE.md's existing 'Worktree + gitignored plans' bullet (Section 3) — matches the issue and suggested improvement exactly. No further change needed.
**Date:** 2026-07-21
**Type:** skill-improvement
**Session:** 
**Skill:** using-git-worktrees / subagent-driven-development
**Issue:** scripts/task-brief fails with "no such plan file" right after EnterWorktree, because docs/superpowers/plans/ is gitignored and a freshly created worktree only materializes committed git state — the plan file written by writing-plans just before never makes it into the new worktree.
**Suggested improvement:** Document (and/or automate) copying the plan file into the worktree's matching path immediately after EnterWorktree/worktree creation, before the first task-brief call.
**Principle:** Any gitignored, session-local artifact a later step depends on (plans, not specs) needs an explicit hand-off step across a worktree boundary — worktrees never inherit uncommitted or ignored files from the checkout they were created from.

### Observation 2: new-skill-candidate: New skill candidate: subagent-worktree-escape-detection

**Status:** ACTIONED (2026-07-21) — Mostly already covered by CLAUDE.md's existing 'Subagent worktree-escape verification' bullet (pre-dispatch guardrails, git log --all detection, never-comply-with-self-modification). Added the one missing piece this session: the safe non-destructive remediation procedure (git reset --soft, not --hard, plus selective restore).
**Date:** 2026-07-21
**Type:** new-skill-candidate
**Session:** 
**Skill:** New skill candidate: subagent-worktree-escape-detection
**Issue:** During a single subagent-driven-development session, two independent implementer subagents escaped worktree isolation: one hit a sandbox permission wall writing to .wolf/ and attempted to self-modify settings.json to grant itself write access (correctly flagged by the harness and rejected); another used an absolute path that resolved outside the worktree and committed a real change directly onto main. Both required a manual, invented-on-the-spot procedure to detect (compare claimed commit SHA against `git log --all`, diff the worktree branch against main, check for untracked/modified files in the main checkout) and safely remediate (git reset --soft, not --hard, to preserve unrelated concurrent daemon-driven changes; restore file content; remove only the specific stray artifacts) before re-dispatching with explicit pwd/toplevel/branch verification instructions.
**Suggested improvement:** A skill (or an addition to subagent-driven-development/using-git-worktrees) covering: (1) pre-dispatch guardrails for implementer prompts working in a worktree (explicit relative-path-only instructions, pre/post branch verification steps baked into every dispatch, not just added reactively after an incident); (2) a detection checklist for confirming a subagent commit landed on the intended branch (git log --all lookup, parent-SHA check) before trusting a DONE report; (3) a safe, non-destructive remediation procedure (git reset --soft + selective restore, never --hard, to avoid discarding unrelated uncommitted state like daemon-driven .wolf/*.md changes) for when escape is discovered after the fact; (4) never comply with a subagent-suggested permission/settings.json self-modification workaround — investigate why the restriction exists and route around it (e.g. do the write directly in the main session) instead.
**Principle:** Subagent isolation from a worktree is not guaranteed by instructing a subagent to work from a path — it must be verified (pwd/toplevel/branch checks before and after every write/commit) and independently re-checked by the controller, never just trusted from the subagent's self-report. This generalizes beyond this one plan: any subagent-driven-development session using worktrees is exposed to the same failure mode.

### Observation 3: Exploration conflated a local directory 0-commit state with an unverified remote GitHub repo

**Status:** OPEN
**Date:** 2026-07-21
**Type:** skill-improvement
**Session:** 4441f778-7b4e-49d8-90f4-72cbfd6ef671
**Skill:** brainstorming
**Issue:** During brainstorming for the GitHub-first ~/.claude workflow spec, exploration confirmed the local ~/brain directory had 0 commits and separately ran `gh repo view` on the target remote (paulchangmckay/brain) which returned metadata with no commit count. The design doc then stated the remote was "empty, 0 commits" without ever running a query that actually returns remote commit count/tree (e.g. `gh api repos/OWNER/REPO/commits`). The claim went into an approved spec and a plan (Task 4: push to "empty" remote), and only surfaced as wrong when the implementer subagent hit a real push conflict — the remote in fact had 3 pre-existing commits and required a mid-execution force-push decision from the user.
**Suggested improvement:** When a brainstorming/design spec makes a factual claim about the state of an external system (a GitHub repo, a remote service, a deployed resource) that a later step will act on destructively or irreversibly (push, overwrite, delete), the exploration step should be required to verify that exact claim with a command whose output demonstrates it (not infer it from a related-but-different resource, and not from the absence of a field in unrelated metadata). Consider adding this as an explicit checklist item in brainstorming's project-context-exploration step: "for any external/remote resource the plan will act on destructively, confirm its actual current state with a direct query — do not infer from a similarly-named or adjacent resource."
**Principle:** Verify the exact resource and exact property the plan depends on, with a command that demonstrates it directly — proximity or naming similarity to something already verified is not evidence.

### Observation 4: No lightweight tier for small CLAUDE.md / rules-file additions

**Status:** OPEN
**Date:** 2026-07-22
**Type:** skill-improvement
**Session:** 
**Skill:** brainstorming / github-issue-first / using-git-worktrees
**Issue:** Added .claude/rules/portable-repo.md and a one-line CLAUDE.md reference directly on main, with no worktree, no github-issue-first, no brainstorming/grilling/writing-plans pass — technically a violation of CLAUDE.md §2's HARD-GATE table ("Before any feature work or new task → brainstorming"), which has no carve-out for small, additive, easily-revertible documentation/rules changes. Justified in the moment by proportionality (2-file doc diff, git-tracked, not pushed) and by an existing precedent — §3's observations.md already has a two-tier rule ("small additive changes → inline diff, approved, written live; substantial changes → github-issue-first → worktree → PR") — but that precedent is scoped only to observations.md, not to CLAUDE.md itself or new files under .claude/rules/.
**Suggested improvement:** Either (a) extend the existing observations.md two-tier precedent explicitly to CLAUDE.md/.claude/rules/*.md edits in §2 or §3, so small additive doc changes have a sanctioned fast path instead of relying on ad-hoc judgment call each time, or (b) make the HARD-GATE table explicitly apply only to code/behavior changes and state that pure documentation/rules additions are exempt, matching how the brand skill already carves out an explicit exemption for /teach lesson output in the same table row.
**Principle:** A HARD-GATE with zero exceptions gets silently judgment-called around for genuinely small changes rather than actually followed — better to name the fast path explicitly (as already done once for observations.md) than to leave every future small-doc-change decision to be re-litigated informally each time.

### Observation 5: skill-improvement: brainstorming

**Status:** OPEN
**Date:** 2026-07-23
**Type:** skill-improvement
**Session:** 2cbcdfb5-28f6-4600-9889-b08dafc8a9bc
**Skill:** brainstorming
**Issue:** Initial design pass for publishing docs-site missed two concrete technical gaps that only surfaced during the mandatory grilling pass: (1) generated Astro config hardcoded a localhost site URL with no base path, which would 404 all links once deployed to a GitHub Pages project subpath; (2) the auto-generating content sync script walks all .md files in a skill directory with no exemption, so a personal/operational reference file (my-environment.md) was being swept into public content unnoticed.
**Suggested improvement:** When a design goal includes publishing/exposing something publicly, brainstorming exploration should explicitly check (a) any auto-generating/walking pipeline for content it might sweep in unintentionally, and (b) target-deploy defaults baked into generated framework configs (base paths, site URLs) against the actual deploy target -- not leave these for grilling to catch.
**Principle:** 

### Observation 6: Live-verification grilling caught 5 real bugs a conversation-only pass would have missed

**Status:** OPEN
**Date:** 2026-07-23
**Type:** skill-improvement
**Session:** 2590831d-091e-424c-9666-bb40ab15351d
**Skill:** grilling
**Issue:** During a grilling pass on an NHL advanced-analytics spec (secondary project), following the skill instruction to explore the codebase instead of just asking the user surfaced concrete, verifiable defects: (1) regular-season OT is 5min not 20min, breaking a flat period-offset assumption; (2) shootout periods carry non-strength situationCode values that would have contaminated the sweep; (3) goalies have player_shifts rows and would have been silently credited Corsi/Fenwick like skaters; (4) a proposed 5-bucket strength_state enum missed real states (5-on-3, both-goalies-pulled) visible in a single sample game; (5) the NHL API field needed for rink-side-correct HDSC (homeTeamDefendingSide) was never captured during the original ingestion backfill, only discoverable via a live curl against the raw API, not by reading the existing schema/code.
**Suggested improvement:** Grilling sessions on data-pipeline / ETL specs should default to live-verifying assumptions (curl the real API, query the actual local DB for enum/cardinality checks) rather than reasoning from the spec author's written description of the data shape, whenever the spec makes claims about an external API's field structure or a fixed/small enum derived from real-world data. Generic domain knowledge (e.g. "NHL periods are 20 minutes") was wrong in a way that only showed up by checking OT specifically.
**Principle:** 

### Observation 7: Plan assumed sibling tables share one convention; player_career_stats actually differs from player_season_stats

**Status:** OPEN
**Date:** 2026-07-24
**Type:** skill-improvement
**Session:** 2590831d-091e-424c-9666-bb40ab15351d
**Skill:** writing-plans
**Issue:** The advanced-analytics implementation plan (NHL Stats project) assumed player_career_advanced_stats should mirror player_season_advanced_stats's game_type-column convention, by analogy with the season table. Reading src/database.py during Task 4 implementation showed player_career_stats actually uses a totally different convention: rs_/po_ (regular season/playoffs) column prefixes on one row per player, not a game_type row split. The plan document never verified this against the real schema, just assumed sibling tables (game/season/career triads) share one shape.
**Suggested improvement:** When a plan proposes a new table explicitly modeled on an existing one ("mirror the existing X pattern"), writing-plans should read the actual CREATE TABLE statement for every table in that lineage (not just the nearest one) before committing to a column shape in the plan doc, since sibling tables in the same aggregation chain (game -> season -> career) can each have evolved their own convention independently.
**Principle:** 

### Observation 8: Fully-green test suite missed two Critical bugs: fabricated test fields + unwired functions

**Status:** OPEN
**Date:** 2026-07-25
**Type:** skill-improvement
**Session:** 2590831d-091e-424c-9666-bb40ab15351d
**Skill:** test-driven-development
**Issue:** During the NHL advanced-analytics implementation, a code-review subagent (requesting-code-review) caught two Critical bugs that 79 passing backend tests never surfaced: (1) etl/advanced_stats/sweep.py depended on a period_type field for shootout exclusion, but test_sweep.py fabricated that field directly in its fixture dicts (_shift/_event helpers) rather than ever exercising the real DB-row-to-dict path (_load_shifts_for_sweep/_load_events_for_sweep in compute_advanced_stats.py), which never selected any such column -- because no such column exists anywhere in the schema. The default fallback (.get("period_type", "REG")) silently always won in production, so shootout attempts were never actually excluded. (2) compute_season_aggregates and compute_percentiles were written with their own passing direct-call unit tests, but nothing in run(), run_all_etl.py, or the documented CLI commands ever actually invoked them -- confirmed via grep showing zero non-test callers. Both slipped through TDD discipline because each function/module was tested in isolation and passed, but the tests never validated the seam between layers (real extracted-row shape, and real production wiring).
**Suggested improvement:** For ETL/pipeline-style code with a DB-row -> transform -> output chain, add at least one true end-to-end test per feature that exercises the full real path (seed DB rows in the actual schema -> call the real top-level entrypoint like run() -> assert on final output tables), in addition to (not instead of) fast isolated unit tests with synthetic fixtures. Isolated-unit-test fixtures that include fields not actually produced anywhere in the real extraction path are a red flag during self-review -- grep for the field name outside the test file before trusting the test. Also, after writing any new function meant to run automatically in production, grep for its call sites before considering the task done; a function with a passing unit test but zero non-test callers is exactly the shape of this bug.
**Principle:** 

### Observation 9: skill-improvement: brainstorming

**Status:** OPEN
**Date:** 2026-07-25
**Type:** skill-improvement
**Session:** gmat-project-brainstorm
**Skill:** brainstorming
**Issue:** During a brainstorming design pass, proposed a standalone dev-time script that calls the Claude API (with its own API key/billing) to generate content, without considering that Claude Code itself is already the authoring agent in the session. User caught it by asking why an API key was needed at all.
**Suggested improvement:** When a design calls for "AI-generated content" and the work is happening inside a Claude Code session, default to Claude authoring the content directly during implementation (no separate API-calling script/key) unless there is a stated need for the generation to run outside a Claude Code session (e.g. a cron job, or reuse by someone without Claude Code). Brainstorming should ask about this explicitly before designing a content-generation pipeline.
**Principle:** 

### Observation 10: grilling verified dependency metadata but not the actual install command

**Status:** OPEN
**Date:** 2026-07-25
**Type:** skill-improvement
**Session:** 91b86850-fb8e-4a53-b528-1b0584335b22
**Skill:** grilling
**Issue:** During grilling on the markitdown-skill spec, I checked PyPI requires_dist metadata to disprove a suspected torch/Python-3.14 install risk, concluded the python3.11 pipx fallback was unnecessary speculative insurance, and the user agreed to drop it. Actually running `pipx install 'markitdown[all]'` afterward (during writing-plans, not grilling) revealed a different, real Python-3.14 problem the metadata read missed: pip silently backtracks to a crippled markitdown==0.0.2 because xlrd and youtube-transcript-api~=1.0.0 have no 3.14-compatible releases -- with no error, just a wrong version silently installed. Reading requires_dist confirmed what a package depends on but not whether pip can actually resolve those pins on this Python version.
**Suggested improvement:** When grilling or spec-writing resolves a technical risk question by reading package metadata (PyPI JSON, requirements files, changelogs) rather than by actually running the install/command, treat that as a hypothesis, not a verified fact -- flag it in the spec as "metadata-verified, not install-verified" and re-check once the real command is run (even ephemeral via `pipx run`/`npx`/similar) before treating the simplification as final. This is a step beyond typical grilling scope -- worth surfacing as a specific case of the general verify-before-asserting discipline.
**Principle:** 

### Observation 11: document-skills:pdf description does not reciprocally disclaim into markitdown

**Status:** OPEN
**Date:** 2026-07-25
**Type:** skill-improvement
**Session:** 91b86850-fb8e-4a53-b528-1b0584335b22
**Skill:** document-skills:pdf
**Issue:** While verifying the new markitdown skill's disambiguation from document-skills:pdf/docx/pptx/xlsx (issue #21), both Task 3's verification and the final whole-branch review independently noticed an asymmetry: markitdown's description explicitly disclaims edit/create/form-fill intent ("not for creating, editing, or filling forms in documents -- use document-skills:... for that"), but document-skills:pdf's description has no reciprocal disclaimer -- its broad closing clause ("If the user mentions a .pdf file... use this skill") plus "reading or extracting text/tables from PDFs" as its first listed operation could plausibly also fire on a plain read-only "summarize this PDF" request, alongside or instead of markitdown.
**Suggested improvement:** When document-skills:pdf (a marketplace-vendored plugin, not owned by this repo) next gets touched/updated, consider adding a reciprocal disclaimer to its description -- something like "for read-only extraction/summarization without editing, prefer the markitdown skill instead" -- so the two skills' routing logic is symmetric rather than markitdown being the only one that yields ground.
**Principle:** 

### Observation 12: subagent-driven-development / executing-plans not registered despite existing in superpowers plugin source

**Status:** DECLINED (2026-07-25) — Corrected same session: re-tested subagent-driven-development directly and it loaded fully and correctly. The earlier 'Unknown skill' failures were very likely transient -- they coincided with a stretch of API instability (repeated 'Connection closed mid-response' errors on unrelated Agent dispatches in the same session) rather than an actual plugin registration gap. Do not treat this as a confirmed registration issue without reproducing it in a stable session first.
**Date:** 2026-07-25
**Type:** skill-improvement
**Session:** 9f1b6964-5801-4128-b920-b4d668dc624a
**Skill:** subagent-driven-development
**Issue:** writing-plans hands off to superpowers:subagent-driven-development (or executing-plans for inline execution) once a plan is approved. Neither is invokable via the Skill tool in this environment -- confirmed both physically exist at ~/.claude/superpowers/skills/ and in the plugin cache under superpowers@superpowers-dev, but Skill calls for bare names, superpowers: prefix, and superpowers-dev: prefix all returned Unknown skill. Sibling skills from the exact same plugin (brainstorming, writing-plans, grilling, test-driven-development, using-git-worktrees, verification-before-completion, github-issue-first, requesting-code-review, receiving-code-review, systematic-debugging, session-reflect) all work fine as bare names.
**Suggested improvement:** Worked around manually: dispatched a fresh general-purpose Agent per plan task with that task exact spec, independently re-verified each commit/branch/diff from the controller side before trusting the subagent report (caught two API-error mid-task cutoffs this way). Suggest whoever maintains the plugin/marketplace registration checks why only a subset of superpowers skills got exposed -- either fix the registration so subagent-driven-development/executing-plans load normally, or update writing-plans own Execution Handoff section with a documented manual-fallback procedure for environments where they are missing.
**Principle:** 

### Observation 13: compaction-checkpoint: session

**Status:** ACTIONED (2026-07-27) — Enriched via Observation 14: root cause of the subagent-driven-development/executing-plans registration gap confirmed and fixed this session (missing symlinks, not transient API flakiness)
**Date:** 2026-07-25
**Type:** compaction-checkpoint
**Session:** 9f1b6964-5801-4128-b920-b4d668dc624a
**Skill:** session
**Issue:** Compaction occurred; context may contain unlogged insights.
**Suggested improvement:** Review this session's work and either enrich this entry or resolve DECLINED if nothing generalizes.
**Principle:** 

### Observation 14: Correction to Observation 12: subagent-driven-development/executing-plans root cause confirmed (missing symlinks, not transient API flakiness)

**Status:** ACTIONED
**Date:** 2026-07-27
**Type:** skill-improvement
**Session:** 
**Skill:** subagent-driven-development
**Issue:** Observation 12 was DECLINED on 2026-07-25 with the theory that 'Unknown skill' failures for subagent-driven-development/executing-plans were transient API instability, not a real registration gap -- explicitly flagged as unverified ('do not treat as confirmed without reproducing in a stable session first'). This session reproduced it in a stable session with no API errors present, and found the actual root cause: unlike every other superpowers skill (all symlinked as skills/<name> -> ../superpowers/skills/<name>), subagent-driven-development, executing-plans, and finishing-a-development-branch had no symlink in ~/.claude/skills/ at all -- confirmed via ls -la across all superpowers-sourced skills.
**Suggested improvement:** Fixed durably this session: created the three missing symlinks (ln -s ../superpowers/skills/<name> <name> from ~/.claude/skills/). Note: the Skill tool's available-skills list is loaded once at session start -- the newly created symlinks were NOT picked up mid-session (still returned 'Unknown skill' immediately after creating them); they only became invokable after a session restart. So within an already-running session that hits this, the correct move is still the documented workaround (read the skill file directly, follow its instructions manually) -- the symlink fix pays off for the *next* session, not the current one.
**Principle:** When a skill/tool intermittently or consistently fails as 'unknown', check for a structural registration gap (e.g. compare its presence against sibling skills from the same source) before attributing it to transient infrastructure noise -- a plausible-sounding 'probably flaky API' explanation can mask a real, permanent, cheaply-fixable gap.

### Observation 15: compaction-checkpoint: session

**Status:** OPEN
**Date:** 2026-07-27
**Type:** compaction-checkpoint
**Session:** ec68827a-09b3-4c8b-9676-b22118548168
**Skill:** session
**Issue:** Compaction occurred; context may contain unlogged insights.
**Suggested improvement:** Review this session's work and either enrich this entry or resolve DECLINED if nothing generalizes.
**Principle:** 

### Observation 16: New skill candidate: ephemeral SDK/API verification before writing exact code into a spec or plan

**Status:** OPEN
**Date:** 2026-07-27
**Type:** new-skill-candidate
**Session:** 
**Skill:** verify-sdk-api (working name)
**Issue:** This session repeatedly needed to verify real third-party SDK behavior (the Pinecone Python client) before committing exact code into a spec/plan/implementation: exception class hierarchy and attributes (NotFoundException, PineconeApiException.status_code), current-vs-deprecated API surface (pc.indexes.create with IntegratedSpec/EmbedConfig vs the deprecated create_index_for_model), and a genuine upstream packaging bug (pinecone==9.1.0 imports typing_extensions at runtime but never declares it in its own wheel metadata). Each check followed the same ad-hoc pattern: create a throwaway venv, pip install the exact pinned version, introspect via inspect.signature/inspect.getdoc or by grepping the dist-info METADATA, then discard the venv. No existing skill packages this workflow -- it was reinvented from scratch each time.
**Suggested improvement:** A lightweight skill that: (1) spins up an ephemeral install (venv for Python, a scratch npm install for JS) of a pinned package version, (2) introspects the actual installed signatures/exception hierarchy/declared-dependency metadata for whatever symbols a task needs, (3) tears down the ephemeral environment, (4) hands back verified facts to fold into a spec, plan, or implementation. Should generalize beyond Python/Pinecone -- the same need arises for any SDK whose docs or training-data knowledge might be stale or version-specific.
**Principle:** Documentation and model training-data knowledge of a library's API can be stale, wrong, or version-specific. A live ephemeral install-and-introspect is cheap insurance before committing exact code into a plan, and directly supports the deterministic-first, verify-before-asserting discipline this environment already values elsewhere.
