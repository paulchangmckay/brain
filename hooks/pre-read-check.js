#!/usr/bin/env node
// PreToolUse hook: guards context window before file reads.
// - Blocks re-reads within 10 min if the file hasn't changed on disk
// - Warns on large files (>500 tok in anatomy) to suggest offset/limit or grep
// - Warns on tiny files where the anatomy summary may suffice

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, relative, dirname } from 'path';

const filePath = process.argv[2] || '';
const cwd = process.argv[3] || process.cwd();

if (!filePath) process.exit(0);

const anatomyPath = resolve(cwd, '.wolf/anatomy.md');
const sessionPath = resolve(cwd, '.wolf/_session.json');
const REREAD_BLOCK_MS = 10 * 60 * 1000;
const LARGE_TOK = 500;
const SMALL_TOK = 200;

const relPath = relative(cwd, resolve(filePath));

// Find the file's anatomy entry (lines like: "path/to/file.ts - Description (~N tok)")
let anatomyEntry = null;
if (existsSync(anatomyPath)) {
  const lines = readFileSync(anatomyPath, 'utf8').split('\n');
  anatomyEntry = lines.find(l => l.includes(relPath) || l.includes(filePath)) || null;
}

// Get current file mtime (used to detect modification since last read)
let fileMtime = 0;
try { fileMtime = statSync(resolve(filePath)).mtimeMs; } catch (_) {}

const warnings = [];
let blockReason = null;
let didRead = false;

// Check session read history
if (existsSync(sessionPath)) {
  try {
    const session = JSON.parse(readFileSync(sessionPath, 'utf8'));
    const reads = session.reads || [];
    const now = Date.now();

    const prior = reads.find(r => {
      const p = typeof r === 'object' ? r.path : r;
      return p === relPath || p === filePath;
    });

    if (prior) {
      const priorTs = typeof prior === 'object' ? (prior.ts || 0) : 0;
      const priorMtime = typeof prior === 'object' ? (prior.mtime || 0) : 0;
      const ageMs = now - priorTs;

      if (priorTs && ageMs < REREAD_BLOCK_MS && fileMtime <= priorMtime) {
        const minAgo = Math.round(ageMs / 60000);
        blockReason = `Already read ${minAgo} min ago and the file hasn't changed. Use cached knowledge — or re-read with offset/limit if you need a specific section.`;
      } else {
        warnings.push(`Already read this session: ${relPath}. Use cached knowledge unless you need a specific section.`);
      }
    }
  } catch (_) {}
}

// Token-based checks from anatomy
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

// Fallback: file size check for files not in anatomy
if (!blockReason && !anatomyEntry && fileMtime) {
  try {
    const sizeKB = statSync(resolve(filePath)).size / 1024;
    if (sizeKB > 50) {
      warnings.push(`Large file (${Math.round(sizeKB)}KB): ${relPath}. Consider offset/limit or grep for targeted reads.`);
    }
  } catch (_) {}
}

// Output block or warnings
if (blockReason) {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `[OpenWolf] ${blockReason}`
  }) + '\n');
  // Blocked — don't record as a new read
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

// Record this read with timestamp + mtime for future dedup/block checks
try {
  mkdirSync(dirname(sessionPath), { recursive: true });
  let session = {};
  if (existsSync(sessionPath)) {
    try { session = JSON.parse(readFileSync(sessionPath, 'utf8')); } catch (_) {}
  }
  // Migrate legacy string entries to objects
  const reads = (session.reads || []).map(r =>
    typeof r === 'string' ? { path: r, ts: 0, mtime: 0 } : r
  );
  const idx = reads.findIndex(r => r.path === relPath);
  const record = { path: relPath, ts: Date.now(), mtime: fileMtime };
  if (idx >= 0) reads[idx] = record; else reads.push(record);
  writeFileSync(sessionPath, JSON.stringify({ ...session, reads }, null, 2));
} catch (_) {}

process.exit(0);
