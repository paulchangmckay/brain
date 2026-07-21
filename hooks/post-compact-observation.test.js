import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./post-compact-observation.js', import.meta.url));

function run(payload) {
  return spawnSync('node', [SCRIPT], { input: JSON.stringify(payload), encoding: 'utf8' });
}

function withTmpCwd(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'post-compact-obs-test-'));
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('creates one OPEN compaction-checkpoint entry on first compaction', () => {
  withTmpCwd((cwd) => {
    const result = run({ session_id: 'sess-1', cwd, hook_event_name: 'PostCompact' });
    assert.equal(result.status, 0, result.stderr);
    const logPath = join(cwd, '.wolf', 'observations.md');
    assert.ok(existsSync(logPath));
    const content = readFileSync(logPath, 'utf8');
    assert.match(content, /\*\*Type:\*\* compaction-checkpoint/);
    assert.match(content, /\*\*Session:\*\* sess-1/);
    assert.match(content, /\*\*Status:\*\* OPEN/);
  });
});

test('does not create a second entry for a second compaction in the same session', () => {
  withTmpCwd((cwd) => {
    run({ session_id: 'sess-1', cwd });
    run({ session_id: 'sess-1', cwd });
    const content = readFileSync(join(cwd, '.wolf', 'observations.md'), 'utf8');
    const matches = [...content.matchAll(/### Observation \d+:/g)];
    assert.equal(matches.length, 1);
  });
});

test('creates a separate entry for a different session', () => {
  withTmpCwd((cwd) => {
    run({ session_id: 'sess-1', cwd });
    run({ session_id: 'sess-2', cwd });
    const content = readFileSync(join(cwd, '.wolf', 'observations.md'), 'utf8');
    const matches = [...content.matchAll(/### Observation \d+:/g)];
    assert.equal(matches.length, 2);
  });
});

test('exits 0 and writes nothing without a session_id', () => {
  withTmpCwd((cwd) => {
    const result = run({ cwd });
    assert.equal(result.status, 0);
    assert.equal(existsSync(join(cwd, '.wolf', 'observations.md')), false);
  });
});
