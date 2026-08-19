#!/usr/bin/env node
// PreToolUse hook (matcher: Edit|Write): warns if cerebrum.md changed on
// disk since this session last recorded touching it — signals another
// concurrent session wrote to it in between. Read-only: the marker is
// updated by the PostToolUse companion (cerebrum-write-guard-post.js)
// AFTER a write actually lands, not here — a PreToolUse hook only ever
// observes pre-edit state, so recording the marker here would compare
// this session's own post-edit mtime against itself on the next call.
// See docs/superpowers/specs/2026-07-20-tooling-friction-hardening-design.md §2.

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { readStdin, SAFE_NAME } from '../scripts/hook-input.js';

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

process.exit(0);
