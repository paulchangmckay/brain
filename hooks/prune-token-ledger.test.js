import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./prune-token-ledger.js', import.meta.url));

function withTmpProject(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'ledger-prune-test-'));
  mkdirSync(join(cwd, '.wolf'), { recursive: true });
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function run(cwd) {
  return spawnSync('node', [SCRIPT, cwd], { input: '{}', encoding: 'utf8' });
}

function makeLedger({ oldSessions = 0, recentSessions = 0, wasteFlags = [] } = {}) {
  const now = Date.now();
  const sessions = [];
  for (let i = 0; i < oldSessions; i++) {
    sessions.push({
      id: `old-${i}`,
      started: new Date(now - (40 + i) * 24 * 60 * 60 * 1000).toISOString(),
      reads: [{ tokens_estimated: 100 }],
      writes: [{ tokens_estimated: 50 }],
    });
  }
  for (let i = 0; i < recentSessions; i++) {
    sessions.push({
      id: `recent-${i}`,
      started: new Date(now - i * 24 * 60 * 60 * 1000).toISOString(),
      reads: [{ tokens_estimated: 10 }],
      writes: [],
    });
  }
  return {
    version: 1,
    created_at: new Date(now).toISOString(),
    lifetime: { total_tokens_estimated: 0, total_reads: 0, total_writes: 0, total_sessions: 0 },
    sessions,
    daemon_usage: {},
    waste_flags: wasteFlags,
    optimization_report: {},
  };
}

test('no-ops when token-ledger.json does not exist', () => {
  withTmpProject((cwd) => {
    const result = run(cwd);
    assert.equal(result.status, 0);
  });
});

test('no-ops when gate is fresh', () => {
  withTmpProject((cwd) => {
    writeFileSync(join(cwd, '.wolf', 'token-ledger.json'), JSON.stringify(makeLedger({ oldSessions: 5 })));
    writeFileSync(join(cwd, '.wolf', '_gate-ledger-prune.json'), JSON.stringify({ lastRun: new Date().toISOString() }));
    const before = readFileSync(join(cwd, '.wolf', 'token-ledger.json'), 'utf8');
    run(cwd);
    const after = readFileSync(join(cwd, '.wolf', 'token-ledger.json'), 'utf8');
    assert.equal(before, after);
  });
});

test('rolls sessions older than 30 days into lifetime aggregates and removes them', () => {
  withTmpProject((cwd) => {
    writeFileSync(join(cwd, '.wolf', 'token-ledger.json'), JSON.stringify(makeLedger({ oldSessions: 3, recentSessions: 2 })));
    run(cwd);
    const ledger = JSON.parse(readFileSync(join(cwd, '.wolf', 'token-ledger.json'), 'utf8'));
    assert.equal(ledger.sessions.length, 2);
    assert.ok(ledger.sessions.every((s) => s.id.startsWith('recent-')));
    assert.equal(ledger.lifetime.total_reads, 3);
    assert.equal(ledger.lifetime.total_tokens_estimated, 3 * (100 + 50));
  });
});

test('deduplicates identical waste_flags entries with a count field', () => {
  withTmpProject((cwd) => {
    const dupFlag = { pattern: 'anatomy_miss_rate', description: '100% miss in session x', tokens_wasted: 0, detected_at: '2026-07-01T00:00:00.000Z' };
    writeFileSync(join(cwd, '.wolf', 'token-ledger.json'), JSON.stringify(makeLedger({ wasteFlags: [dupFlag, { ...dupFlag }, { ...dupFlag }] })));
    run(cwd);
    const ledger = JSON.parse(readFileSync(join(cwd, '.wolf', 'token-ledger.json'), 'utf8'));
    assert.equal(ledger.waste_flags.length, 1);
    assert.equal(ledger.waste_flags[0].count, 3);
  });
});

test('writes the gate marker after a successful prune', () => {
  withTmpProject((cwd) => {
    writeFileSync(join(cwd, '.wolf', 'token-ledger.json'), JSON.stringify(makeLedger({ oldSessions: 1 })));
    run(cwd);
    assert.equal(existsSync(join(cwd, '.wolf', '_gate-ledger-prune.json')), true);
  });
});
