# Bucket B Consolidation — Design

## Context

Follow-up to the `/bloat-audit` run and the Bucket A cleanup (PR #58,
issue #53). That audit triaged 13 findings into three buckets: Bucket A
(true bloat, deleted outright, already merged), Bucket B (real duplicated
value — consolidate, don't delete), and Bucket C (needs a call, not a
clean delete).

This spec covers Bucket B: three independent, small consolidations. User's
explicit instruction going in: "Don't just delete code, optimize how this
all works without creating more bloat" — so each item below was
re-verified against the actual code before designing anything, not taken
at face value from the original audit's summary. Two of the three original
audit estimates turned out to be overstated once checked directly (same
failure mode as the `detectFixPattern()` false-positive from Bucket A) —
this spec reflects the corrected, narrower scope, not the original
estimate.

## Scope

Three components, no shared architecture between them:

1. `scripts/hook-input.js` — dedup `readStdin()` + `SAFE_NAME`
2. `skills/shared-references/anti-slop-tells.md` — narrow anti-slop overlap
3. `hooks/post-compact-anatomy.sh` — replace hand-rolled JSON escaping

Out of scope (deferred, per the earlier B/C review): Bucket C items
(`gpt-taste`/`image-to-code` skill registration, `context-mode/sessions/`
disk housekeeping) — not part of this spec.

## Component 1: `scripts/hook-input.js`

### Problem

`readStdin()` — an identical 6-line `readFileSync(0, 'utf8')` wrapped in
try/catch — is copy-pasted into 13 files: `hooks/cerebrum-write-guard.js`,
`hooks/cerebrum-write-guard-post.js`, `hooks/openwolf-cron-gate.js`,
`hooks/post-skill-record.js`, `hooks/post-compact-observation.js`,
`hooks/prune-token-ledger.js`, `hooks/pre-principles-injection.js`,
`hooks/post-write-batch-nudge.js`, `hooks/pre-skill-gate.js`,
`hooks/subagent-thin-harness.js`, `hooks/worktree-path-guard.js`,
`hooks/worktree-repo-guard.js`, and `scripts/wolf-observation-log.js`.
Verified byte-identical across all 13 by direct grep + read, not assumed
from the earlier audit pass.

`SAFE_NAME = /^[A-Za-z0-9._-]+$/` — the identifier-sanitization regex used
before building a filesystem path from a harness-supplied `session_id` or
skill name — is duplicated in 6 of those same files
(`cerebrum-write-guard.js`, `cerebrum-write-guard-post.js`,
`post-skill-record.js`, `pre-skill-gate.js`, `post-compact-observation.js`,
`post-write-batch-nudge.js`). Verified identical usage pattern
(`SAFE_NAME.test(identifier)` as a guard before path construction) in all
6, not just identical text.

### What does NOT get extracted, and why

The original audit estimate (~175 lines) assumed the JSON-parse-and-fail
logic immediately following `readStdin()` could also be merged into a
shared `readHookInput()` helper. Checked this directly and it's false:
behavior after the read genuinely differs by caller —

- Most hooks: `try { input = JSON.parse(readStdin() || '{}'); } catch (_) { process.exit(0); }` (silent no-op on bad input)
- `scripts/wolf-observation-log.js`: `const raw = readStdin(); const payload = JSON.parse(raw);` — no fallback, no local try/catch (the CLI's outer handler reports to stderr and exits 1)
- `hooks/openwolf-cron-gate.js`: calls `readStdin()` without an immediate parse at all

Forcing these into one shared function would mean either adding
configuration flags to control exit-vs-throw behavior (the exact kind of
over-parameterized abstraction this whole cleanup is trying to remove) or
silently changing behavior for some callers. Neither is worth it for code
that's otherwise fine. Each file keeps its own parse-and-handle logic
untouched.

### Design

**Location — `scripts/hook-input.js`, not `hooks/lib/`.** Checked existing
cross-directory import precedent before assuming `hooks/lib/`: two hooks
(`post-compact-observation.js`, `post-write-batch-nudge.js`) already import
from `../scripts/wolf-observation-log.js`. The established direction in
this repo is hooks depending on scripts, not the reverse. Putting the new
file in `hooks/lib/` would have created a dependency running the other way
(`scripts/wolf-observation-log.js` → `hooks/lib/`), so the two directories
would end up depending on each other in different files. `scripts/hook-input.js`
matches the existing direction exactly: the 12 hook files add one more
`../scripts/` import, and `scripts/wolf-observation-log.js`'s import
becomes same-directory (`./hook-input.js`), no cross-directory dependency
at all for that file. Still gets a paired `scripts/hook-input.test.js`,
matching `scripts/`'s own existing convention (`plugin-health-check.js` +
`.test.js`, `setup-branch-protection.sh` + `.test.js`).

```js
// scripts/hook-input.js
import { readFileSync } from 'node:fs';

export function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

export const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
```

`scripts/hook-input.test.js` covers: `readStdin()` returns file content
when fd 0 is readable, returns `''` on read failure (e.g. no stdin
attached); `SAFE_NAME` matches valid identifiers and rejects path
traversal attempts (`../`, `/`, null bytes, empty string).

Each of the 12 hook call sites drops its local `function readStdin() {...}`
definition and adds `import { readStdin } from '../scripts/hook-input.js';`.
`scripts/wolf-observation-log.js` adds `import { readStdin } from './hook-input.js';`.
The 6 files using `SAFE_NAME` add it to the same
import line. No other line in any of the 13 files changes.

### Expected impact

~65-70 lines removed (13 × 6-line duplicate block, minus 13 one-line
imports; `SAFE_NAME` consolidation saves near-zero lines directly but
removes a real single-source-of-truth gap for a security-relevant
constant — a future tightening of the regex only needs to happen once).

## Component 2: `skills/shared-references/anti-slop-tells.md`

### Problem

The original audit flagged `design-taste-frontend/SKILL.md` (Section 4,
"Design Engineering Directives") and `redesign-existing-projects/SKILL.md`
(the whole "Design Audit" section) as ~150 lines of duplicated anti-slop
content. Read both in full and this overstates it: Section 4 is tightly
coupled to `design-taste-frontend`'s own `DESIGN_VARIANCE` /
`MOTION_INTENSITY` / `VISUAL_DENSITY` dial system, with exact Tailwind
classes, hex codes, and override conditions specific to *generating* a new
page. `redesign-existing-projects`'s checklist is deliberately simpler —
one-line problem/fix pairs suited to auditing an existing, unknown stack.
These are different jobs wearing similar-sounding headings, not the same
content twice.

The real duplication is narrower than the original audit implied, and —
verified directly, bullet by bullet, not assumed from the earlier pass —
it is *not* contained in one section. It's scattered across four separate
subsections of `design-taste-frontend/SKILL.md`: **3.E** (`min-h-[100dvh]`
over `h-screen`, CSS Grid over flexbox percentage math), **4.2** (max one
accent color / sub-80% saturation, the purple/blue "AI gradient" ban),
**4.4** (shadow tinted to background hue), and **9.A-9.D** ("AI Tells" —
pure-`#000000` ban, Inter-avoidance, the 3-column-card-row ban, generic
names, fake-precision numbers, placeholder brand names, copywriting
clichés). Confirmed genuine copy-paste-level overlap, not just similar
taste, by finding *identical concrete examples* in both files: the same
fake percentages (`99.99%`, `47.2%`), the same invented brand names
(`Acme`, `Nexus`, `SmartFlow`), the same copywriting-cliché list
(Elevate/Seamless/Unleash/Next-Gen), and matching phrasing on the
`100dvh`/CSS-Grid rules.

Two of these bullets are not clean one-liners: the purple/blue-gradient
ban (4.2, "THE LILA RULE") and the Inter-avoidance rule (9.B) each carry
an extra "Override:" clause tied to `design-taste-frontend`'s own dial
system ("acceptable when the brief explicitly asks for purple...",
"acceptable when the brief calls for a neutral/standard/Linear-style
feel..."). Only the base ban moves to the shared file for these two —
the override clause stays local, now reading as an addition on top of the
shared pointer rather than a self-contained paragraph.

### Design decision: shared location, not one-skill-owns-it

Considered nesting the shared file inside one skill's existing
`references/` directory (precedent: `senior-engineering-partner/references/`,
`agent-team-architect/references/` — though both of those are read only by
their own skill, no existing precedent for cross-skill reference reads).
Rejected: that makes one skill silently depend on the other's internal
directory structure. This repo just demonstrated that risk is real —
`design-taste-frontend-v1` was deleted in Bucket A, and if
`redesign-existing-projects` had been pointed into
`design-taste-frontend/references/`, a future restructure or deletion of
`design-taste-frontend` would silently break it.

Instead: a new top-level `skills/shared-references/` directory, containing
only `anti-slop-tells.md`, no `SKILL.md` (so it does not register as an
invocable skill — confirmed via the existing convention that only
directories with a `SKILL.md` are picked up by the skill loader). Both
skills reference it as a peer, not as a subordinate of one another.

### Content of `anti-slop-tells.md`

Only the verified-identical subset, organized as a flat reference list
(no dial-conditional logic, no framework-specific code — those stay local
to `design-taste-frontend`):

- Fake-precision numbers (with the existing example set: `99.99%`, `47.2%`, etc.)
- Placeholder/generic brand names (`Acme`, `Nexus`, `SmartFlow`, etc.)
- Generic person names (`John Doe`, `Jane Smith`, etc.)
- AI copywriting clichés (Elevate/Seamless/Unleash/Next-Gen/Delve/Tapestry)
- Pure `#000000` background ban
- Purple/blue "AI gradient" ban
- Max-one-accent-color / saturation-under-80% rule
- Shadow tinting (match background hue, no flat black)
- 3-equal-column card row ban
- `min-h-[100dvh]` over `height: 100vh`/`h-screen`
- CSS Grid over flexbox percentage math

### Integration

`design-taste-frontend/SKILL.md` Section 9 and `redesign-existing-projects/SKILL.md`'s
Design Audit both replace their local copies of *only these specific
bullets* with one line each pointing to the shared file (matching the
"read on demand" pattern `senior-engineering-partner` already uses for its
own `references/` — a pointer line, not an inline duplication). Everything
else in both files (Section 4's dial-coupled directives, the
audit-specific "Fix Priority" / "Rules" sections in
`redesign-existing-projects`) stays exactly where it is.

### Expected impact

~40-60 lines removed net (smaller than the original ~150-line estimate —
most of what looked like overlap was Section 4, which isn't actually
shared). Removes real drift risk on the pieces that *are* shared: those
exact examples would otherwise need manual sync forever, and there's no
mechanism today that would catch them drifting.

## Component 3: `hooks/post-compact-anatomy.sh`

### Problem

The original audit flagged the 8-line `escape_for_json()` function (manual
`${s//pattern/repl}` substitution for `\`, `"`, `\n`, `\r`, `\t`) as a
hand-rolled reimplementation of `jq -Rs '.'`, worth a one-line swap.
Reading the full script surfaced a second, related problem the audit
didn't flag: the script's final output is *also* hand-assembled —
`printf '{\n  "hookSpecificOutput": {...} "additionalContext": "%s"\n}\n' "$combined_context"`
— a hand-built JSON template that assumes `$combined_context` is already
correctly escaped. `$combined_context` itself is built by string-concatenating
the escaped anatomy content with literal `\n<TAG>...\n</TAG>` markup typed
directly in bash (JSON-escaped-newline sequences, not real newlines) around
it.

This compounds the fragility: `escape_for_json()`'s 5-character allowlist
doesn't cover every character that can appear in an arbitrary
`.wolf/anatomy.md` file (other control characters, or a lone backslash
adjacent to a sequence the naive substitution mishandles), and even if it
did, the outer `printf` template has no defense if `$combined_context`
ever contains something it didn't anticipate. Swapping only
`escape_for_json()` for `jq -Rs '.'` would fix the inner problem but leave
the outer hand-built template in place — the smaller fix the audit
proposed doesn't fully close the gap.

### Design

Replace both fragile pieces with a single `jq -n` invocation that
constructs the entire JSON object in one step, letting jq handle all
escaping (including the wrapper markup) rather than mixing jq-escaped
fragments with bash-typed literal `\n` sequences via string concatenation.

Grilled soft spot: the current script has zero external dependencies
(pure bash builtins). Making it depend on `jq` is a real behavior change
for anyone whose environment doesn't have it — this repo is public, per
the portable-repo notes, so "works for me" isn't a safe assumption. Per
the grilling decision: guard with `command -v jq` (the same pattern
`.githooks/pre-commit` already uses for `shellcheck`/`gitleaks`) and fall
back to the *old* `escape_for_json` + hand-built template if `jq` is
missing — degraded (5-character escaping, same as today) but still
functional, rather than silently going from "always injects" to "never
injects" for anyone without `jq`.

```bash
#!/usr/bin/env bash
# PostCompact hook: re-injects OpenWolf anatomy after context compaction.
# Anatomy injected at SessionStart is lost after compaction — this restores it.

set -euo pipefail

# Fallback only — used when jq isn't available. Keep in sync with the
# jq path below if the wrapper markup ever changes.
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

GLOBAL_ANATOMY_FILE="$HOME/.claude/.wolf/anatomy.md"
global_anatomy_raw=""
if [ -f "$GLOBAL_ANATOMY_FILE" ]; then
  global_anatomy_raw=$(cat "$GLOBAL_ANATOMY_FILE" 2>/dev/null || echo "")
fi

ANATOMY_FILE="${CLAUDE_CWD:-.}/.wolf/anatomy.md"
anatomy_raw=""
if [ -f "$ANATOMY_FILE" ]; then
  anatomy_raw=$(cat "$ANATOMY_FILE" 2>/dev/null || echo "")
fi

if [ -z "$global_anatomy_raw" ] && [ -z "$anatomy_raw" ]; then
  exit 0
fi

if command -v jq >/dev/null 2>&1; then
  jq -n \
    --arg global "$global_anatomy_raw" \
    --arg local "$anatomy_raw" \
    '
    (if $global != "" then
      "\n\n<GLOBAL_CLAUDE_ANATOMY>\nContext was compacted — anatomy re-injected. This is the map of your ~/.claude config directory:\n\n" + $global + "\n</GLOBAL_CLAUDE_ANATOMY>"
     else "" end)
    +
    (if $local != "" then
      "\n\n<PROJECT_ANATOMY>\nContext was compacted — project anatomy re-injected from .wolf/anatomy.md:\n\n" + $local + "\n\nCross-reference .wolf/buglog.json before fixing bugs. Update .wolf/cerebrum.md with new learnings at session end.\n</PROJECT_ANATOMY>"
     else "" end)
    as $ctx
    | {hookSpecificOutput: {hookEventName: "PostCompact", additionalContext: $ctx}}
    '
else
  # jq not installed — fall back to the original hand-rolled escaping.
  combined_context=""
  if [ -n "$global_anatomy_raw" ]; then
    global_escaped=$(escape_for_json "$global_anatomy_raw")
    combined_context="${combined_context}\n\n<GLOBAL_CLAUDE_ANATOMY>\nContext was compacted — anatomy re-injected. This is the map of your ~/.claude config directory:\n\n${global_escaped}\n</GLOBAL_CLAUDE_ANATOMY>"
  fi
  if [ -n "$anatomy_raw" ]; then
    anatomy_escaped=$(escape_for_json "$anatomy_raw")
    combined_context="${combined_context}\n\n<PROJECT_ANATOMY>\nContext was compacted — project anatomy re-injected from .wolf/anatomy.md:\n\n${anatomy_escaped}\n\nCross-reference .wolf/buglog.json before fixing bugs. Update .wolf/cerebrum.md with new learnings at session end.\n</PROJECT_ANATOMY>"
  fi
  printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "PostCompact",\n    "additionalContext": "%s"\n  }\n}\n' "$combined_context"
fi
```

Note the `\n\n<TAG>...` markup strings inside the jq filter are jq string
literals — jq itself interprets `\n` as a real newline and emits it
correctly escaped (`\n` two-char sequence) in its JSON output, so this is
no longer a manual escaping exercise on the jq path. The fallback path is
byte-for-byte the original script's logic, unchanged.

### Testing

No existing test for this script. Precedent exists —
`hooks/session-start.test.js` spawns a `.sh` hook as a subprocess and
asserts on stdout — new `hooks/post-compact-anatomy.test.js` follows the
same pattern: write sample anatomy content to temp files, run the script
with `CLAUDE_CWD` pointed at a temp dir, parse stdout with `JSON.parse` to
confirm valid JSON, and assert the `additionalContext` field contains the
expected wrapper tags and content. Cases: both files present, only global
present, only local present, neither present (exits 0, no output),
content containing characters `escape_for_json()`'s old allowlist didn't
cover (e.g. a literal backslash followed by a non-escaped character) on
the jq path to prove the correctness fix, and — with `jq` temporarily
hidden from `PATH` in the test (e.g. `PATH=/usr/bin:/bin` minus jq's
directory, or a stubbed `command -v`) — confirm the fallback path still
produces valid JSON matching the pre-change script's behavior.

### Expected impact

~5-10 lines removed net (smaller than the original estimate now that the
fallback keeps `escape_for_json()` around), plus a genuine correctness fix
on the jq path (guaranteed valid JSON regardless of anatomy-file content)
with no regression for anyone missing `jq`.

## Verification Plan

- Component 1: new `scripts/hook-input.test.js`, run via `node --test`. Existing hook `*.test.js` files (`pre-skill-gate.test.js`, `cerebrum-write-guard.test.js`, etc., wherever they exist) must still pass unchanged after the import swap — proves no behavior change.
- Component 2: no code, no test — a documentation/reference-content change. Verify both `SKILL.md` files still render sensibly (no broken cross-reference, no orphaned heading) after the bullets are replaced with pointer lines.
- Component 3: new `hooks/post-compact-anatomy.test.js` per the cases above.
- All three: `.githooks/pre-commit` (shellcheck + eslint-security + gitleaks) must pass clean, matching the Bucket A PR's precedent.

## Out of Scope

- Bucket C items (deferred to a separate future decision, per the earlier B/C review conversation).
- Any change to the JSON-parse-and-failure-handling logic in the 13 hook files (Component 1 explicitly leaves this untouched — see "What does NOT get extracted, and why").
- Any change to `design-taste-frontend`'s dial system or `redesign-existing-projects`'s audit-specific sections (Component 2 touches only the verified-duplicate bullets).
