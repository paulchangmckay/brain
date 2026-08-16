# Caveman-Lexicon SessionStart Hook — Design

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

User then asked to combine this with the always-on `i-have-adhd` plugin
mode (`plugins/marketplaces/i-have-adhd`) rather than run it standalone or
opt-in. Verified the plugin's actual delivery mechanism first: it registers
its own `SessionStart` hook via `hooks/hooks.json` inside the plugin
directory (`node ${CLAUDE_PLUGIN_ROOT}/hooks/always-on.mjs`), auto-wired by
the plugin system — not listed in the main `settings.json`. Editing plugin
files directly would fight future `i-have-adhd` updates and is exactly the
kind of fork this repo's portable-repo hygiene rule warns against.

The two rulesets turn out to be orthogonal, not competing: `i-have-adhd`
governs response *structure* (lead with action, numbered steps, restated
state, one concrete next action). Caveman governs prose *word-level density*
within whatever structure is already chosen. A second, independent
`SessionStart` hook that only adds density rules — and defers to the
existing structural rules whenever the two would conflict — merges both
without touching either's source.

## Scope

Build one new file: `hooks/caveman-lexicon.mjs`, registered as an additional
`SessionStart` hook in `settings.json` (not inside any plugin directory).

No installer, no binaries, no third-party network calls, no `settings.json`
merge beyond the one hook registration this design adds by hand.

## Hook Behavior

Two files, mirroring `i-have-adhd`'s own split between hook logic and
ruleset text exactly:

- `hooks/caveman-lexicon.mjs` — the `SessionStart` command hook. Verified
  against `i-have-adhd`'s real `always-on.mjs` (read directly, not assumed):
  it checks a flag file under `CLAUDE_CONFIG_DIR` (falling back to
  `os.homedir()/.claude`) for existence, reads a plain-text ruleset file
  from a path relative to the script's own location, and does a single
  `process.stdout.write(...)` — no JSON wrapping. Claude Code itself wraps
  raw stdout into the `SessionStart:... hook success: <text>` reminder seen
  in transcripts. The whole body runs in a `try/catch` that exits `0` on
  any failure, so a missing file or read error never blocks session start.
- `hooks/caveman-lexicon.md` — the ruleset text, plain markdown, no YAML
  frontmatter (nothing to strip, unlike `i-have-adhd`'s `SKILL.md` source).

On `startup`, `resume`, `clear`, and `compact` (same matcher as
`i-have-adhd`'s own hook, so the ruleset survives compaction), if
`.caveman-lexicon-always` exists, the hook writes to stdout:

```
CAVEMAN-LEXICON ACTIVE (always-on). The ruleset below applies to every
response. "stop caveman mode" turns it off for this session; delete
<flagPath> to turn always-on off for good.

<contents of hooks/caveman-lexicon.md>
```

`hooks/caveman-lexicon.md` contains:

```
# caveman-lexicon

Prose-density rules, layered on top of i-have-adhd's structural rules
(which are already active this session if enabled). These rules only
compress word choice within whatever structure the other rules already
require — they never change what gets included, ordered, or restated.

## Rules

1. Compress prose density beyond i-have-adhd's own hedge-stripping. Drop
   droppable determiners and connectives where meaning survives
   ("the reason X happens is Y" -> "X: Y"). Collapse cause-effect chains
   into "=" or "->" shorthand where it reads naturally. Prefer fragments
   over full clauses in explanations and in-body findings.

2. Byte-exact floor. Code, commands, file paths, numbers, error text, and
   proper nouns are never compressed, abbreviated, or paraphrased -- copy
   them exactly as they appear in source material.

3. Precedence rule. If compressing a sentence would remove something
   i-have-adhd's structure requires -- a numbered step, the restated-state
   line, the one concrete next action, a time estimate -- stop. Structure
   wins. Only cut word-level slack, never a required structural element.

Independent of i-have-adhd's own toggle -- either can be on without the
other.
```

(The toggle-off instructions live only in the `.mjs`-generated wrapper text
above, not duplicated here, so the flag path shown to the user is always the
real resolved path rather than a hardcoded string that could drift.)

The `.caveman-lexicon-always` flag file's mere existence gates injection,
mirroring `i-have-adhd`'s own `.i-have-adhd-always` convention exactly (same
check style, same off switch semantics) so the two features behave
identically from the user's point of view. The design defaults this flag
file to **present** (i.e., on) at implementation time, since the user asked
for a combined always-on experience, not an opt-in extra step.

## Wiring Changes

`settings.json`'s `hooks.SessionStart` array gets one new entry, following
the exact shape of the existing personal hooks in that array (e.g.
`prune-token-ledger.js`, `openwolf-cron-gate.js`):

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "node $CLAUDE_PROJECT_DIR/hooks/caveman-lexicon.mjs",
      "timeout": 5
    }
  ]
}
```

Ordering: appended after the existing entries so it loads after
`session-start.sh`'s anatomy digest, consistent with how `i-have-adhd`
already layers its own reminder on top of everything else via plugin
auto-registration (plugin hooks and this array both fire at `SessionStart`;
relative order between the plugin's hook and this new entry is not
controllable and does not matter, since the two reminders are independent
and additive).

Per `.claude/rules/portable-repo.md`: the hook script itself uses
`$CLAUDE_PROJECT_DIR`, never a hardcoded absolute path. The one absolute
path in the injected reminder text (`/Users/paulmckay/.claude/.caveman-lexicon-always`)
mirrors `i-have-adhd`'s own injected text, which does the same
(`/Users/paulmckay/.claude/.i-have-adhd-always` appears verbatim in that
plugin's live reminder today) — accepted as consistent with existing
precedent, not a new violation introduced by this design.

## Testing / Verification

- Start a fresh session (or `/clear`) and confirm the `caveman-lexicon`
  system-reminder appears alongside the `i-have-adhd` one.
- Confirm a response under the merged ruleset: structure matches
  `i-have-adhd` rules (numbered steps, next action, no preamble) AND prose
  within each step reads noticeably more compressed than a baseline
  response with only `i-have-adhd` active.
- Confirm "stop caveman mode" suppresses rule 1 compression for the rest of
  the session while `i-have-adhd`'s structural rules keep applying
  unchanged (proves independence of the two toggles).
- Confirm deleting `.caveman-lexicon-always` and starting a new session
  shows no caveman-lexicon reminder, while `i-have-adhd` (untouched) still
  activates normally.
- Confirm `/compact` re-injects the reminder (matcher includes `compact`).

## Risks / Open Questions Resolved During Brainstorming

- **Risk: two structural rulesets fighting.** Resolved by design — this
  hook adds no structural rules at all, only word-level ones, with an
  explicit precedence clause naming `i-have-adhd`'s structure as the
  tie-breaker.
- **Risk: forking third-party plugin code.** Rejected as an approach during
  brainstorming in favor of a fully independent second hook — confirmed
  `i-have-adhd` self-registers via its own `hooks/hooks.json`, so no shared
  file needs editing.
- **Risk: reintroducing the BSL/telemetry/binary footprint Caveman's own
  installer carries.** None of that ships here — this hook is a single
  authored `.mjs` file with no network calls and no dependency on the
  `caveman` CLI or npm package.
- **Open question, not yet decided: exact compression aggressiveness.**
  The ruleset above is a first draft calibrated to "noticeably terser than
  `i-have-adhd` alone, never at the cost of a required structural element."
  Real-world tuning (is rule 1 too aggressive/too timid) is expected after
  a few live sessions — flagged for `session-reflect` to capture, not a
  blocker to initial implementation.
