import { readFileSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync, statSync } from 'node:fs';

export function readMarker(markerPath) {
  if (!existsSync(markerPath)) return null;
  try {
    return JSON.parse(readFileSync(markerPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

export function writeMarker(markerPath, data) {
  writeFileSync(markerPath, JSON.stringify(data));
}

export function isStale(markerPath, thresholdMs, now = Date.now()) {
  const marker = readMarker(markerPath);
  if (!marker || !marker.lastRun) return true;
  const lastRunMs = Date.parse(marker.lastRun);
  if (Number.isNaN(lastRunMs)) return true;
  return now - lastRunMs > thresholdMs;
}

export function acquireLock(lockPath) {
  try {
    const fd = openSync(lockPath, 'wx');
    closeSync(fd);
    return true;
  } catch (_) {
    return false;
  }
}

export function releaseLock(lockPath) {
  try {
    unlinkSync(lockPath);
  } catch (_) {
    // already gone — nothing to do
  }
}

export function reapStaleLock(lockPath, maxAgeMs, now = Date.now()) {
  try {
    const stat = statSync(lockPath);
    if (now - stat.mtimeMs > maxAgeMs) {
      unlinkSync(lockPath);
    }
  } catch (_) {
    // missing or unstat-able — nothing to reap
  }
}
