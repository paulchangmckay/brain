import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJSONAtomic } from './atomic-write.js';

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'atomic-write-test-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('writes JSON that reads back identical', () => {
  withTmpDir((dir) => {
    const filePath = join(dir, 'state.json');
    writeJSONAtomic(filePath, { reads: [{ path: 'a.js', hash: 'abc' }] });
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.deepEqual(parsed, { reads: [{ path: 'a.js', hash: 'abc' }] });
  });
});

test('overwrites an existing file cleanly', () => {
  withTmpDir((dir) => {
    const filePath = join(dir, 'state.json');
    writeJSONAtomic(filePath, { reads: [] });
    writeJSONAtomic(filePath, { reads: [{ path: 'b.js', hash: 'def' }] });
    const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.deepEqual(parsed, { reads: [{ path: 'b.js', hash: 'def' }] });
  });
});

test('leaves no leftover .tmp files after a successful write', () => {
  withTmpDir((dir) => {
    const filePath = join(dir, 'state.json');
    writeJSONAtomic(filePath, { reads: [] });
    const leftovers = readdirSync(dir).filter((f) => f.endsWith('.tmp'));
    assert.deepEqual(leftovers, []);
    assert.equal(existsSync(filePath), true);
  });
});
