import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = fileURLToPath(new URL('./worktree-path-guard.js', import.meta.url));

function run(payload) {
  return spawnSync('node', [SCRIPT], { input: JSON.stringify(payload), encoding: 'utf8' });
}

function withWorktree(fn) {
  const main = mkdtempSync(join(tmpdir(), 'wpg-main-'));
  execFileSync('git', ['-C', main, 'init', '-q']);
  execFileSync('git', ['-C', main, 'config', 'user.email', 'a@b.c']);
  execFileSync('git', ['-C', main, 'config', 'user.name', 'test']);
  writeFileSync(join(main, 'README.md'), 'x');
  execFileSync('git', ['-C', main, 'add', '.']);
  execFileSync('git', ['-C', main, 'commit', '-q', '-m', 'init']);
  const wtPath = join(main, '..', 'wt-branch');
  execFileSync('git', ['-C', main, 'worktree', 'add', '-q', '-b', 'feature', wtPath]);
  try {
    fn({ main, wtPath });
  } finally {
    rmSync(wtPath, { recursive: true, force: true });
    rmSync(main, { recursive: true, force: true });
  }
}

test('warns on an absolute-path edit that escapes the active worktree', () => {
  withWorktree(({ main, wtPath }) => {
    const escapingFile = join(main, 'CLAUDE.md');
    const result = run({ cwd: wtPath, tool_input: { file_path: escapingFile } });
    const output = JSON.parse(result.stdout);
    assert.match(output.hookSpecificOutput.additionalContext, /outside the active worktree/);
  });
});

test('stays silent for an absolute-path edit inside the active worktree', () => {
  withWorktree(({ wtPath }) => {
    const insideFile = join(wtPath, 'notes.md');
    const result = run({ cwd: wtPath, tool_input: { file_path: insideFile } });
    assert.equal(result.stdout.trim(), '');
  });
});

test('stays silent when not inside a worktree at all', () => {
  withWorktree(({ main }) => {
    const result = run({ cwd: main, tool_input: { file_path: join(main, 'README.md') } });
    assert.equal(result.stdout.trim(), '');
  });
});
