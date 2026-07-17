#!/usr/bin/env node
// SubagentStart hook: injects a short thin-harness digest into every
// Task-spawned subagent, except read-only search/analyzer types.
// SessionStart context never reaches subagents — see CLAUDE.md §3 and
// docs/superpowers/specs/2026-07-15-ponytail-bloat-tooling-design.md.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIGEST_PATH = process.env.WOLF_SUBAGENT_DIGEST_PATH
  || resolve(HERE, 'subagent-thin-harness.md');

const SKIP_AGENT_TYPES = /^(explore|understand-anything:)/i;

const FALLBACK_DIGEST = [
  'Thin-harness reminders for this subagent:',
  '- No premature abstraction: no interface with one implementation, no config for a value that never changes.',
  '- YAGNI: build only what the task needs.',
  '- Reuse before rewrite: check for an existing helper/util/pattern first.',
  '- When cutting a real corner with a known ceiling, leave a wolf-debt: <ceiling>, <upgrade trigger> comment.',
].join('\n');

function readDigest() {
  try {
    return readFileSync(DIGEST_PATH, 'utf8');
  } catch (_) {
    return FALLBACK_DIGEST;
  }
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

let agentType = '';
try {
  agentType = String(JSON.parse(readStdin() || '{}').agent_type || '');
} catch (_) {
  agentType = '';
}

if (agentType && SKIP_AGENT_TYPES.test(agentType)) {
  process.exit(0);
}

try {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SubagentStart',
      additionalContext: readDigest(),
    },
  }) + '\n');
} catch (_) {
  // Silent fail — a stdout error at hook exit must not surface as a hook failure.
}

process.exit(0);
