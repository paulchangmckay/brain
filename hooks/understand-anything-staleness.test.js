import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readMeta, countCommitsBehind } from './understand-anything-staleness.js';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'understand-staleness-test-'));
}

test('readMeta returns null when .understand-anything/meta.json does not exist', () => {
  const cwd = makeTempDir();
  try {
    assert.equal(readMeta(cwd), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('readMeta returns null when meta.json is not valid JSON', () => {
  const cwd = makeTempDir();
  try {
    mkdirSync(join(cwd, '.understand-anything'));
    writeFileSync(join(cwd, '.understand-anything', 'meta.json'), 'not json{');
    assert.equal(readMeta(cwd), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('readMeta returns the parsed object for valid JSON', () => {
  const cwd = makeTempDir();
  try {
    mkdirSync(join(cwd, '.understand-anything'));
    writeFileSync(
      join(cwd, '.understand-anything', 'meta.json'),
      JSON.stringify({ gitCommitHash: 'abc123', analyzedFiles: 5 })
    );
    assert.deepEqual(readMeta(cwd), { gitCommitHash: 'abc123', analyzedFiles: 5 });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function initGitRepo(dir) {
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
}

function commitAll(dir, message) {
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', message], { cwd: dir });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
}

test('countCommitsBehind returns the correct count against a real git repo', () => {
  const cwd = makeTempDir();
  try {
    initGitRepo(cwd);
    writeFileSync(join(cwd, 'a.txt'), '1');
    const firstHash = commitAll(cwd, 'first');
    writeFileSync(join(cwd, 'a.txt'), '2');
    commitAll(cwd, 'second');
    writeFileSync(join(cwd, 'a.txt'), '3');
    commitAll(cwd, 'third');
    assert.equal(countCommitsBehind(cwd, firstHash), 2);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('countCommitsBehind returns 0 when the hash is HEAD itself', () => {
  const cwd = makeTempDir();
  try {
    initGitRepo(cwd);
    writeFileSync(join(cwd, 'a.txt'), '1');
    const headHash = commitAll(cwd, 'only commit');
    assert.equal(countCommitsBehind(cwd, headHash), 0);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('countCommitsBehind returns null for a non-git directory', () => {
  const cwd = makeTempDir();
  try {
    assert.equal(countCommitsBehind(cwd, 'deadbeef'), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('countCommitsBehind returns null for an unreachable commit hash', () => {
  const cwd = makeTempDir();
  try {
    initGitRepo(cwd);
    writeFileSync(join(cwd, 'a.txt'), '1');
    commitAll(cwd, 'only commit');
    // A fake hash that was never a real commit — git's "bad revision" error
    // is identical whether a hash never existed or was rewritten out of
    // history, so this exercises the same failure path as a post-rebase hash.
    const fakeHash = '0'.repeat(40);
    assert.equal(countCommitsBehind(cwd, fakeHash), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

import { formatStalenessMessage } from './understand-anything-staleness.js';

test('formatStalenessMessage returns null when commitsBehind is at or under threshold', () => {
  assert.equal(formatStalenessMessage({ commitsBehind: 10, threshold: 10, cwd: '/x' }), null);
  assert.equal(formatStalenessMessage({ commitsBehind: 3, threshold: 10, cwd: '/x' }), null);
});

test('formatStalenessMessage returns a message mentioning the commit count when over threshold', () => {
  const msg = formatStalenessMessage({ commitsBehind: 14, threshold: 10, cwd: '/Users/paulmckay/.claude' });
  assert.match(msg, /14 commits behind/);
  assert.match(msg, /\/understand-anything:understand/);
});

test('formatStalenessMessage double-quotes a cwd containing spaces', () => {
  const msg = formatStalenessMessage({
    commitsBehind: 14,
    threshold: 10,
    cwd: '/Users/paulmckay/Desktop/NHL Stats Project',
  });
  assert.match(msg, /"\/Users\/paulmckay\/Desktop\/NHL Stats Project"/);
});

import { checkStaleness } from './understand-anything-staleness.js';

test('checkStaleness returns null when there is no .understand-anything directory', () => {
  const cwd = makeTempDir();
  try {
    initGitRepo(cwd);
    writeFileSync(join(cwd, 'a.txt'), '1');
    commitAll(cwd, 'only commit');
    assert.equal(checkStaleness(cwd), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('checkStaleness returns null when the graph is fresh (at or under threshold)', () => {
  const cwd = makeTempDir();
  try {
    initGitRepo(cwd);
    writeFileSync(join(cwd, 'a.txt'), '1');
    const headHash = commitAll(cwd, 'only commit');
    mkdirSync(join(cwd, '.understand-anything'));
    writeFileSync(
      join(cwd, '.understand-anything', 'meta.json'),
      JSON.stringify({ gitCommitHash: headHash })
    );
    assert.equal(checkStaleness(cwd, 10), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('checkStaleness returns a message when the graph is more than threshold commits behind', () => {
  const cwd = makeTempDir();
  try {
    initGitRepo(cwd);
    writeFileSync(join(cwd, 'a.txt'), '0');
    const oldHash = commitAll(cwd, 'commit 0');
    mkdirSync(join(cwd, '.understand-anything'));
    writeFileSync(
      join(cwd, '.understand-anything', 'meta.json'),
      JSON.stringify({ gitCommitHash: oldHash })
    );
    for (let i = 1; i <= 5; i++) {
      writeFileSync(join(cwd, 'a.txt'), String(i));
      commitAll(cwd, `commit ${i}`);
    }
    // threshold of 3 with 5 new commits since oldHash — over threshold
    const msg = checkStaleness(cwd, 3);
    assert.match(msg, /5 commits behind/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
