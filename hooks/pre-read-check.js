#!/usr/bin/env node
// PreToolUse hook: guards context window before file reads.
// - Blocks a re-read only if content is unchanged since last read this
//   session (content hash for files <=5MB, mtime for larger files) — never
//   blocks the same read twice in a row, so a genuine need to re-verify
//   content is never permanently stuck.
// - Warns on large files (>500 tok in anatomy) to suggest offset/limit or grep
// - Warns on tiny files where the anatomy summary may suffice
//
// Known limitation: .wolf/_session.json is shared by every concurrent
// session in this project directory (it has no per-session-id suffix,
// unlike .wolf/hooks/_session-<id>.json). A SessionStart reset in another
// concurrent session can clear this session's read history mid-task —
// the gate becomes temporarily less protective, never incorrectly
// blocking, so this is an accepted limitation rather than a bug.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { writeJSONAtomic } from './lib/atomic-write.js';
import { readStdin } from '../scripts/hook-input.js';

let input = {};
try {
  input = JSON.parse(readStdin() || '{}');
} catch (_) {
  process.exit(0);
}

// Real Claude Code PreToolUse contract delivers the tool's arguments via
// stdin JSON (tool_input.file_path), not an env var — the prior
// "${TOOL_INPUT_PATH:-}" argv wiring referenced a variable that does not
// exist anywhere in the CLI, so this hook never received a real path
// before this fix, regardless of any of this branch's own hardening work.
const filePath = (input.tool_input && input.tool_input.file_path) || '';
const cwd = input.cwd || process.cwd();

if (!filePath) process.exit(0);

const anatomyPath = resolve(cwd, '.wolf/anatomy.md');
const sessionPath = resolve(cwd, '.wolf/_session.json');
const LARGE_TOK = 500;
const SMALL_TOK = 200;
const HASH_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

const relPath = relative(cwd, resolve(filePath));

// Find the file's anatomy entry (lines like: "path/to/file.ts - Description (~N tok)")
let anatomyEntry = null;
if (existsSync(anatomyPath)) {
  const lines = readFileSync(anatomyPath, 'utf8').split('\n');
  anatomyEntry = lines.find((l) => l.includes(relPath) || l.includes(filePath)) || null;
}

let fileMtime = 0;
let fileSize = 0;
try {
  const st = statSync(resolve(filePath));
  fileMtime = st.mtimeMs;
  fileSize = st.size;
} catch (_) {
  // file may not exist (e.g. Read about to fail) — fall through with zeros
}

let fileHash = null;
if (fileSize > 0 && fileSize <= HASH_SIZE_LIMIT) {
  try {
    fileHash = createHash('sha256').update(readFileSync(resolve(filePath))).digest('hex');
  } catch (_) {}
}

const warnings = [];
let blockReason = null;

let reads = [];
if (existsSync(sessionPath)) {
  try {
    const parsed = JSON.parse(readFileSync(sessionPath, 'utf8'));
    if (Array.isArray(parsed.reads)) reads = parsed.reads;
  } catch (_) {}
}

const idx = reads.findIndex((r) => r.path === relPath);
const prior = idx >= 0 ? reads[idx] : null;

if (prior) {
  const unchanged =
    (fileHash !== null && prior.hash === fileHash) ||
    (fileHash === null && typeof prior.mtime === 'number' && fileMtime <= prior.mtime);

  if (unchanged && !prior.blockedLastAttempt) {
    blockReason =
      "Already read this session and the content hasn't changed. Use cached knowledge — or re-read with offset/limit if you need a specific section.";
    prior.blockedLastAttempt = true;
  } else {
    warnings.push(`Already read this session: ${relPath}. Use cached knowledge unless you need a specific section.`);
    prior.blockedLastAttempt = false;
    if (fileHash !== null) {
      prior.hash = fileHash;
      delete prior.mtime;
    } else {
      prior.mtime = fileMtime;
      delete prior.hash;
    }
  }
} else {
  const record = { path: relPath, blockedLastAttempt: false };
  if (fileHash !== null) record.hash = fileHash;
  else record.mtime = fileMtime;
  reads.push(record);
}

// Token-based checks from anatomy (unchanged from prior version)
if (!blockReason && anatomyEntry) {
  const m = anatomyEntry.match(/~(\d+)\s*tok/i);
  if (m) {
    const tok = parseInt(m[1], 10);
    if (tok > LARGE_TOK) {
      warnings.push(`Large file: ${relPath} (~${tok} tok). Use offset/limit or grep for targeted reads to protect context.`);
    } else if (tok <= SMALL_TOK) {
      warnings.push(`Anatomy summary (~${tok} tok): "${anatomyEntry.trim()}". Consider whether the summary is sufficient before reading the full file.`);
    }
  }
}

// Fallback: file size check for files not in anatomy (unchanged from prior version)
if (!blockReason && !anatomyEntry && fileMtime) {
  try {
    const sizeKB = statSync(resolve(filePath)).size / 1024;
    if (sizeKB > 50) {
      warnings.push(`Large file (${Math.round(sizeKB)}KB): ${relPath}. Consider offset/limit or grep for targeted reads.`);
    }
  } catch (_) {}
}

// Persist state — always, even when blocking, so blockedLastAttempt survives
// to enable the next attempt's retry-override.
try {
  writeJSONAtomic(sessionPath, { reads });
} catch (_) {}

if (blockReason) {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `[OpenWolf] ${blockReason}`
  }) + '\n');
  process.exit(0);
}

if (warnings.length > 0) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `[OpenWolf] ${warnings.join(' | ')}`
    }
  }) + '\n');
}

process.exit(0);
