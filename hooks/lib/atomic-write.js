// Atomic JSON write: write to a randomly-named temp file, then rename over
// the target. A crash mid-write leaves the temp file orphaned, never a
// truncated target — safer than a plain writeFileSync under concurrent
// sessions writing the same state file.
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';

export function writeJSONAtomic(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, filePath);
}
