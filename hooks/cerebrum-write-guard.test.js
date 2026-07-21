import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./cerebrum-write-guard.js', import.meta.url));

function run(cwd, payload) {
  return spawnSync('node', [SCRIPT], { cwd, input: JSON.stringify(payload), encoding: 'utf8' });
}

function runPost(cwd, payload) {
  const POST_SCRIPT = fileURLToPath(new URL('./cerebrum-write-guard-post.js', import.meta.url));
  return spawnSync('node', [POST_SCRIPT], { cwd, input: JSON.stringify(payload), encoding: 'utf8' });
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
    // Simulate the PostToolUse companion committing the baseline after this
    // session's own edit lands (the PreToolUse guard no longer writes the
    // marker itself — see cerebrum-write-guard-post.js).
    runPost(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });

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

test('does not warn on this session\'s own sequential edits (the bug this fix prevents)', () => {
  withTmpRepo(({ cwd, cerebrumPath }) => {
    // First touch: pre-check (silent, no marker yet), then the edit "lands"
    // and the post-hook commits the baseline — this simulates one full
    // Edit/Write cycle for this session.
    const first = run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });
    assert.equal(first.stdout.trim(), '');
    writeFileSync(cerebrumPath, '# cerebrum\nfirst edit\n');
    runPost(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });

    // Second touch, same session: pre-check should stay silent, since the
    // only mtime change since the last recorded baseline was this same
    // session's own first edit, already committed by the post-hook above.
    const second = run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });
    assert.equal(second.stdout.trim(), '', 'must not warn on the session\'s own prior edit');
  });
});

test('the PreToolUse hook itself never writes the marker file (true regression guard for the post-edit-mtime fix)', () => {
  withTmpRepo(({ cwd, cerebrumPath }) => {
    const markerPath = join(cwd, '.wolf', '_cerebrum-guard-sess-1.json');
    run(cwd, { cwd, session_id: 'sess-1', tool_input: { file_path: cerebrumPath } });
    assert.ok(!existsSync(markerPath), 'PreToolUse hook must not create the marker file itself — only the PostToolUse companion (cerebrum-write-guard-post.js) should write it');
  });
});
