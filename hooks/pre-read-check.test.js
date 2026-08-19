import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./pre-read-check.js', import.meta.url));

function withProject(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'pre-read-check-test-'));
  mkdirSync(join(cwd, '.wolf'), { recursive: true });
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function runRead(cwd, filePath) {
  const result = spawnSync('node', [SCRIPT], {
    cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    input: JSON.stringify({
      session_id: 'test-session',
      cwd,
      tool_name: 'Read',
      tool_input: { file_path: filePath },
    }),
    encoding: 'utf8',
  });
  const out = result.stdout.trim();
  return out ? JSON.parse(out) : {};
}

test('first read of a file is always allowed', () => {
  withProject((cwd) => {
    const target = join(cwd, 'a.js');
    writeFileSync(target, 'console.log(1);\n');
    const result = runRead(cwd, target);
    assert.equal(result.decision, undefined);
  });
});

test('immediate re-read of unchanged content is blocked', () => {
  withProject((cwd) => {
    const target = join(cwd, 'a.js');
    writeFileSync(target, 'console.log(1);\n');
    runRead(cwd, target);
    const second = runRead(cwd, target);
    assert.equal(second.decision, 'block');
  });
});

test('re-read after the file changes is allowed', () => {
  withProject((cwd) => {
    const target = join(cwd, 'a.js');
    writeFileSync(target, 'console.log(1);\n');
    runRead(cwd, target);
    writeFileSync(target, 'console.log(2);\n');
    const second = runRead(cwd, target);
    assert.equal(second.decision, undefined);
  });
});

test('a blocked read is allowed on its immediate retry, then blocks again on the third attempt', () => {
  withProject((cwd) => {
    const target = join(cwd, 'a.js');
    writeFileSync(target, 'console.log(1);\n');
    runRead(cwd, target); // 1st: allowed, recorded
    const blocked = runRead(cwd, target); // 2nd: blocked
    assert.equal(blocked.decision, 'block');
    const retried = runRead(cwd, target); // 3rd: retry-override, allowed
    assert.equal(retried.decision, undefined);
    const thirdBlock = runRead(cwd, target); // 4th: blocked again (override consumed)
    assert.equal(thirdBlock.decision, 'block');
  });
});

test('two different files being blocked in sequence do not clobber each other\'s retry override', () => {
  withProject((cwd) => {
    const a = join(cwd, 'a.js');
    const b = join(cwd, 'b.js');
    writeFileSync(a, 'console.log("a");\n');
    writeFileSync(b, 'console.log("b");\n');
    runRead(cwd, a); // a: 1st read
    runRead(cwd, b); // b: 1st read
    const aBlocked = runRead(cwd, a); // a: blocked
    assert.equal(aBlocked.decision, 'block');
    const bBlocked = runRead(cwd, b); // b: blocked (a's override must survive this)
    assert.equal(bBlocked.decision, 'block');
    const aRetry = runRead(cwd, a); // a: retry-override should still apply
    assert.equal(aRetry.decision, undefined);
  });
});

test('a file over the hash-size limit falls back to mtime comparison without crashing', () => {
  withProject((cwd) => {
    const target = join(cwd, 'big.bin');
    writeFileSync(target, Buffer.alloc(6 * 1024 * 1024)); // 6MB, over the 5MB limit
    runRead(cwd, target);
    const second = runRead(cwd, target);
    assert.equal(second.decision, 'block');
  });
});

test('session file with no prior state is treated as a fresh session', () => {
  withProject((cwd) => {
    const target = join(cwd, 'a.js');
    writeFileSync(target, 'console.log(1);\n');
    const sessionPath = join(cwd, '.wolf', '_session.json');
    writeFileSync(sessionPath, JSON.stringify({ reads: [] }));
    const result = runRead(cwd, target);
    assert.equal(result.decision, undefined);
    const state = JSON.parse(readFileSync(sessionPath, 'utf8'));
    assert.equal(state.reads.length, 1);
  });
});
