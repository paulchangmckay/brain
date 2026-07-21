import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./session-start.js', import.meta.url));

function runSessionStart(cwd, sessionId) {
  return spawnSync('node', [SCRIPT], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    input: JSON.stringify({ session_id: sessionId }),
    encoding: 'utf8',
  });
}

function withWolfDir(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'session-start-test-'));
  mkdirSync(join(cwd, '.wolf', 'hooks'), { recursive: true });
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('two sessions starting produce two separate session files, neither clobbering the other', () => {
  withWolfDir((cwd) => {
    runSessionStart(cwd, 'session-aaa');
    runSessionStart(cwd, 'session-bbb');

    const fileA = join(cwd, '.wolf', 'hooks', '_session-session-aaa.json');
    const fileB = join(cwd, '.wolf', 'hooks', '_session-session-bbb.json');
    assert.ok(existsSync(fileA), 'expected a session file scoped to session-aaa');
    assert.ok(existsSync(fileB), 'expected a session file scoped to session-bbb');

    const dataA = JSON.parse(readFileSync(fileA, 'utf8'));
    const dataB = JSON.parse(readFileSync(fileB, 'utf8'));
    assert.equal(dataA.session_id, 'session-aaa');
    assert.equal(dataB.session_id, 'session-bbb');
  });
});

test('falls back to the legacy shared filename when session_id is missing', () => {
  withWolfDir((cwd) => {
    runSessionStart(cwd, undefined);
    const legacyFile = join(cwd, '.wolf', 'hooks', '_session.json');
    assert.ok(existsSync(legacyFile));
  });
});
