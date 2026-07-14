import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./pre-skill-gate.js', import.meta.url));

function run(payload) {
  return spawnSync('node', [SCRIPT], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
}

function withTmpCwd(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-gate-test-'));
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function seedState(cwd, sessionId, skills) {
  const dir = join(cwd, '.wolf');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `_skill-gate-${sessionId}.json`), JSON.stringify({ skills }));
}

test('blocks writing-plans when grilling has not run this session', () => {
  withTmpCwd((cwd) => {
    const result = run({
      session_id: 'sess-1',
      cwd,
      tool_name: 'Skill',
      tool_input: { skill: 'writing-plans' },
    });

    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /grilling/i);
  });
});

test('allows writing-plans when grilling already ran this session', () => {
  withTmpCwd((cwd) => {
    seedState(cwd, 'sess-2', ['brainstorming', 'grilling']);
    const result = run({
      session_id: 'sess-2',
      cwd,
      tool_name: 'Skill',
      tool_input: { skill: 'writing-plans' },
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
  });
});

test('allows writing-plans when grill-me already ran this session', () => {
  withTmpCwd((cwd) => {
    seedState(cwd, 'sess-3', ['grill-me']);
    const result = run({
      session_id: 'sess-3',
      cwd,
      tool_name: 'Skill',
      tool_input: { skill: 'writing-plans' },
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
  });
});

test('never blocks skills other than writing-plans', () => {
  withTmpCwd((cwd) => {
    const result = run({
      session_id: 'sess-4',
      cwd,
      tool_name: 'Skill',
      tool_input: { skill: 'brainstorming' },
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), '');
  });
});

test('blocks writing-plans when state file exists but has no grilling entry', () => {
  withTmpCwd((cwd) => {
    seedState(cwd, 'sess-5', ['brainstorming']);
    const result = run({
      session_id: 'sess-5',
      cwd,
      tool_name: 'Skill',
      tool_input: { skill: 'writing-plans' },
    });

    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.decision, 'block');
  });
});
