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

function runRaw(rawStdin) {
  return spawnSync('node', [SCRIPT], { input: rawStdin, encoding: 'utf8' });
}

function withTmpCwd(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-gate-test-'));
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

function seedMarker(cwd, sessionId, skill) {
  const dir = join(cwd, '.wolf');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `_skill-gate-${sessionId}--${skill}.json`), '{}');
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
    seedMarker(cwd, 'sess-2', 'grilling');
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
    seedMarker(cwd, 'sess-3', 'grill-me');
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

test('blocks writing-plans when a marker exists for an unrelated skill only', () => {
  withTmpCwd((cwd) => {
    seedMarker(cwd, 'sess-5', 'brainstorming');
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

test('does not block on malformed JSON stdin', () => {
  const result = runRaw('{not valid json');
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('does not block when session_id is a path-traversal shape, even with a real grilling marker present elsewhere', () => {
  withTmpCwd((cwd) => {
    // A legitimate marker exists for a normal session...
    seedMarker(cwd, 'sess-6', 'grilling');
    // ...but the incoming session_id is traversal-shaped and must not be
    // used to escape into .wolf/ and find that unrelated marker.
    const result = run({
      session_id: '../../../../sess-6',
      cwd,
      tool_name: 'Skill',
      tool_input: { skill: 'writing-plans' },
    });

    assert.equal(result.status, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.decision, 'block');
  });
});
