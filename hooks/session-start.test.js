import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./session-start.sh', import.meta.url));

function runWithCwd(cwd) {
  return spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CWD: cwd },
  });
}

function withTmpCwd(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'session-start-test-'));
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('session-start.sh emits valid JSON on stdout', () => {
  withTmpCwd((cwd) => {
    const { stdout, status } = runWithCwd(cwd);
    assert.equal(status, 0);
    assert.doesNotThrow(() => JSON.parse(stdout));
  });
});

test('session-start.sh preserves the literal skill-tool example text in additionalContext', () => {
  withTmpCwd((cwd) => {
    const { stdout } = runWithCwd(cwd);
    const parsed = JSON.parse(stdout);
    assert.match(
      parsed.hookSpecificOutput.additionalContext,
      /Invoke with the Skill tool: \{ "skill": "<name>" \}/
    );
  });
});
