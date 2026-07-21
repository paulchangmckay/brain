import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./submodule-transfer.sh', import.meta.url));

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

test('transfers a commit from one submodule clone to another via a named branch', () => {
  const base = mkdtempSync(join(tmpdir(), 'submodule-transfer-'));
  const sourceClone = join(base, 'source-clone');
  const targetClone = join(base, 'target-clone');
  try {
    execFileSync('git', ['init', '-q', sourceClone]);
    git(sourceClone, 'config', 'user.email', 'a@b.c');
    git(sourceClone, 'config', 'user.name', 'test');
    writeFileSync(join(sourceClone, 'file.txt'), 'v1');
    git(sourceClone, 'add', '.');
    git(sourceClone, 'commit', '-q', '-m', 'initial');

    execFileSync('git', ['clone', '-q', sourceClone, targetClone]);

    writeFileSync(join(sourceClone, 'file.txt'), 'v2');
    git(sourceClone, 'add', '.');
    git(sourceClone, 'commit', '-q', '-m', 'new commit');
    const newSha = git(sourceClone, 'rev-parse', 'HEAD').trim();

    const result = spawnSync('bash', [SCRIPT, '.', sourceClone, newSha], {
      cwd: targetClone,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const branchName = `transfer-${newSha.slice(0, 12)}`;
    const targetBranchSha = git(targetClone, 'rev-parse', branchName).trim();
    assert.equal(targetBranchSha, newSha);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('errors with a usage message when arguments are missing', () => {
  const result = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});
