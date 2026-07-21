import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./plugin-health-check-gate.sh', import.meta.url));

function run(claudeHome) {
  return spawnSync('bash', [SCRIPT], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: claudeHome },
    encoding: 'utf8',
  });
}

test('runs the check on first invocation and records a timestamp', () => {
  const home = mkdtempSync(join(tmpdir(), 'phcg-'));
  mkdirSync(join(home, 'scripts'), { recursive: true });
  const sentinelPath = join(home, 'ran.sentinel');
  writeFileSync(join(home, 'scripts/plugin-health-check.js'), `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(sentinelPath)}, 'ran');\n`);
  try {
    const result = run(home);
    assert.equal(result.status, 0);
    assert.ok(existsSync(sentinelPath), 'expected the health check to actually run on first invocation');
    const gateFile = join(home, '.wolf/_plugin-health-check-last-run');
    const timestamp = readFileSync(gateFile, 'utf8').trim();
    assert.ok(Number(timestamp) > 0);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('skips the check on a second invocation within 24h', () => {
  const home = mkdtempSync(join(tmpdir(), 'phcg-'));
  mkdirSync(join(home, '.wolf'), { recursive: true });
  mkdirSync(join(home, 'scripts'), { recursive: true });
  const sentinelPath = join(home, 'ran.sentinel');
  writeFileSync(join(home, 'scripts/plugin-health-check.js'), `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(sentinelPath)}, 'ran');\n`);
  writeFileSync(join(home, '.wolf/_plugin-health-check-last-run'), String(Math.floor(Date.now() / 1000)));
  try {
    const result = run(home);
    assert.equal(result.status, 0);
    assert.ok(!existsSync(sentinelPath), 'health check must NOT run within the 24h window — this is the property `|| true` could otherwise mask');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('self-heals from a corrupted (non-numeric) gate file instead of crashing', () => {
  const home = mkdtempSync(join(tmpdir(), 'phcg-'));
  mkdirSync(join(home, '.wolf'), { recursive: true });
  mkdirSync(join(home, 'scripts'), { recursive: true });
  writeFileSync(join(home, 'scripts/plugin-health-check.js'), '#!/usr/bin/env node\nconsole.log("ran");\n');
  writeFileSync(join(home, '.wolf/_plugin-health-check-last-run'), 'garbage-not-a-number');
  try {
    const result = run(home);
    assert.equal(result.status, 0, result.stderr);
    const gateFile = join(home, '.wolf/_plugin-health-check-last-run');
    const timestamp = readFileSync(gateFile, 'utf8').trim();
    assert.match(timestamp, /^[0-9]+$/, 'expected the gate file to self-heal with a fresh valid timestamp');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
