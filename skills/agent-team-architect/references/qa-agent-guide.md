# QA Agent Guide

Guidance for generating QA/reviewer-role agents, adapted from harness's
most novel contribution: a taxonomy of defects QA typically misses, and
the verification method that catches them.

## The pattern QA usually misses: boundary mismatch

A QA agent that only checks "does the file exist" or "does the function
have a name that looks right" misses the actual failure mode: two sides
of an interface that individually look correct but don't agree with each
other — an API response shape that doesn't match what the frontend hook
expects to receive, a function signature that changed on one side but
not the other, a schema field renamed in the database but not in the
code reading it.

**The fix: boundary-crossing comparison.** A QA agent verifying an
interface must read *both* sides of it in the same pass and compare them
directly — not verify each side independently against its own spec and
assume that's sufficient. "Does the API return `{user_id}`?" and "Does
the frontend read `{userId}`?" can both be individually true and still
be a bug.

## Incremental QA, not one pass at the end

Run QA after each module/component is complete, not once after
everything is "done." A single end-of-project QA pass has to hold the
entire system's boundaries in context at once and will miss more than a
QA pass scoped to one just-finished boundary. When Phase 2 selects a
pattern with a QA/reviewer role, prefer dispatching it once per completed
unit of work over once at the very end.

## QA agent definition template

```markdown
---
name: <role>-qa
description: "Reviews <specific boundary> for correctness. Reads both sides of the interface directly — does not just check for existence."
model: sonnet
---

# <Role> QA

## What this agent verifies
<the specific boundary — e.g. "API response shapes match frontend consumption">

## Method
1. Read the producing side: <e.g. API route handler / schema definition>
2. Read the consuming side: <e.g. frontend hook / downstream reader>
3. Compare directly — field names, types, optionality, nullability
4. Report mismatches with both sides quoted, not just "looks wrong"

## What this agent does NOT do
- Does not assume a passing test suite means the boundary is correct —
  tests can share the same wrong assumption on both sides
- Does not check existence alone ("the field is mentioned somewhere") as
  a substitute for the direct comparison above
```

## Checklist for any QA/reviewer agent this skill generates

- [ ] Does its `description` and body name the *specific* boundary it
      checks, not "reviews the code" generically?
- [ ] Does its method explicitly instruct reading both sides of the
      boundary in the same pass?
- [ ] Is it dispatched per-module (incremental) rather than only once at
      the end, where the pattern allows it?
- [ ] Does its `model:` reflect that review is genuine judgment (per
      `model-routing`), not the mechanical-retrieval floor?
