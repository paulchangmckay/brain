import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./post-skill-record.js', import.meta.url));

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

test('records the invoked skill into the session-scoped state file', () => {
  withTmpCwd((cwd) => {
    const result = run({
      session_id: 'sess-1',
      cwd,
      hook_event_name: 'PostToolUse',
      tool_name: 'Skill',
      tool_input: { skill: 'grilling' },
    });

    assert.equal(result.status, 0);
    const statePath = join(cwd, '.wolf', '_skill-gate-sess-1.json');
    assert.ok(existsSync(statePath), 'state file should be created');
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.deepEqual(state.skills, ['grilling']);
  });
});

test('appends subsequent skill invocations to the same session file', () => {
  withTmpCwd((cwd) => {
    run({ session_id: 'sess-2', cwd, tool_name: 'Skill', tool_input: { skill: 'brainstorming' } });
    run({ session_id: 'sess-2', cwd, tool_name: 'Skill', tool_input: { skill: 'grilling' } });

    const statePath = join(cwd, '.wolf', '_skill-gate-sess-2.json');
    const state = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.deepEqual(state.skills, ['brainstorming', 'grilling']);
  });
});

test('keeps separate state files per session id', () => {
  withTmpCwd((cwd) => {
    run({ session_id: 'sess-a', cwd, tool_name: 'Skill', tool_input: { skill: 'grilling' } });
    run({ session_id: 'sess-b', cwd, tool_name: 'Skill', tool_input: { skill: 'writing-plans' } });

    const stateA = JSON.parse(readFileSync(join(cwd, '.wolf', '_skill-gate-sess-a.json'), 'utf8'));
    const stateB = JSON.parse(readFileSync(join(cwd, '.wolf', '_skill-gate-sess-b.json'), 'utf8'));
    assert.deepEqual(stateA.skills, ['grilling']);
    assert.deepEqual(stateB.skills, ['writing-plans']);
  });
});

test('does nothing when session_id is missing', () => {
  withTmpCwd((cwd) => {
    const result = run({ cwd, tool_name: 'Skill', tool_input: { skill: 'grilling' } });
    assert.equal(result.status, 0);
    assert.ok(!existsSync(join(cwd, '.wolf')), 'no state file should be created without a session id');
  });
});
