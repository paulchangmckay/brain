import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./cerebrum-write-guard-post.js', import.meta.url));

function run(cwd, payload) {
  return spawnSync('node', [SCRIPT], { cwd, input: JSON.stringify(payload), encoding: 'utf8' });
}

function withTmpRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'cerebrum-guard-post-'));
  mkdirSync(join(cwd, '.wolf'), { recursive: true });
  const cerebrumPath = join(cwd, '.wolf', 'cerebrum.md');
  writeFileSync(cerebrumPath, '# cerebrum\n');
  try {
    fn({ cwd, cerebrumPath });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('records the current mtime as the marker baseline', () => {
  withTmpRepo(({ cwd, cerebrumPath }) => {
    run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });
    const markerPath = join(cwd, '.wolf', '_cerebrum-guard-sess-1.json');
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    assert.ok(typeof marker.mtime === 'number' && marker.mtime > 0);
  });
});

test('ignores files that are not cerebrum.md', () => {
  withTmpRepo(({ cwd }) => {
    const otherPath = join(cwd, '.wolf', 'memory.md');
    writeFileSync(otherPath, 'x');
    const result = run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: otherPath } });
    assert.equal(result.status, 0);
    const markerPath = join(cwd, '.wolf', '_cerebrum-guard-sess-1.json');
    assert.throws(() => readFileSync(markerPath, 'utf8'));
  });
});

test('does nothing when session_id is missing or invalid', () => {
  withTmpRepo(({ cwd, cerebrumPath }) => {
    const result = run(cwd, { cwd, tool_input: { file_path: cerebrumPath } });
    assert.equal(result.status, 0);
  });
});
