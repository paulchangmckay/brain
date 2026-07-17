import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./subagent-thin-harness.js', import.meta.url));

function run(payload, env = {}) {
  return spawnSync('node', [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function withTmpDigest(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'subagent-digest-test-'));
  const path = join(dir, 'digest.md');
  writeFileSync(path, content);
  try {
    fn(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('injects the digest for a general-purpose subagent', () => {
  withTmpDigest('TEST DIGEST CONTENT', (digestPath) => {
    const result = run(
      { agent_type: 'general-purpose' },
      { WOLF_SUBAGENT_DIGEST_PATH: digestPath },
    );
    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, 'SubagentStart');
    assert.equal(out.hookSpecificOutput.additionalContext, 'TEST DIGEST CONTENT');
  });
});

test('skips injection for Explore', () => {
  const result = run({ agent_type: 'Explore' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('skips injection for understand-anything analyzer types', () => {
  const result = run({ agent_type: 'understand-anything:file-analyzer' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('injects for a plugin-namespaced agent type', () => {
  withTmpDigest('X', (digestPath) => {
    const result = run(
      { agent_type: 'plugin:name' },
      { WOLF_SUBAGENT_DIGEST_PATH: digestPath },
    );
    const out = JSON.parse(result.stdout);
    assert.equal(out.hookSpecificOutput.additionalContext, 'X');
  });
});

test('fails open (injects) on malformed JSON stdin', () => {
  const result = spawnSync('node', [SCRIPT], { input: '{not valid json', encoding: 'utf8' });
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  assert.ok(out.hookSpecificOutput.additionalContext.length > 0);
});

test('falls back to the hardcoded digest when the digest file is missing', () => {
  const result = run(
    { agent_type: 'general-purpose' },
    { WOLF_SUBAGENT_DIGEST_PATH: '/no/such/file.md' },
  );
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  assert.match(out.hookSpecificOutput.additionalContext, /wolf-debt:/);
});
