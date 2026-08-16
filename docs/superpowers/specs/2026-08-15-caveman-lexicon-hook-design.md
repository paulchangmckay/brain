# Combined ADHD-Caveman SessionStart Hook — Design

## Context

User pointed at `github.com/JuliusBrussee/caveman` — a token-compression tool
for coding agents — and asked to implement it in `~/.claude`.

Two parallel research passes (external repo inventory + internal overlap
check) found Caveman ships 8+ distinct installable components. Cross-checked
against the existing repo:

| Component | License | Verdict |
|---|---|---|
| Skill (terser output) | MIT | Only genuinely novel piece — optimizes for token *cost*, distinct from `i-have-adhd`'s optimization for readability |
| `/caveman-commit` | MIT | Conflicts — Conventional Commits already enforced (`senior-engineering-partner`) |
| `/caveman-review` | MIT | Redundant — `/code-review` already has a terse low/medium-effort mode |
| cavecrew-investigator/builder/reviewer subagents | MIT | Redundant packaging — `subagent-driven-development` + `agent-team-architect` already cover the pattern |
| `/caveman-stats` | MIT | Duplicate — OpenWolf's `generate_token_report` cron already does this |
| Proxy + Engine | BSL-1.1 | Skip — signed binary downloads, telemetry on by default (opt-out), wide-CI benchmark (14.6–48.5%, one case regressed -9.9%), overlaps `context-tools`/`context-mode` |
| Caveman Browse | BSL-1.1 | Duplicate — Playwright MCP already registered and in use |
| Pixel mode / Skill Compressor | BSL-1.1 | Skip — experimental, model-gated, risk of breaking skill discovery for uncertain gain |

Decision: do not run Caveman's installer at all (it would write ~6 hook JS
files and merge `settings.json`, per the repo inventory). Instead, author a
small bespoke ruleset that borrows Caveman's terseness *technique*, sized to
the one gap that's real.

User asked to combine this with the always-on `i-have-adhd` plugin mode
(`plugins/marketplaces/i-have-adhd`) rather than run it standalone or
opt-in. Verified the plugin's actual delivery mechanism first (read
`always-on.mjs` directly, not assumed): it registers its own `SessionStart`
hook via `hooks/hooks.json` inside the plugin directory, auto-wired by the
plugin system. That hook checks `$CLAUDE_CONFIG_DIR/.i-have-adhd-always` for
existence, reads `skills/i-have-adhd/SKILL.md` relative to its own script
location, strips a leading YAML frontmatter block, and does one
`process.stdout.write(...)` — no JSON wrapping; Claude Code itself wraps raw
stdout into the `SessionStart:... hook success: <text>` reminder seen in
transcripts.

First revision of this spec kept the two rulesets in two separate hooks
(the plugin's own, plus a new independent one), reasoning that `i-have-adhd`
governs response *structure* while Caveman governs prose *word-level
density* — orthogonal concerns, safe to layer without touching either
source. That produced two separate reminder blocks, each with its own
"ACTIVE (always-on)... turns off..." framing — exactly the kind of
duplicated-boilerplate overhead this whole effort is about avoiding.

**Revision: combine into one hook.** The two concerns are still orthogonal
in content, but there's no reason to pay for two reminder wrappers when one
can carry both. Doing this without forking `i-have-adhd`'s content requires
disabling its plugin-registered hook (so it stops firing on its own) and
having one new hook *read `SKILL.md` live off disk* at session-start time —
same file, same location, still tracks future plugin updates byte-for-byte,
never copied into this repo. This is a `settings.json` toggle
(`enabledPlugins["i-have-adhd@i-have-adhd"]` → `false`), not a file edit
inside the plugin directory — so it stays fully reversible and the plugin
directory itself is never touched, unlike the fork this spec's first
revision explicitly rejected.

## Scope

Build two new files:

- `hooks/adhd-caveman.mjs` — the single `SessionStart` command hook that
  replaces `i-have-adhd`'s own hook for our purposes.
- `hooks/caveman-lexicon.md` — just the caveman density-rules text (the
  ADHD structural text is never stored in this repo; it's read live from
  the plugin's own `SKILL.md` each session).

One `settings.json` change: disable the `i-have-adhd` plugin
(`enabledPlugins` entry `false`) and register the new hook in its place.

No installer, no binaries, no third-party network calls, no other
`settings.json` changes.

## Hook Behavior

`hooks/adhd-caveman.mjs`, on `startup`, `resume`, `clear`, and `compact`
(same matcher `i-have-adhd`'s own hook used):

1. Resolve `flagPath = $CLAUDE_CONFIG_DIR/.i-have-adhd-always` (fallback
   `os.homedir()/.claude`, matching the plugin's own resolution exactly).
   Reuse this existing flag file rather than introduce a second one — it
   already carries the user's current on/off state, and one combined mode
   needs one gate. If it doesn't exist, exit `0` with no output (fully off,
   same as today).
2. Resolve `skillPath` to `i-have-adhd`'s real `SKILL.md`:
   `plugins/marketplaces/i-have-adhd/skills/i-have-adhd/SKILL.md`, relative
   to `CLAUDE_PROJECT_DIR` (this file lives in the main checkout, so a
   relative-from-project-root path is stable and avoids a hardcoded
   absolute path per `.claude/rules/portable-repo.md`).
3. Try to read and frontmatter-strip `skillPath` (same regex `i-have-adhd`'s
   own hook uses). If the read fails (plugin removed, path changed), catch
   it and continue with `adhdBody = null` — never let a missing plugin file
   block session start or suppress the caveman half.
4. Read `hooks/caveman-lexicon.md` (relative to this script's own
   location, same pattern as the plugin's own `scriptDir`-relative read).
   If this fails too, exit `0` — nothing to say.
5. Write one combined block to stdout:

```
ADHD-CAVEMAN MODE ACTIVE (always-on). Structure rules and prose-density
rules below both apply to every response. "stop adhd mode" turns off
structure only; "stop caveman mode" turns off density only; either phrase
alone leaves the other active. Delete <flagPath> to turn always-on off for
good (turns off both).

<adhdBody, or "(i-have-adhd SKILL.md not found -- structural rules
unavailable this session)" if step 3 failed>

---

<contents of hooks/caveman-lexicon.md>
```

`hooks/caveman-lexicon.md` keeps the same three rules as the prior revision
(compress prose density beyond `i-have-adhd`'s own hedge-stripping;
byte-exact floor for code/commands/paths/numbers/errors/proper nouns;
precedence rule naming the ADHD structural block as tie-breaker), with the
standalone "Independent of i-have-adhd's own toggle" line removed — that's
now stated once, in the combined wrapper, instead of duplicated per file.

The whole body runs in one `try/catch` that exits `0` on any failure,
matching the plugin's own defensive pattern: this hook must never block
session start.

## Wiring Changes

Two edits to `settings.json`:

1. Flip `enabledPlugins["i-have-adhd@i-have-adhd"]` from `true` to `false`.
   This stops the plugin's own `hooks/hooks.json` from being loaded, so its
   `SessionStart` hook no longer fires — the only way to silence one hook
   inside an enabled plugin without editing that plugin's files. The
   plugin's directory, `SKILL.md`, and marketplace-update path are
   otherwise untouched; re-enabling it (`claude plugin enable
   i-have-adhd@i-have-adhd`) reverts this instantly and independently of
   anything else in this design.
2. Add one new `SessionStart` entry to the `hooks.SessionStart` array,
   following the exact shape of the existing personal hooks in that array
   (e.g. `prune-token-ledger.js`, `openwolf-cron-gate.js`):

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "node $CLAUDE_PROJECT_DIR/hooks/adhd-caveman.mjs",
      "timeout": 5
    }
  ]
}
```

Per `.claude/rules/portable-repo.md`: both the hook registration and the
`SKILL.md` path inside the script use `$CLAUDE_PROJECT_DIR`-relative
resolution, never a hardcoded absolute path — an improvement over the
plugin's own hook, which resolves relative to `${CLAUDE_PLUGIN_ROOT}` (a
mechanism only plugins get) rather than a portable env var, but that's the
plugin's own code and out of scope to change.

## Testing / Verification

- Confirm `claude plugin list` shows `i-have-adhd@i-have-adhd` disabled
  after the `settings.json` edit.
- Start a fresh session (or `/clear`) and confirm exactly **one**
  `ADHD-CAVEMAN MODE ACTIVE` reminder appears — not two separate blocks,
  and not the old standalone `ADHD MODE ACTIVE` block from the plugin.
- Confirm the combined reminder contains both the real `i-have-adhd`
  `SKILL.md` body (structure rules) and the `caveman-lexicon.md` body
  (density rules), correctly frontmatter-stripped.
- Confirm a response under the merged ruleset: structure matches the old
  `i-have-adhd` behavior (numbered steps, next action, no preamble) AND
  prose within each step reads noticeably more compressed than a baseline
  response with only the old standalone `i-have-adhd` hook active.
- Confirm "stop adhd mode" and "stop caveman mode" each suppress only
  their own half for the rest of the session (proves the merge didn't
  collapse the two toggle phrases into an all-or-nothing switch at the
  prose-instruction level, even though the *permanent* off-switch is now
  a single shared flag file).
- Temporarily rename `SKILL.md` to simulate plugin removal; confirm the
  hook still emits the caveman-density-only block with the
  "not found" fallback line, and does not error or block session start.
- Confirm deleting `.i-have-adhd-always` and starting a new session shows
  no reminder at all (fully off, matching original `i-have-adhd` behavior).
- Confirm `/compact` re-injects the combined reminder (matcher includes
  `compact`).
- Re-enable the plugin (`claude plugin enable i-have-adhd@i-have-adhd`)
  and confirm the *old* standalone reminder returns and the new combined
  hook would then double up content if left registered — documenting that
  this design is a deliberate either/or with the plugin's own hook, not
  meant to run alongside it re-enabled.

## Risks / Open Questions Resolved During Brainstorming

- **Risk: two structural rulesets fighting.** Resolved by design — the
  combined hook adds no new structural rules of its own, only word-level
  ones, with an explicit precedence clause naming the ADHD structural
  block as tie-breaker. Unchanged from the prior revision.
- **Risk: forking third-party plugin code.** Still avoided — the combined
  hook reads `SKILL.md` live off disk every session rather than copying its
  text into this repo, so plugin updates keep flowing through automatically.
  What changed from the prior revision: getting to *one* reminder instead
  of two required disabling the plugin's own hook registration (a
  `settings.json` toggle) rather than leaving both hooks independently
  registered — a different, still-reversible trade, not a re-introduction
  of the fork risk.
- **New risk: single shared flag file collapses permanent independence.**
  The prior revision let each ruleset be permanently disabled on its own
  (two flag files). Reusing `.i-have-adhd-always` as the one gate means
  permanent off is now all-or-nothing; session-scoped independence via
  "stop adhd mode" / "stop caveman mode" is preserved. Accepted: simpler
  matches what "combine the two hooks" asked for, and a user who wants
  true permanent independence can still ask for a second flag file later.
- **New risk: dependency on the plugin's file surviving on disk.** If
  `i-have-adhd` is ever fully uninstalled (not just disabled), `SKILL.md`
  disappears and the combined hook silently loses the structural half.
  Mitigated by the "not found" fallback line in the reminder itself (visible
  in-session, not a silent gap) rather than a build-time guarantee.
- **Risk: reintroducing the BSL/telemetry/binary footprint Caveman's own
  installer carries.** None of that ships here — this hook is two authored
  files with no network calls and no dependency on the `caveman` CLI or npm
  package. Unchanged from the prior revision.
- **Open question, not yet decided: exact compression aggressiveness.**
  The `caveman-lexicon.md` ruleset is a first draft calibrated to
  "noticeably terser than `i-have-adhd` alone, never at the cost of a
  required structural element." Real-world tuning is expected after a few
  live sessions — flagged for `session-reflect` to capture, not a blocker
  to initial implementation.
