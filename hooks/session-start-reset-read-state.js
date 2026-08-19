#!/usr/bin/env node
// SessionStart hook: resets .wolf/_session.json's read-history to empty at
// the start of every session, mirroring how hooks/session-start.js already
// resets its own (differently-named, per-session-id) state file. Without
// this, .wolf/_session.json — which pre-read-check.js reads/writes — grows
// unbounded across every session ever run, since nothing else ever clears
// it (see docs/superpowers/specs/2026-08-18-hook-hardening-design.md §1a).
import path from 'node:path';
import { existsSync } from 'node:fs';
import { writeJSONAtomic } from './lib/atomic-write.js';
import { readStdin } from '../scripts/hook-input.js';

export function resetReadState(cwd) {
  const wolfDir = path.join(cwd, '.wolf');
  if (!existsSync(wolfDir)) return;
  const sessionPath = path.join(wolfDir, '_session.json');
  writeJSONAtomic(sessionPath, { reads: [] });
}

function main() {
  try {
    readStdin();
    const cwd = process.argv[2] || process.cwd();
    resetReadState(cwd);
  } catch (_) {
    // fail open
  }
  process.exit(0);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
