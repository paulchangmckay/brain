#!/usr/bin/env node
import path from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isStale, writeMarker } from './lib/gate-marker.js';

const LEDGER_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function sumSessionTokens(session) {
  const reads = session.reads || [];
  const writes = session.writes || [];
  const readTokens = reads.reduce((sum, r) => sum + (r.tokens_estimated || 0), 0);
  const writeTokens = writes.reduce((sum, w) => sum + (w.tokens_estimated || 0), 0);
  return {
    tokens: readTokens + writeTokens,
    reads: reads.length,
    writes: writes.length,
  };
}

export function pruneTokenLedger(ledgerPath) {
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  } catch (_) {
    return; // missing or corrupt — skip rather than risk a bad write
  }

  const cutoff = Date.now() - SESSION_RETENTION_MS;
  const sessions = ledger.sessions || [];
  const kept = [];
  const rolled = [];
  for (const session of sessions) {
    const startedMs = Date.parse(session.started || '');
    if (!Number.isNaN(startedMs) && startedMs < cutoff) {
      rolled.push(session);
    } else {
      kept.push(session);
    }
  }

  ledger.lifetime = ledger.lifetime || {
    total_tokens_estimated: 0,
    total_reads: 0,
    total_writes: 0,
    total_sessions: 0,
  };
  for (const session of rolled) {
    const { tokens, reads, writes } = sumSessionTokens(session);
    ledger.lifetime.total_tokens_estimated = (ledger.lifetime.total_tokens_estimated || 0) + tokens;
    ledger.lifetime.total_reads = (ledger.lifetime.total_reads || 0) + reads;
    ledger.lifetime.total_writes = (ledger.lifetime.total_writes || 0) + writes;
  }
  ledger.sessions = kept;

  const flags = ledger.waste_flags || [];
  const deduped = new Map();
  for (const flag of flags) {
    const key = `${flag.pattern}|${flag.description}`;
    if (deduped.has(key)) {
      deduped.get(key).count += 1;
    } else {
      deduped.set(key, { ...flag, count: 1 });
    }
  }
  ledger.waste_flags = [...deduped.values()];

  writeFileSync(ledgerPath, JSON.stringify(ledger));
}

function main() {
  try {
    const cwd = process.argv[2] || process.cwd();
    readStdin();
    const wolfDir = path.join(cwd, '.wolf');
    if (!existsSync(wolfDir)) {
      process.exit(0);
    }
    const ledgerPath = path.join(wolfDir, 'token-ledger.json');
    const markerPath = path.join(wolfDir, '_gate-ledger-prune.json');
    if (!existsSync(ledgerPath)) {
      process.exit(0);
    }
    if (!isStale(markerPath, LEDGER_MAX_AGE_MS)) {
      process.exit(0);
    }
    pruneTokenLedger(ledgerPath);
    writeMarker(markerPath, { lastRun: new Date().toISOString() });
  } catch (_) {
    // fail open
  }
  process.exit(0);
}

main();
