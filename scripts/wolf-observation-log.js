#!/usr/bin/env node
// Deterministic append/resolve/archive helper for .wolf/observations.md —
// the skill-observation log. Used both as a CLI (Claude/session-reflect
// invoke `node wolf-observation-log.js <subcommand>`) and as an importable
// module — hooks import these functions directly rather than shelling out,
// since hooks/**/*.js is eslint-banned from child_process.
// See docs/superpowers/specs/2026-07-20-skill-observation-system-design.md

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  openSync,
  closeSync,
  unlinkSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEADER_RE = /^### Observation (\d+):.*$/gm;
const VALID_TYPES = new Set([
  'skill-improvement',
  'new-skill-candidate',
  'cross-cutting-principle',
  'compaction-checkpoint',
  'write-batch-checkpoint',
]);
const VALID_STATUSES = new Set(['OPEN', 'ACTIONED', 'DECLINED']);

const DEFAULT_HEADER = `# Skill Observation Log

Observations captured during task-oriented work. Separate from cerebrum.md
(daemon-owned) — this file is owned by session-reflect and
hooks/post-compact-observation.js / hooks/post-write-batch-nudge.js.

**Status key:** OPEN = not yet actioned | ACTIONED (YYYY-MM-DD) = applied |
DECLINED (YYYY-MM-DD) = reviewed, not pursued

---
`;

function isEphemeralPath(logPath) {
  return logPath.includes('.claude/worktrees/');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function readLog(logPath) {
  if (!existsSync(logPath)) return DEFAULT_HEADER;
  return readFileSync(logPath, 'utf8');
}

function countHeadersInContent(content) {
  return [...content.matchAll(HEADER_RE)].length;
}

function highestNumber(content) {
  let max = 0;
  for (const match of content.matchAll(HEADER_RE)) {
    const n = Number(match[1]);
    if (n > max) max = n;
  }
  return max;
}

function backup(logPath) {
  if (existsSync(logPath)) {
    copyFileSync(logPath, `${logPath}.bak`);
  }
}

function sleepSync(ms) {
  const sab = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(sab, 0, 0, ms);
}

// Atomic exclusive-create lockfile mutex — real filesystem control here
// (unlike task-observer's shell-only environment) means a lock is simpler
// and strictly safer than optimistic collision-detect-and-retry.
function withLock(logPath, fn) {
  mkdirSync(dirname(logPath), { recursive: true });
  const lockPath = `${logPath}.lock`;
  const deadline = Date.now() + 5000;
  let fd;
  for (;;) {
    try {
      fd = openSync(lockPath, 'wx');
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() > deadline) {
        throw new Error(`timed out waiting for lock on ${logPath}`);
      }
      sleepSync(25);
    }
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    unlinkSync(lockPath);
  }
}

export function appendObservation(logPath, payload) {
  if (isEphemeralPath(logPath)) {
    throw new Error(`refusing to write into ephemeral path: ${logPath}`);
  }
  const {
    type,
    skill = '',
    issue = '',
    improvement = '',
    principle = '',
    status = 'OPEN',
    session = '',
    title = '',
  } = payload || {};

  if (!VALID_TYPES.has(type)) {
    throw new Error(`invalid observation type: ${type}`);
  }
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`invalid observation status: ${status}`);
  }

  return withLock(logPath, () => {
    backup(logPath);
    const content = readLog(logPath);
    const number = highestNumber(content) + 1;
    const entryTitle = title || `${type}: ${skill || 'general'}`;

    const entry = `
### Observation ${number}: ${entryTitle}

**Status:** ${status}
**Date:** ${todayISO()}
**Type:** ${type}
**Session:** ${session}
**Skill:** ${skill}
**Issue:** ${issue}
**Suggested improvement:** ${improvement}
**Principle:** ${principle}
`;

    writeFileSync(logPath, content + entry);
    return number;
  });
}

export function countHeaders(logPath) {
  if (!existsSync(logPath)) return 0;
  return countHeadersInContent(readFileSync(logPath, 'utf8'));
}

export function hasOpenEntry(logPath, { type, session }) {
  if (!existsSync(logPath)) return false;
  const content = readFileSync(logPath, 'utf8');
  const matches = [...content.matchAll(HEADER_RE)];
  return matches.some((m, idx) => {
    const start = m.index;
    const end = idx + 1 < matches.length ? matches[idx + 1].index : content.length;
    const block = content.slice(start, end);
    const isOpen = /^\*\*Status:\*\*\s*OPEN\s*$/m.test(block);
    const typeMatch = block.match(/^\*\*Type:\*\*\s*(.+)$/m);
    const sessionMatch = block.match(/^\*\*Session:\*\*\s*(.*)$/m);
    return isOpen
      && typeMatch && typeMatch[1].trim() === type
      && sessionMatch && sessionMatch[1].trim() === session;
  });
}

export function resolveObservation(logPath, number, status, note = '') {
  if (status !== 'ACTIONED' && status !== 'DECLINED') {
    throw new Error(`resolve status must be ACTIONED or DECLINED, got: ${status}`);
  }
  return withLock(logPath, () => {
    backup(logPath);
    const content = readLog(logPath);
    const before = countHeadersInContent(content);
    const matches = [...content.matchAll(HEADER_RE)];

    const idx = matches.findIndex((m) => Number(m[1]) === number);
    if (idx === -1) {
      throw new Error(`observation ${number} not found in ${logPath}`);
    }

    const start = matches[idx].index;
    const end = idx + 1 < matches.length ? matches[idx + 1].index : content.length;
    const entryBlock = content.slice(start, end);

    const statusLineRe = /^(\*\*Status:\*\*).*$/m;
    if (!statusLineRe.test(entryBlock)) {
      throw new Error(`observation ${number} has no Status line`);
    }
    const suffix = note ? ` — ${note}` : '';
    const newBlock = entryBlock.replace(statusLineRe, `$1 ${status} (${todayISO()})${suffix}`);

    const newContent = content.slice(0, start) + newBlock + content.slice(end);
    writeFileSync(logPath, newContent);

    const after = countHeadersInContent(newContent);
    if (after !== before) {
      throw new Error(`resolve mutated header count: ${before} -> ${after}`);
    }
    return true;
  });
}

export function archiveObservations(logPath, archiveDir, today = todayISO()) {
  return withLock(logPath, () => {
    if (!existsSync(logPath)) return { archivedCount: 0 };
    backup(logPath);
    const content = readLog(logPath);
    const before = countHeadersInContent(content);
    const matches = [...content.matchAll(HEADER_RE)];
    if (matches.length === 0) return { archivedCount: 0 };

    const resolvedDateRe = /^\*\*Status:\*\*\s*(ACTIONED|DECLINED)\s*\((\d{4}-\d{2}-\d{2})\)/m;
    const kept = [];
    const archivedByDate = new Map();

    matches.forEach((m, idx) => {
      const start = m.index;
      const end = idx + 1 < matches.length ? matches[idx + 1].index : content.length;
      const block = content.slice(start, end);
      const dateMatch = block.match(resolvedDateRe);
      if (dateMatch && dateMatch[2] < today) {
        const date = dateMatch[2];
        if (!archivedByDate.has(date)) archivedByDate.set(date, []);
        archivedByDate.get(date).push(block);
      } else {
        kept.push(block);
      }
    });

    if (archivedByDate.size === 0) {
      return { archivedCount: 0 };
    }

    mkdirSync(archiveDir, { recursive: true });
    let archivedCount = 0;
    for (const [date, blocks] of archivedByDate) {
      const archivePath = resolve(archiveDir, `log-${date}.md`);
      const existingArchive = existsSync(archivePath)
        ? readFileSync(archivePath, 'utf8')
        : DEFAULT_HEADER;
      writeFileSync(archivePath, existingArchive + blocks.join(''));
      archivedCount += blocks.length;
    }

    const preamble = content.slice(0, matches[0].index);
    const newContent = preamble + kept.join('');
    writeFileSync(logPath, newContent);

    const after = countHeadersInContent(newContent);
    if (after !== before - archivedCount) {
      throw new Error(`archive count mismatch: before=${before} archived=${archivedCount} after=${after}`);
    }

    return { archivedCount };
  });
}

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const [, , subcommand, ...rest] = process.argv;
  const logPath = resolve(process.cwd(), '.wolf/observations.md');

  try {
    if (subcommand === 'append') {
      const raw = readStdin();
      const payload = JSON.parse(raw);
      const number = appendObservation(logPath, payload);
      process.stdout.write(`${JSON.stringify({ number })}\n`);
    } else if (subcommand === 'resolve') {
      const [numberArg, status, ...noteParts] = rest;
      resolveObservation(logPath, Number(numberArg), status, noteParts.join(' '));
      process.stdout.write(`${JSON.stringify({ resolved: Number(numberArg), status })}\n`);
    } else if (subcommand === 'archive') {
      const archiveDir = resolve(process.cwd(), '.wolf/observations-archive');
      const result = archiveObservations(logPath, archiveDir);
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } else {
      process.stderr.write(`unknown subcommand: ${subcommand}. Expected append|resolve|archive.\n`);
      process.exit(1);
    }
  } catch (err) {
    process.stderr.write(`${String((err && err.message) || err)}\n`);
    process.exit(1);
  }
}
