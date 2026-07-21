#!/usr/bin/env node
// PostToolUse hook (matcher: Edit|Write): records cerebrum.md's mtime
// AFTER a write actually lands, as the baseline the PreToolUse companion
// (cerebrum-write-guard.js) compares future writes against. This is a
// separate PostToolUse hook (rather than writing the marker in the
// PreToolUse hook itself) because a PreToolUse hook only ever observes
// pre-edit state — recording the marker there would make the session's
// own edit look like a foreign write on its very next touch.
// See docs/superpowers/specs/2026-07-20-tooling-friction-hardening-design.md §2.

import { readFileSync, writeFileSync, statSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

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

const filePath = input.tool_input && input.tool_input.file_path;
const cwd = input.cwd || process.cwd();
const sessionId = input.session_id;

if (!filePath || !filePath.endsWith('cerebrum.md')) process.exit(0);
if (!sessionId || !SAFE_NAME.test(sessionId)) process.exit(0);

const cerebrumPath = resolve(filePath);
const markerPath = resolve(cwd, `.wolf/_cerebrum-guard-${sessionId}.json`);

let currentMtime = 0;
try { currentMtime = statSync(cerebrumPath).mtimeMs; } catch (_) {
  process.exit(0);
}

try {
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, JSON.stringify({ mtime: currentMtime }));
} catch (_) {}

process.exit(0);
