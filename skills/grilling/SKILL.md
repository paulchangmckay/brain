---
name: grilling
description: Interview the user relentlessly about a plan or design. Use when the user wants to stress-test a plan before building, or uses any 'grill' trigger phrases.
---

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing. Asking multiple questions at once is bewildering.

If a question can be answered by exploring the codebase, explore the codebase instead.

For claims that can be checked mechanically instead of argued about — a data pipeline's real schema/enum values, whether a package actually installs cleanly on the pinned Python/Node version, a third-party installer or self-heal script's actual file-system side effects — verify by running the real (or ephemeral) command and reading its output or diff. Don't resolve these from documentation, package metadata, or source-reading alone; treat that as a hypothesis until the real command has been run.
