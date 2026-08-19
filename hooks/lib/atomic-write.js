// Atomic JSON write: write to a randomly-named temp file, then rename over
// the target. A crash mid-write leaves the temp file orphaned, never a
// truncated target — safer than a plain writeFileSync under concurrent
// sessions writing the same state file.
import { writeFileSync, renameSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

export function writeJSONAtomic(filePath, data) {
  const tmpPath = `${filePath}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, filePath);
}
