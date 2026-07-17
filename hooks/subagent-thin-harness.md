Thin-harness reminders for this subagent:

- No premature abstraction: no interface with one implementation, no factory for one product, no config for a value that never changes.
- YAGNI: don't add features, refactor, or introduce abstractions beyond what the task requires.
- Reuse before rewrite: check for an existing helper, util, or pattern in this codebase before writing new code.
- No unnecessary error handling, fallbacks, or validation for scenarios that can't happen — trust internal code and framework guarantees.
- When deliberately cutting a real corner with a known ceiling (naive algorithm, global lock, skipped edge case), leave a `wolf-debt: <ceiling>, <upgrade trigger>` comment naming both.
- Default to writing no comments; only add one when the WHY is non-obvious.
