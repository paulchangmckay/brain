#!/usr/bin/env node
// PostCompact hook: deterministically records that a compaction happened,
// so unlogged insight isn't silently lost the way it was before this hook
// existed — cerebrum.md accumulated 6 empty "Compaction event" stubs under
// the old prose-reminder-only approach (pre-compact-snapshot.sh). Dedupes
// per session: only the first compaction in a session creates an entry.
// See docs/superpowers/specs/2026-07-20-skill-observation-system-design.md

import { resolve } from 'node:path';
import { appendObservation, hasOpenEntry } from '../scripts/wolf-observation-log.js';
import { readStdin, SAFE_NAME } from '../scripts/hook-input.js';

let input = {};
try {
  input = JSON.parse(readStdin() || '{}');
} catch (_) {
  process.exit(0);
}

const sessionId = input.session_id || '';
const cwd = input.cwd || process.cwd();

if (!sessionId || !SAFE_NAME.test(sessionId)) process.exit(0);

const logPath = resolve(cwd, '.wolf/observations.md');

try {
  if (!hasOpenEntry(logPath, { type: 'compaction-checkpoint', session: sessionId })) {
    appendObservation(logPath, {
      type: 'compaction-checkpoint',
      session: sessionId,
      skill: 'session',
      issue: 'Compaction occurred; context may contain unlogged insights.',
      improvement: "Review this session's work and either enrich this entry or resolve DECLINED if nothing generalizes.",
      principle: '',
      status: 'OPEN',
    });
  }
} catch (err) {
  process.stderr.write(`post-compact-observation.js: ${String((err && err.message) || err)}\n`);
}

process.exit(0);
