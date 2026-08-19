import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findRescuePath } from './post-read-failure-rescue.js';

const SCRIPT = fileURLToPath(new URL('./post-read-failure-rescue.js', import.meta.url));

const ANATOMY = [
  'src/auth/login.ts - Handles login (~120 tok)',
  'src/auth/logout.ts - Handles logout (~80 tok)',
  'src/utils/recheck.js - Retry helper (~40 tok)',
].join('\n');

test('unit: exactly one basename match returns that full path', () => {
  const result = findRescuePath(ANATOMY, '/wrong/dir/login.ts');
  assert.equal(result, 'src/auth/login.ts');
});

test('unit: zero basename matches returns null', () => {
  const result = findRescuePath(ANATOMY, '/wrong/dir/nonexistent.ts');
  assert.equal(result, null);
});

test('unit: basename substring collision does not false-match (check.js vs recheck.js)', () => {
  const result = findRescuePath(ANATOMY, '/wrong/dir/check.js');
  assert.equal(result, null);
});

function withProject(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'rescue-hook-test-'));
  mkdirSync(join(cwd, '.wolf'), { recursive: true });
  writeFileSync(join(cwd, '.wolf', 'anatomy.md'), ANATOMY);
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function runFailure(cwd, payload) {
  const result = spawnSync('node', [SCRIPT], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  const out = result.stdout.trim();
  return out ? JSON.parse(out) : null;
}

test('integration: ENOENT-style failure with a unique basename match emits additionalContext', () => {
  withProject((cwd) => {
    const output = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Read',
      tool_input: { file_path: '/wrong/dir/login.ts' },
      tool_error: 'ENOENT: no such file or directory',
    });
    assert.ok(output);
    assert.equal(output.hookSpecificOutput.hookEventName, 'PostToolUseFailure');
    assert.match(output.hookSpecificOutput.additionalContext, /src\/auth\/login\.ts/);
  });
});

test('integration: non-missing-path errors produce no output', () => {
  withProject((cwd) => {
    const output = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Read',
      tool_input: { file_path: '/some/dir/login.ts' },
      tool_error: 'EACCES: permission denied',
    });
    assert.equal(output, null);
  });
});

test('integration: Write tool failures produce no output regardless of error text', () => {
  withProject((cwd) => {
    const output = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: '/wrong/dir/login.ts' },
      tool_error: 'ENOENT: no such file or directory',
    });
    assert.equal(output, null);
  });
});

test('integration: Edit tool failures use the same rescue path as Read', () => {
  withProject((cwd) => {
    const output = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Edit',
      tool_input: { file_path: '/wrong/dir/logout.ts' },
      tool_error: 'ENOENT: no such file or directory',
    });
    assert.ok(output);
    assert.match(output.hookSpecificOutput.additionalContext, /src\/auth\/logout\.ts/);
  });
});
