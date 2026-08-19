# Cross-Cutting Principles

Principles that apply to all skills. Read as a mandatory checklist during
any skill creation or regeneration.

---

## Active Principles

- **Never skip the final whole-branch review as a formality.** Task-scoped reviews structurally cannot catch bugs that only manifest across the whole diff or under a real invocation context (different cwd, different test fixture) the task reviewer's own diff happened not to exercise. A clean run of every per-task review is not evidence the whole branch is clean. (Source: Observation 19)

- **Trace the actual call sequence before attaching a change to a named operation.** When a spec or plan names a specific function/operation as the point a schema or data change attaches to, verify by reading the real code path that the named operation actually fires at that point in the flow — not just that the design is architecturally sound. A change can be well-designed and thoroughly grilled while still attaching to the wrong operation. (Source: Observation 21)

- **Re-verify every discrete sub-claim of an inherited claim, not just the headline.** When re-checking a claim from a subagent, an earlier audit pass, or prior conversation turns, confirming a few concrete examples match does not confirm the other details riding along with it (where something lives, how many places, which mechanism is responsible). Partial verification creates false confidence in the unverified parts — check each sub-claim independently, especially the ones that feel already-covered by adjacent verification. (Source: Observation 26)

- **A test assertion is itself a claim, not just a verification tool.** This applies with extra force to negative/absence assertions (proving old code was broken, proving a case was uncovered). Before writing "X was broken before, Y fixes it," actually run the real "before" case against the real code and confirm it fails for the stated reason — don't reason about it in the abstract. An inverted assertion silently proves nothing. (Source: Observation 27)
