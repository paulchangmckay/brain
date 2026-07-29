import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./openwolf-cron-gate.js', import.meta.url));

function withTmpProject(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'cron-gate-test-'));
  mkdirSync(join(cwd, '.wolf'), { recursive: true });
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function makeFakeCron(cwd, exitCode) {
  const fakePath = join(cwd, 'fake-openwolf.js');
  writeFileSync(fakePath, `#!/usr/bin/env node\nprocess.exit(${exitCode});\n`);
  chmodSync(fakePath, 0o755);
  return fakePath;
}

function run(mode, cwd, env = {}) {
  return spawnSync('node', [SCRIPT, mode, cwd], {
    input: '{}',
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('no-ops when .wolf/ does not exist', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cron-gate-nowolf-'));
  try {
    const result = run('memory-consolidation', cwd);
    assert.equal(result.status, 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('no-ops when memory.md does not exist', () => {
  withTmpProject((cwd) => {
    const result = run('memory-consolidation', cwd, { WOLF_CRON_CMD: makeFakeCron(cwd, 0) });
    assert.equal(result.status, 0);
    assert.equal(existsSync(join(cwd, '.wolf', '_gate-memory-consolidation.json')), false);
  });
});

test('triggers consolidation and writes marker when stale and no marker exists', () => {
  withTmpProject((cwd) => {
    writeFileSync(join(cwd, '.wolf', 'memory.md'), '# Memory\n\n## Session: 2026-01-01 00:00\nsome content\n');
    const fakeCron = makeFakeCron(cwd, 0);
    const result = run('memory-consolidation', cwd, { WOLF_CRON_CMD: fakeCron });
    assert.equal(result.status, 0);
    const markerPath = join(cwd, '.wolf', '_gate-memory-consolidation.json');
    assert.equal(existsSync(markerPath), true);
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    assert.ok(Date.parse(marker.lastRun) > 0);
  });
});

test('does not trigger when marker is fresh and file is small', () => {
  withTmpProject((cwd) => {
    writeFileSync(join(cwd, '.wolf', 'memory.md'), 'tiny\n');
    writeFileSync(join(cwd, '.wolf', '_gate-memory-consolidation.json'), JSON.stringify({ lastRun: new Date().toISOString() }));
    const fakeCron = makeFakeCron(cwd, 0);
    // Sabotage the fake cron so if it's actually invoked, the test would fail loudly via a marker mtime change.
    const before = readFileSync(join(cwd, '.wolf', '_gate-memory-consolidation.json'), 'utf8');
    run('memory-consolidation', cwd, { WOLF_CRON_CMD: fakeCron });
    const after = readFileSync(join(cwd, '.wolf', '_gate-memory-consolidation.json'), 'utf8');
    assert.equal(before, after);
  });
});

test('leaves marker untouched when openwolf cron run fails', () => {
  withTmpProject((cwd) => {
    writeFileSync(join(cwd, '.wolf', 'memory.md'), '# Memory\n\nold\n');
    const fakeCron = makeFakeCron(cwd, 1);
    run('memory-consolidation', cwd, { WOLF_CRON_CMD: fakeCron });
    assert.equal(existsSync(join(cwd, '.wolf', '_gate-memory-consolidation.json')), false);
  });
});

test('archives fully-consolidated old sessions when memory.md still exceeds threshold after consolidation', () => {
  withTmpProject((cwd) => {
    const bigBlock = '> Consolidated session (3 actions)\n\n';
    let body = '';
    for (let i = 0; i < 2000; i++) {
      body += `## Session: 2026-01-${String((i % 27) + 1).padStart(2, '0')} 00:00\n${bigBlock}`;
    }
    writeFileSync(join(cwd, '.wolf', 'memory.md'), `# Memory\n\n${body}`);
    const fakeCron = makeFakeCron(cwd, 0); // no-op cron; file is already "consolidated" in fixture form
    run('memory-consolidation', cwd, { WOLF_CRON_CMD: fakeCron });
    const archivePath = join(cwd, '.wolf', 'memory-archive.md');
    assert.equal(existsSync(archivePath), true);
    const archived = readFileSync(archivePath, 'utf8');
    assert.match(archived, /Consolidated session \(3 actions\)/);
  });
});
