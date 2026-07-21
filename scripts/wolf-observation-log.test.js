import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath as toPath } from 'node:url';
import { once } from 'node:events';
import {
  appendObservation,
  resolveObservation,
  archiveObservations,
  hasOpenEntry,
  countHeaders,
} from './wolf-observation-log.js';

const SCRIPT = toPath(new URL('./wolf-observation-log.js', import.meta.url));

function runCli(args, opts = {}) {
  return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', ...opts });
}

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'wolf-obs-test-'));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('appendObservation assigns number 1 to the first entry and writes all fields', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    const number = appendObservation(logPath, {
      type: 'skill-improvement',
      skill: 'grilling',
      issue: 'Some issue text',
      improvement: 'Some improvement text',
      principle: 'Some principle text',
      status: 'OPEN',
    });

    assert.equal(number, 1);
    const content = readFileSync(logPath, 'utf8');
    assert.match(content, /^### Observation 1:/m);
    assert.match(content, /\*\*Status:\*\* OPEN/);
    assert.match(content, /\*\*Type:\*\* skill-improvement/);
    assert.match(content, /\*\*Skill:\*\* grilling/);
    assert.match(content, /\*\*Issue:\*\* Some issue text/);
    assert.match(content, /\*\*Suggested improvement:\*\* Some improvement text/);
    assert.match(content, /\*\*Principle:\*\* Some principle text/);
  });
});

test('appendObservation assigns sequential numbers across calls', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    appendObservation(logPath, { type: 'skill-improvement', skill: 'a', issue: 'x' });
    const second = appendObservation(logPath, { type: 'skill-improvement', skill: 'b', issue: 'y' });
    assert.equal(second, 2);
  });
});

test('appendObservation rejects an invalid type', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    assert.throws(() => appendObservation(logPath, { type: 'not-a-real-type' }));
  });
});

test('appendObservation refuses to write inside a worktree path', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, '.claude', 'worktrees', 'some-branch', '.wolf', 'observations.md');
    assert.throws(() => appendObservation(logPath, { type: 'skill-improvement' }));
    assert.equal(existsSync(logPath), false);
  });
});

test('resolveObservation updates only the target entry Status line', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    appendObservation(logPath, { type: 'skill-improvement', skill: 'a', issue: 'first' });
    appendObservation(logPath, { type: 'skill-improvement', skill: 'b', issue: 'second' });

    resolveObservation(logPath, 1, 'ACTIONED', 'applied to grilling');

    const content = readFileSync(logPath, 'utf8');
    assert.match(content, /### Observation 1:[\s\S]*?\*\*Status:\*\* ACTIONED \(\d{4}-\d{2}-\d{2}\) — applied to grilling/);
    // Entry 2 must be untouched.
    assert.match(content, /### Observation 2:[\s\S]*?\*\*Status:\*\* OPEN\n/);
  });
});

test('resolveObservation preserves total header count', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    appendObservation(logPath, { type: 'skill-improvement', skill: 'a', issue: 'first' });
    const before = countHeaders(logPath);

    resolveObservation(logPath, 1, 'DECLINED', 'not needed');

    assert.equal(countHeaders(logPath), before);
  });
});

test('resolveObservation throws on an unknown observation number', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    appendObservation(logPath, { type: 'skill-improvement', skill: 'a', issue: 'first' });
    assert.throws(() => resolveObservation(logPath, 99, 'ACTIONED', 'n/a'));
  });
});

test('resolveObservation rejects a status of OPEN', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    appendObservation(logPath, { type: 'skill-improvement', skill: 'a', issue: 'first' });
    assert.throws(() => resolveObservation(logPath, 1, 'OPEN', ''));
  });
});

test('archiveObservations moves entries resolved before today, keeps entries resolved today', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    const archiveDir = join(dir, 'observations-archive');

    appendObservation(logPath, { type: 'skill-improvement', skill: 'old', issue: 'old issue' });
    appendObservation(logPath, { type: 'skill-improvement', skill: 'new', issue: 'new issue' });
    resolveObservation(logPath, 2, 'ACTIONED', 'done today');

    // Manually back-date entry 1's resolution so it's eligible for archival.
    let content = readFileSync(logPath, 'utf8');
    content = content.replace(
      /### Observation 1:[\s\S]*?\*\*Status:\*\*\s*OPEN/,
      (block) => block.replace('**Status:** OPEN', '**Status:** ACTIONED (2000-01-01) — done long ago'),
    );
    writeFileSync(logPath, content);

    const result = archiveObservations(logPath, archiveDir, '2026-07-21');
    assert.equal(result.archivedCount, 1);

    const remaining = readFileSync(logPath, 'utf8');
    assert.doesNotMatch(remaining, /### Observation 1:/);
    assert.match(remaining, /### Observation 2:/);

    const archived = readFileSync(join(archiveDir, 'log-2000-01-01.md'), 'utf8');
    assert.match(archived, /### Observation 1:/);
    assert.match(archived, /done long ago/);
  });
});

test('archiveObservations is a no-op when nothing is resolved', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    const archiveDir = join(dir, 'observations-archive');
    appendObservation(logPath, { type: 'skill-improvement', skill: 'a', issue: 'x' });

    const result = archiveObservations(logPath, archiveDir, '2026-07-21');
    assert.equal(result.archivedCount, 0);
    assert.equal(existsSync(archiveDir), false);
  });
});

test('hasOpenEntry finds a matching OPEN entry by type and session', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    appendObservation(logPath, {
      type: 'compaction-checkpoint',
      session: 'sess-1',
      skill: 'session',
      issue: 'compaction happened',
    });
    assert.equal(hasOpenEntry(logPath, { type: 'compaction-checkpoint', session: 'sess-1' }), true);
    assert.equal(hasOpenEntry(logPath, { type: 'compaction-checkpoint', session: 'sess-2' }), false);
    assert.equal(hasOpenEntry(logPath, { type: 'write-batch-checkpoint', session: 'sess-1' }), false);
  });
});

test('hasOpenEntry ignores resolved entries', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    appendObservation(logPath, { type: 'compaction-checkpoint', session: 'sess-1', skill: 'session', issue: 'x' });
    resolveObservation(logPath, 1, 'DECLINED', 'nothing to log');
    assert.equal(hasOpenEntry(logPath, { type: 'compaction-checkpoint', session: 'sess-1' }), false);
  });
});

test('countHeaders returns 0 for a missing file and the real count otherwise', () => {
  withTmpDir((dir) => {
    const logPath = join(dir, 'observations.md');
    assert.equal(countHeaders(logPath), 0);
    appendObservation(logPath, { type: 'skill-improvement', skill: 'a', issue: 'x' });
    appendObservation(logPath, { type: 'skill-improvement', skill: 'b', issue: 'y' });
    assert.equal(countHeaders(logPath), 2);
  });
});

test('CLI append reads a JSON payload from stdin and creates an entry', () => {
  withTmpDir((dir) => {
    mkdtempSync; // no-op reference to keep import used if bundlers complain; harmless
    const wolfDir = join(dir, '.wolf');
    const payload = JSON.stringify({
      type: 'skill-improvement',
      skill: 'grilling',
      issue: 'cli issue',
      improvement: 'cli improvement',
      principle: 'cli principle',
    });
    const result = runCli(['append'], { cwd: dir, input: payload });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.number, 1);
    assert.match(readFileSync(join(wolfDir, 'observations.md'), 'utf8'), /cli issue/);
  });
});

test('CLI resolve updates the target entry', () => {
  withTmpDir((dir) => {
    runCli(['append'], { cwd: dir, input: JSON.stringify({ type: 'skill-improvement', skill: 'a', issue: 'x' }) });
    const result = runCli(['resolve', '1', 'ACTIONED', 'done via cli'], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    const content = readFileSync(join(dir, '.wolf', 'observations.md'), 'utf8');
    assert.match(content, /ACTIONED \(\d{4}-\d{2}-\d{2}\) — done via cli/);
  });
});

test('CLI archive reports archivedCount as JSON', () => {
  withTmpDir((dir) => {
    runCli(['append'], { cwd: dir, input: JSON.stringify({ type: 'skill-improvement', skill: 'a', issue: 'x' }) });
    const result = runCli(['archive'], { cwd: dir });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { archivedCount: 0 });
  });
});

test('CLI exits non-zero with malformed JSON on stdin', () => {
  withTmpDir((dir) => {
    const result = runCli(['append'], { cwd: dir, input: 'not json' });
    assert.notEqual(result.status, 0);
  });
});

test('appendObservation survives concurrent OS processes without collision or corruption', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wolf-obs-concurrency-'));
  try {
    const runs = Array.from({ length: 8 }, (_, i) => {
      const child = spawn('node', [SCRIPT, 'append'], { cwd: dir });
      child.stdin.write(JSON.stringify({
        type: 'skill-improvement',
        skill: `concurrent-${i}`,
        issue: `race entry ${i}`,
      }));
      child.stdin.end();
      return once(child, 'exit');
    });

    await Promise.all(runs);

    const logPath = join(dir, '.wolf', 'observations.md');
    const content = readFileSync(logPath, 'utf8');
    const numbers = [...content.matchAll(/^### Observation (\d+):/gm)].map((m) => Number(m[1]));

    assert.equal(numbers.length, 8, 'all 8 concurrent appends must produce an entry');
    assert.deepEqual([...numbers].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], 'numbers must be distinct and sequential, no collisions or gaps');
    for (let i = 0; i < 8; i += 1) {
      assert.match(content, new RegExp(`race entry ${i}`), `entry for race entry ${i} must be present, not overwritten`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
