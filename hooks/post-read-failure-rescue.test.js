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
  '## src/auth/',
  '',
  '- `login.ts` — Handles login (~120 tok)',
  '- `logout.ts` — Handles logout (~80 tok)',
  '',
  '## src/utils/',
  '',
  '- `recheck.js` — Retry helper (~40 tok)',
].join('\n');

const ANATOMY_WITH_DUPES = [
  '## src/auth/',
  '',
  '- `login.ts` — Handles login (~120 tok)',
  '',
  '## src/legacy/',
  '',
  '- `login.ts` — Old login, kept for reference (~50 tok)',
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

test('unit: basename exists under two different headers returns null', () => {
  const result = findRescuePath(ANATOMY_WITH_DUPES, '/wrong/dir/login.ts');
  assert.equal(result, null);
});

function withProject(fn, { createTargetFiles = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'rescue-hook-test-'));
  mkdirSync(join(cwd, '.wolf'), { recursive: true });
  writeFileSync(join(cwd, '.wolf', 'anatomy.md'), ANATOMY);
  if (createTargetFiles) {
    mkdirSync(join(cwd, 'src', 'auth'), { recursive: true });
    mkdirSync(join(cwd, 'src', 'utils'), { recursive: true });
    writeFileSync(join(cwd, 'src', 'auth', 'login.ts'), '// login\n');
    writeFileSync(join(cwd, 'src', 'auth', 'logout.ts'), '// logout\n');
    writeFileSync(join(cwd, 'src', 'utils', 'recheck.js'), '// recheck\n');
  }
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function runFailure(cwd, payload) {
  return spawnSync('node', [SCRIPT], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

test('integration: ENOENT-style failure with a unique, existing basename match writes to stderr and exits 2', () => {
  withProject((cwd) => {
    const result = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Read',
      tool_input: { file_path: '/wrong/dir/login.ts' },
      error: 'ENOENT: no such file or directory',
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /src\/auth\/login\.ts/);
    assert.equal(result.stdout, '');
  });
});

test('integration: non-missing-path errors produce no output', () => {
  withProject((cwd) => {
    const result = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Read',
      tool_input: { file_path: '/some/dir/login.ts' },
      error: 'EACCES: permission denied',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('integration: Write tool failures produce no output regardless of error text', () => {
  withProject((cwd) => {
    const result = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: '/wrong/dir/login.ts' },
      error: 'ENOENT: no such file or directory',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  });
});

test('integration: Edit tool failures use the same rescue path as Read', () => {
  withProject((cwd) => {
    const result = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Edit',
      tool_input: { file_path: '/wrong/dir/logout.ts' },
      error: 'ENOENT: no such file or directory',
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /src\/auth\/logout\.ts/);
  });
});

test('integration: a unique basename match that does not exist on disk produces no output', () => {
  withProject((cwd) => {
    const result = runFailure(cwd, {
      session_id: 'test-session',
      cwd,
      tool_name: 'Read',
      tool_input: { file_path: '/wrong/dir/login.ts' },
      error: 'ENOENT: no such file or directory',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
  }, { createTargetFiles: false });
});
