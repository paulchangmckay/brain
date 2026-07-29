#!/usr/bin/env node
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { estimateTokens } from './lib/token-count.js';
import { isStale, writeMarker, acquireLock, releaseLock } from './lib/gate-marker.js';

const MEMORY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MEMORY_MAX_TOKENS = 15000;
const CEREBRUM_MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;
const CEREBRUM_MAX_TOKENS = 2200;

const SESSION_HEADER_RE = /^## Session: (\S+)/;
const CONSOLIDATED_RE = /^> Consolidated session \(\d+ actions\)$/;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

export function runOpenwolfCron(id) {
  const cmd = process.env.WOLF_CRON_CMD || 'openwolf';
  const result = spawnSync(cmd, ['cron', 'run', id], { encoding: 'utf8' });
  return result.status === 0;
}

function splitIntoBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const match = line.match(SESSION_HEADER_RE);
    if (match) {
      if (current) blocks.push(current);
      current = { date: match[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    } else {
      blocks.push({ date: null, lines: [line], preamble: true });
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function isFullyConsolidated(block) {
  if (block.preamble || !block.date) return false;
  const body = block.lines.slice(1).map((l) => l.trim()).filter((l) => l.length > 0);
  return body.length === 1 && CONSOLIDATED_RE.test(body[0]);
}

export function archiveOldMemoryEntries(memoryPath, archivePath, maxTokens) {
  let content;
  try {
    content = readFileSync(memoryPath, 'utf8');
  } catch (_) {
    return;
  }
  let remainingTokens = estimateTokens(content);
  if (remainingTokens <= maxTokens) return;

  const blocks = splitIntoBlocks(content);
  const consolidated = blocks
    .filter(isFullyConsolidated)
    .sort((a, b) => a.date.localeCompare(b.date));

  const archived = [];
  const remainingBlocks = new Set(blocks);
  for (const block of consolidated) {
    archived.push(block);
    remainingBlocks.delete(block);
    remainingTokens -= estimateTokens(block.lines.join('\n'));
    if (remainingTokens <= maxTokens) break;
  }

  if (archived.length === 0) return;

  const finalContent = blocks
    .filter((b) => remainingBlocks.has(b))
    .map((b) => b.lines.join('\n'))
    .join('\n');

  const archiveAddition = archived.map((b) => b.lines.join('\n')).join('\n\n') + '\n\n';
  const preamble = '# Memory Archive\n\n> Older sessions moved out of `memory.md` to keep the actively-loaded file lean.\n> Not auto-loaded by hooks — read on demand only.\n\n';
  const existingArchive = existsSync(archivePath) ? readFileSync(archivePath, 'utf8') : preamble;

  writeFileSync(archivePath, existingArchive + archiveAddition);
  writeFileSync(memoryPath, finalContent);
}

export function checkMemoryConsolidation(wolfDir) {
  const markerPath = path.join(wolfDir, '_gate-memory-consolidation.json');
  const memoryPath = path.join(wolfDir, 'memory.md');
  const archivePath = path.join(wolfDir, 'memory-archive.md');
  const lockPath = path.join(wolfDir, '_cron-gate.lock');

  let memoryContent;
  try {
    memoryContent = readFileSync(memoryPath, 'utf8');
  } catch (_) {
    return; // no memory.md yet — nothing to do
  }

  const stale = isStale(markerPath, MEMORY_MAX_AGE_MS);
  const oversized = estimateTokens(memoryContent) > MEMORY_MAX_TOKENS;
  if (!stale && !oversized) return;

  if (!acquireLock(lockPath)) return; // another session is already handling a gate

  try {
    const ok = runOpenwolfCron('memory-consolidation');
    if (!ok) {
      console.error('[openwolf-cron-gate] memory-consolidation failed — will retry next session');
      return; // fail open — retry next session
    }
    writeMarker(markerPath, { lastRun: new Date().toISOString() });
    archiveOldMemoryEntries(memoryPath, archivePath, MEMORY_MAX_TOKENS);
  } finally {
    releaseLock(lockPath);
  }
}

export function checkCerebrumReflection(wolfDir) {
  const markerPath = path.join(wolfDir, '_gate-cerebrum-reflection.json');
  const cerebrumPath = path.join(wolfDir, 'cerebrum.md');
  const lockPath = path.join(wolfDir, '_cron-gate.lock');

  let cerebrumContent;
  try {
    cerebrumContent = readFileSync(cerebrumPath, 'utf8');
  } catch (_) {
    return; // no cerebrum.md yet — nothing to do
  }

  const stale = isStale(markerPath, CEREBRUM_MAX_AGE_MS);
  const oversized = estimateTokens(cerebrumContent) > CEREBRUM_MAX_TOKENS;
  if (!stale && !oversized) return;

  if (!acquireLock(lockPath)) return; // another session is already handling a gate

  try {
    const ok = runOpenwolfCron('cerebrum-reflection');
    if (!ok) {
      console.error('[openwolf-cron-gate] cerebrum-reflection failed — will retry next session');
      return; // fail open — retry next session
    }
    writeMarker(markerPath, { lastRun: new Date().toISOString() });
  } finally {
    releaseLock(lockPath);
  }
}

function main() {
  try {
    const mode = process.argv[2];
    const cwd = process.argv[3] || process.cwd();
    readStdin();
    const wolfDir = path.join(cwd, '.wolf');
    if (!existsSync(wolfDir)) {
      process.exit(0);
    }
    if (mode === 'memory-consolidation') {
      checkMemoryConsolidation(wolfDir);
    } else if (mode === 'cerebrum-reflection') {
      checkCerebrumReflection(wolfDir);
    }
  } catch (_) {
    // fail open — never let this hook block a session
  }
  process.exit(0);
}

main();
