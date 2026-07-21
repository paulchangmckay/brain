import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./post-write-batch-nudge.js', import.meta.url));

function run(payload) {
  return spawnSync('node', [SCRIPT], { input: JSON.stringify(payload), encoding: 'utf8' });
}

function withTmpCwd(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'write-batch-nudge-test-'));
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function markerPath(cwd, sessionId) {
  return join(cwd, '.wolf', `_writecount-${sessionId}.json`);
}

test('does not nudge before 5 writes', () => {
  withTmpCwd((cwd) => {
    let result;
    for (let i = 0; i < 4; i += 1) {
      result = run({ session_id: 'sess-1', cwd, tool_name: 'Edit', tool_input: { file_path: `f${i}.js` } });
      assert.equal(result.stdout.trim(), '');
    }
    const marker = JSON.parse(readFileSync(markerPath(cwd, 'sess-1'), 'utf8'));
    assert.equal(marker.writesSinceLastObservation, 4);
  });
});

test('nudges on the 5th write and resets the counter', () => {
  withTmpCwd((cwd) => {
    let result;
    for (let i = 0; i < 5; i += 1) {
      result = run({ session_id: 'sess-1', cwd, tool_name: 'Edit', tool_input: { file_path: `f${i}.js` } });
    }
    const output = JSON.parse(result.stdout);
    assert.match(output.hookSpecificOutput.additionalContext, /observation log entry/);
    const marker = JSON.parse(readFileSync(markerPath(cwd, 'sess-1'), 'utf8'));
    assert.equal(marker.writesSinceLastObservation, 0);
  });
});

test('resets the counter when a new observation appears in the log', () => {
  withTmpCwd((cwd) => {
    for (let i = 0; i < 3; i += 1) {
      run({ session_id: 'sess-1', cwd, tool_name: 'Edit', tool_input: { file_path: `f${i}.js` } });
    }
    mkdirSync(join(cwd, '.wolf'), { recursive: true });
    writeFileSync(
      join(cwd, '.wolf', 'observations.md'),
      '# Skill Observation Log\n\n---\n\n### Observation 1: manual entry\n\n**Status:** OPEN\n',
    );
    run({ session_id: 'sess-1', cwd, tool_name: 'Edit', tool_input: { file_path: 'f-after.js' } });
    const marker = JSON.parse(readFileSync(markerPath(cwd, 'sess-1'), 'utf8'));
    assert.equal(marker.writesSinceLastObservation, 0);
    assert.equal(marker.lastKnownObservationCount, 1);
  });
});

test('exits 0 without a session_id', () => {
  withTmpCwd((cwd) => {
    const result = run({ cwd, tool_name: 'Edit' });
    assert.equal(result.status, 0);
    assert.equal(existsSync(join(cwd, '.wolf')), false);
  });
});
