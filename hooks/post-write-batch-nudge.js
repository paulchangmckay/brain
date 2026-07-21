#!/usr/bin/env node
// PostToolUse hook (matcher: Write|Edit|MultiEdit): nudges toward logging
// an observation after 5 file changes with nothing logged in the meantime.
// Tied to a real event count rather than a vague "remember to" — stays
// reminder-based (not auto-write) since "is this insight-worthy" is a
// judgment call a hook can't make.
// See docs/superpowers/specs/2026-07-20-skill-observation-system-design.md

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { countHeaders } from '../scripts/wolf-observation-log.js';

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const THRESHOLD = 5;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

let input = {};
try {
  input = JSON.parse(readStdin() || '{}');
} catch (_) {
  process.exit(0);
}

const sessionId = input.session_id || '';
const cwd = input.cwd || process.cwd();

if (!sessionId || !SAFE_NAME.test(sessionId)) process.exit(0);

const markerPath = resolve(cwd, `.wolf/_writecount-${sessionId}.json`);
const logPath = resolve(cwd, '.wolf/observations.md');

try {
  let marker = { writesSinceLastObservation: 0, lastKnownObservationCount: 0 };
  if (existsSync(markerPath)) {
    marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  }

  const currentCount = countHeaders(logPath);
  if (currentCount > marker.lastKnownObservationCount) {
    marker.writesSinceLastObservation = 0;
    marker.lastKnownObservationCount = currentCount;
  } else {
    marker.writesSinceLastObservation += 1;
  }

  let shouldNudge = false;
  if (marker.writesSinceLastObservation >= THRESHOLD) {
    shouldNudge = true;
    marker.writesSinceLastObservation = 0;
  }

  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, JSON.stringify(marker));

  if (shouldNudge) {
    process.stdout.write(`${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `${THRESHOLD} file changes since the last observation log entry — worth logging a correction, pattern, or skill gap to .wolf/observations.md?`,
      },
    })}\n`);
  }
} catch (err) {
  process.stderr.write(`post-write-batch-nudge.js: ${String((err && err.message) || err)}\n`);
}

process.exit(0);
