import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./pre-principles-injection.js', import.meta.url));

function run(payload) {
  return spawnSync('node', [SCRIPT], { input: JSON.stringify(payload), encoding: 'utf8' });
}

function withTmpCwd(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'pre-principles-test-'));
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('injects principles content when editing a SKILL.md path', () => {
  withTmpCwd((cwd) => {
    mkdirSync(join(cwd, '.wolf'), { recursive: true });
    writeFileSync(
      join(cwd, '.wolf', 'cross-cutting-principles.md'),
      '# Cross-Cutting Principles\n\n## Active Principles\n\n### 1. Example principle\n**Requirement:** do the thing\n',
    );

    const result = run({
      cwd,
      tool_name: 'Edit',
      tool_input: { file_path: 'skills/grilling/SKILL.md' },
    });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.match(output.hookSpecificOutput.additionalContext, /Example principle/);
  });
});

test('does nothing for a non-SKILL.md file', () => {
  withTmpCwd((cwd) => {
    mkdirSync(join(cwd, '.wolf'), { recursive: true });
    writeFileSync(
      join(cwd, '.wolf', 'cross-cutting-principles.md'),
      '# Cross-Cutting Principles\n\n### 1. Example\n**Requirement:** x\n',
    );
    const result = run({ cwd, tool_name: 'Edit', tool_input: { file_path: 'src/index.js' } });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
  });
});

test('does nothing when the principles file has no content yet', () => {
  withTmpCwd((cwd) => {
    mkdirSync(join(cwd, '.wolf'), { recursive: true });
    writeFileSync(
      join(cwd, '.wolf', 'cross-cutting-principles.md'),
      '# Cross-Cutting Principles\n\n## Active Principles\n\n(none yet)\n',
    );
    const result = run({ cwd, tool_name: 'Write', tool_input: { file_path: 'skills/new-skill/SKILL.md' } });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
  });
});

test('does nothing when the principles file does not exist', () => {
  withTmpCwd((cwd) => {
    const result = run({ cwd, tool_name: 'Write', tool_input: { file_path: 'skills/new-skill/SKILL.md' } });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
  });
});
