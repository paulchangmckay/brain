import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./adhd-caveman.js', import.meta.url));

function withTmpConfigDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'adhd-caveman-test-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runWithEnv(env) {
  return spawnSync('node', [SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

test('outputs nothing and exits 0 when the flag file does not exist', () => {
  withTmpConfigDir((configDir) => {
    const { stdout, status } = runWithEnv({ CLAUDE_CONFIG_DIR: configDir });
    assert.equal(status, 0);
    assert.equal(stdout, '');
  });
});

test('emits valid JSON with hookSpecificOutput.additionalContext when flag file exists', () => {
  withTmpConfigDir((configDir) => {
    writeFileSync(join(configDir, '.i-have-adhd-always'), '');
    const { stdout, status } = runWithEnv({ CLAUDE_CONFIG_DIR: configDir });
    assert.equal(status, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
    assert.match(parsed.hookSpecificOutput.additionalContext, /ADHD-CAVEMAN MODE ACTIVE/);
  });
});

test('strips frontmatter from the overridden ADHD skill body and includes it plus the lexicon body', () => {
  withTmpConfigDir((configDir) => {
    writeFileSync(join(configDir, '.i-have-adhd-always'), '');
    const skillFixture = join(configDir, 'fixture-skill.md');
    writeFileSync(skillFixture, '---\nname: fixture\n---\nFIXTURE ADHD BODY TEXT\n');
    const { stdout } = runWithEnv({
      CLAUDE_CONFIG_DIR: configDir,
      ADHD_CAVEMAN_SKILL_PATH_OVERRIDE: skillFixture,
    });
    const parsed = JSON.parse(stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    assert.match(ctx, /FIXTURE ADHD BODY TEXT/);
    assert.doesNotMatch(ctx, /name: fixture/);
    assert.match(ctx, /caveman-lexicon/);
    assert.match(ctx, /Byte-exact floor/);
  });
});

test('falls back to a not-found note when the overridden skill path does not exist, without crashing', () => {
  withTmpConfigDir((configDir) => {
    writeFileSync(join(configDir, '.i-have-adhd-always'), '');
    const { stdout, status } = runWithEnv({
      CLAUDE_CONFIG_DIR: configDir,
      ADHD_CAVEMAN_SKILL_PATH_OVERRIDE: join(configDir, 'does-not-exist.md'),
    });
    assert.equal(status, 0);
    const parsed = JSON.parse(stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    assert.match(ctx, /SKILL\.md not found/);
    assert.match(ctx, /Byte-exact floor/);
  });
});

test('mentions all three toggle phrases in the wrapper text', () => {
  withTmpConfigDir((configDir) => {
    writeFileSync(join(configDir, '.i-have-adhd-always'), '');
    const { stdout } = runWithEnv({ CLAUDE_CONFIG_DIR: configDir });
    const parsed = JSON.parse(stdout);
    const ctx = parsed.hookSpecificOutput.additionalContext;
    assert.match(ctx, /stop adhd mode/);
    assert.match(ctx, /stop caveman mode/);
    assert.match(ctx, /normal mode/);
  });
});
