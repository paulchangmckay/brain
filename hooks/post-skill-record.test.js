import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync, rmSync } from 'node:fs';
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

function markerPath(cwd, sessionId, skill) {
  return join(cwd, '.wolf', `_skill-gate-${sessionId}--${skill}.json`);
}

test('records the invoked skill as a marker file scoped to the session', () => {
  withTmpCwd((cwd) => {
    const result = run({
      session_id: 'sess-1',
      cwd,
      hook_event_name: 'PostToolUse',
      tool_name: 'Skill',
      tool_input: { skill: 'grilling' },
    });

    assert.equal(result.status, 0);
    assert.ok(existsSync(markerPath(cwd, 'sess-1', 'grilling')), 'marker file should be created');
  });
});

test('records multiple distinct skills as separate marker files', () => {
  withTmpCwd((cwd) => {
    run({ session_id: 'sess-2', cwd, tool_name: 'Skill', tool_input: { skill: 'brainstorming' } });
    run({ session_id: 'sess-2', cwd, tool_name: 'Skill', tool_input: { skill: 'grilling' } });

    assert.ok(existsSync(markerPath(cwd, 'sess-2', 'brainstorming')));
    assert.ok(existsSync(markerPath(cwd, 'sess-2', 'grilling')));
  });
});

test('keeps separate markers per session id', () => {
  withTmpCwd((cwd) => {
    run({ session_id: 'sess-a', cwd, tool_name: 'Skill', tool_input: { skill: 'grilling' } });
    run({ session_id: 'sess-b', cwd, tool_name: 'Skill', tool_input: { skill: 'writing-plans' } });

    assert.ok(existsSync(markerPath(cwd, 'sess-a', 'grilling')));
    assert.ok(!existsSync(markerPath(cwd, 'sess-a', 'writing-plans')));
    assert.ok(existsSync(markerPath(cwd, 'sess-b', 'writing-plans')));
  });
});

test('does nothing when session_id is missing', () => {
  withTmpCwd((cwd) => {
    const result = run({ cwd, tool_name: 'Skill', tool_input: { skill: 'grilling' } });
    assert.equal(result.status, 0);
    assert.ok(!existsSync(join(cwd, '.wolf')), 'no marker file should be created without a session id');
  });
});

test('does nothing on malformed JSON stdin', () => {
  withTmpCwd((cwd) => {
    const result = runRaw('{not valid json');
    assert.equal(result.status, 0);
  });
});

test('rejects a path-traversal-shaped session_id without writing outside .wolf', () => {
  withTmpCwd((cwd) => {
    const result = run({
      session_id: '../../../../tmp/evil',
      cwd,
      tool_name: 'Skill',
      tool_input: { skill: 'grilling' },
    });

    assert.equal(result.status, 0);
    // Nothing should have been written inside cwd/.wolf, and nothing should
    // exist outside the tmp cwd's own .wolf directory either.
    assert.ok(!existsSync(join(cwd, '.wolf')));
  });
});

test('rejects a path-traversal-shaped skill name without writing outside .wolf', () => {
  withTmpCwd((cwd) => {
    const result = run({
      session_id: 'sess-3',
      cwd,
      tool_name: 'Skill',
      tool_input: { skill: '../../evil' },
    });

    assert.equal(result.status, 0);
    if (existsSync(join(cwd, '.wolf'))) {
      const entries = readdirSync(join(cwd, '.wolf'));
      assert.ok(entries.every((e) => !e.includes('..')));
    }
  });
});

test('concurrent invocations for the same session and skill do not error or corrupt state', () => {
  withTmpCwd((cwd) => {
    const payload = { session_id: 'sess-4', cwd, tool_name: 'Skill', tool_input: { skill: 'grilling' } };
    const results = [run(payload), run(payload), run(payload)];
    for (const r of results) assert.equal(r.status, 0);
    assert.ok(existsSync(markerPath(cwd, 'sess-4', 'grilling')));
  });
});
