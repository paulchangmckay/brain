#!/usr/bin/env node
// PreToolUse hook (matcher: Edit|Write): warns if cerebrum.md changed on
// disk since this session last touched it — signals another concurrent
// session wrote to it in between. See
// docs/superpowers/specs/2026-07-20-tooling-friction-hardening-design.md §2.

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
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
try { currentMtime = statSync(cerebrumPath).mtimeMs; } catch (_) {}

let lastKnown = null;
if (existsSync(markerPath)) {
  try { lastKnown = JSON.parse(readFileSync(markerPath, 'utf8')).mtime; } catch (_) {}
}

if (lastKnown !== null && currentMtime > lastKnown) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: '[Cerebrum Guard] cerebrum.md changed on disk since this session last touched it — another session may have written to it. Re-read it before editing to avoid clobbering their update.'
    }
  }) + '\n');
}

try {
  mkdirSync(dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, JSON.stringify({ mtime: currentMtime }));
} catch (_) {}

process.exit(0);
