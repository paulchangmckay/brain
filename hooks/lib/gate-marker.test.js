import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readMarker,
  writeMarker,
  isStale,
  acquireLock,
  releaseLock,
  reapStaleLock,
} from './gate-marker.js';

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-marker-test-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('readMarker returns null when file does not exist', () => {
  withTmpDir((dir) => {
    assert.equal(readMarker(join(dir, 'missing.json')), null);
  });
});

test('writeMarker then readMarker round-trips', () => {
  withTmpDir((dir) => {
    const p = join(dir, 'marker.json');
    writeMarker(p, { lastRun: '2026-07-01T00:00:00.000Z' });
    assert.deepEqual(readMarker(p), { lastRun: '2026-07-01T00:00:00.000Z' });
  });
});

test('isStale is true when marker is missing', () => {
  withTmpDir((dir) => {
    assert.equal(isStale(join(dir, 'missing.json'), 1000), true);
  });
});

test('isStale is false when lastRun is within threshold', () => {
  withTmpDir((dir) => {
    const p = join(dir, 'marker.json');
    const now = Date.parse('2026-07-10T00:00:00.000Z');
    writeMarker(p, { lastRun: new Date(now - 500).toISOString() });
    assert.equal(isStale(p, 1000, now), false);
  });
});

test('isStale is true when lastRun exceeds threshold', () => {
  withTmpDir((dir) => {
    const p = join(dir, 'marker.json');
    const now = Date.parse('2026-07-10T00:00:00.000Z');
    writeMarker(p, { lastRun: new Date(now - 5000).toISOString() });
    assert.equal(isStale(p, 1000, now), true);
  });
});

test('acquireLock succeeds once, fails on second attempt, succeeds again after release', () => {
  withTmpDir((dir) => {
    const lockPath = join(dir, '_cron-gate.lock');
    assert.equal(acquireLock(lockPath), true);
    assert.equal(existsSync(lockPath), true);
    assert.equal(acquireLock(lockPath), false);
    releaseLock(lockPath);
    assert.equal(existsSync(lockPath), false);
    assert.equal(acquireLock(lockPath), true);
    releaseLock(lockPath);
  });
});

test('releaseLock does not throw when lock file is already gone', () => {
  withTmpDir((dir) => {
    assert.doesNotThrow(() => releaseLock(join(dir, 'never-created.lock')));
  });
});

test('reapStaleLock removes a lock older than maxAgeMs', () => {
  withTmpDir((dir) => {
    const lockPath = join(dir, '_cron-gate.lock');
    acquireLock(lockPath);
    const staleTime = new Date('2026-07-10T00:00:00.000Z');
    utimesSync(lockPath, staleTime, staleTime);
    const now = Date.parse('2026-07-10T00:11:00.000Z');
    reapStaleLock(lockPath, 10 * 60 * 1000, now);
    assert.equal(existsSync(lockPath), false);
  });
});

test('reapStaleLock leaves a lock alone when within maxAgeMs', () => {
  withTmpDir((dir) => {
    const lockPath = join(dir, '_cron-gate.lock');
    acquireLock(lockPath);
    const staleTime = new Date('2026-07-10T00:00:00.000Z');
    utimesSync(lockPath, staleTime, staleTime);
    const now = Date.parse('2026-07-10T00:05:00.000Z');
    reapStaleLock(lockPath, 10 * 60 * 1000, now);
    assert.equal(existsSync(lockPath), true);
    releaseLock(lockPath);
  });
});

test('reapStaleLock does nothing when the lock file does not exist', () => {
  withTmpDir((dir) => {
    assert.doesNotThrow(() => reapStaleLock(join(dir, 'missing.lock'), 1000));
  });
});
