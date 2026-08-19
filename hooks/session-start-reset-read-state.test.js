import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetReadState } from './session-start-reset-read-state.js';

function withProject(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'session-reset-test-'));
  mkdirSync(join(cwd, '.wolf'), { recursive: true });
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('resets an existing _session.json with stale reads to empty', () => {
  withProject((cwd) => {
    const sessionPath = join(cwd, '.wolf', '_session.json');
    writeFileSync(sessionPath, JSON.stringify({
      reads: [{ path: 'old.js', hash: 'stale', blockedLastAttempt: true }]
    }));
    resetReadState(cwd);
    const state = JSON.parse(readFileSync(sessionPath, 'utf8'));
    assert.deepEqual(state, { reads: [] });
  });
});

test('creates _session.json fresh if it does not exist yet', () => {
  withProject((cwd) => {
    const sessionPath = join(cwd, '.wolf', '_session.json');
    assert.equal(existsSync(sessionPath), false);
    resetReadState(cwd);
    assert.equal(existsSync(sessionPath), true);
    const state = JSON.parse(readFileSync(sessionPath, 'utf8'));
    assert.deepEqual(state, { reads: [] });
  });
});

test('does nothing if .wolf/ directory does not exist (non-OpenWolf project)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'session-reset-nowolf-'));
  try {
    resetReadState(cwd);
    assert.equal(existsSync(join(cwd, '.wolf')), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
