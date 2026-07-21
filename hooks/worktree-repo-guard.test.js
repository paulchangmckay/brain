import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = fileURLToPath(new URL('./worktree-repo-guard.js', import.meta.url));
const PRIMARY_REPO = join(homedir(), '.claude');

function run(payload) {
  return spawnSync('node', [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

test('blocks EnterWorktree when cwd is not the primary repo', () => {
  const result = run({ cwd: '/tmp/some-other-project' });
  const output = JSON.parse(result.stdout);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /EnterWorktree always targets/);
});

test('allows EnterWorktree when cwd is the primary repo', () => {
  const result = run({ cwd: PRIMARY_REPO });
  assert.equal(result.stdout.trim(), '');
});

test('allows EnterWorktree when cwd normalizes to the primary repo', () => {
  const result = run({ cwd: join(PRIMARY_REPO, 'skills', '..') });
  assert.equal(result.stdout.trim(), '');
});
