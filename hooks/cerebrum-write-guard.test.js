import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./cerebrum-write-guard.js', import.meta.url));

function run(cwd, payload) {
  return spawnSync('node', [SCRIPT], { cwd, input: JSON.stringify(payload), encoding: 'utf8' });
}

function withTmpRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'cerebrum-guard-'));
  mkdirSync(join(cwd, '.wolf'), { recursive: true });
  const cerebrumPath = join(cwd, '.wolf', 'cerebrum.md');
  writeFileSync(cerebrumPath, '# cerebrum\n');
  try {
    fn({ cwd, cerebrumPath });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('stays silent the first time this session touches cerebrum.md', () => {
  withTmpRepo(({ cwd, cerebrumPath }) => {
    const result = run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });
    assert.equal(result.stdout.trim(), '');
  });
});

test('warns when cerebrum.md changed on disk since this session last touched it', () => {
  withTmpRepo(({ cwd, cerebrumPath }) => {
    run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });
    // Simulate another session writing to cerebrum.md afterward.
    const future = new Date(Date.now() + 5000);
    writeFileSync(cerebrumPath, '# cerebrum\nnew entry\n');
    utimesSync(cerebrumPath, future, future);

    const result = run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });
    const output = JSON.parse(result.stdout);
    assert.match(output.hookSpecificOutput.additionalContext, /changed on disk since this session/);
  });
});

test('ignores files that are not cerebrum.md', () => {
  withTmpRepo(({ cwd }) => {
    const result = run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: join(cwd, '.wolf', 'memory.md') } });
    assert.equal(result.stdout.trim(), '');
  });
});
