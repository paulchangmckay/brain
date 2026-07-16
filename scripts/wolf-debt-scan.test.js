import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDebtMarkers, formatReport } from './wolf-debt-scan.js';

function withTmpRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'wolf-debt-test-'));
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('finds a marker with a ceiling and trigger', () => {
  withTmpRepo((cwd) => {
    writeFileSync(
      join(cwd, 'app.js'),
      '// wolf-debt: global lock, per-account locks if throughput matters\n',
    );
    const markers = scanDebtMarkers(cwd);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].ceiling, 'global lock');
    assert.equal(markers[0].trigger, 'per-account locks if throughput matters');
  });
});

test('flags a marker with no comma as no-trigger', () => {
  withTmpRepo((cwd) => {
    writeFileSync(join(cwd, 'app.py'), '# wolf-debt: naive O(n^2) scan\n');
    const markers = scanDebtMarkers(cwd);
    assert.equal(markers.length, 1);
    assert.equal(markers[0].ceiling, 'naive O(n^2) scan');
    assert.equal(markers[0].trigger, null);
  });
});

test('a vague-but-present trigger still counts as having one (syntax only)', () => {
  withTmpRepo((cwd) => {
    writeFileSync(join(cwd, 'app.js'), '// wolf-debt: hack, will fix later\n');
    const markers = scanDebtMarkers(cwd);
    assert.equal(markers[0].trigger, 'will fix later');
  });
});

test('excludes submodule paths listed in .gitmodules', () => {
  withTmpRepo((cwd) => {
    writeFileSync(
      join(cwd, '.gitmodules'),
      '[submodule "vendor"]\n\tpath = vendor\n\turl = https://example.com/vendor.git\n',
    );
    mkdirSync(join(cwd, 'vendor'));
    writeFileSync(join(cwd, 'vendor', 'lib.js'), '// wolf-debt: should be ignored, never\n');
    writeFileSync(join(cwd, 'app.js'), '// wolf-debt: real one, real trigger\n');
    const markers = scanDebtMarkers(cwd);
    assert.equal(markers.length, 1);
    assert.match(markers[0].file, /app\.js$/);
  });
});

test('excludes a nested submodule path by its basename', () => {
  withTmpRepo((cwd) => {
    writeFileSync(
      join(cwd, '.gitmodules'),
      '[submodule "skills/vendor-thing"]\n\tpath = skills/vendor-thing\n\turl = https://example.com/vendor-thing.git\n',
    );
    mkdirSync(join(cwd, 'skills', 'vendor-thing'), { recursive: true });
    writeFileSync(
      join(cwd, 'skills', 'vendor-thing', 'lib.js'),
      '// wolf-debt: should be ignored, never\n',
    );
    writeFileSync(join(cwd, 'app.js'), '// wolf-debt: real one, real trigger\n');
    const markers = scanDebtMarkers(cwd);
    assert.equal(markers.length, 1);
    assert.match(markers[0].file, /app\.js$/);
  });
});

test('excludes .git and node_modules unconditionally', () => {
  withTmpRepo((cwd) => {
    mkdirSync(join(cwd, 'node_modules'));
    writeFileSync(join(cwd, 'node_modules', 'x.js'), '// wolf-debt: vendored, never\n');
    const markers = scanDebtMarkers(cwd);
    assert.equal(markers.length, 0);
  });
});

test('formatReport reports a clean ledger when nothing found', () => {
  assert.equal(formatReport([]), 'No wolf-debt: markers. Clean ledger.');
});

test('formatReport shows ceiling/upgrade for a triggered marker and counts no-trigger ones', () => {
  const markers = [
    { file: 'a.js', line: 1, ceiling: 'x', trigger: 'y' },
    { file: 'b.js', line: 2, ceiling: 'z', trigger: null },
  ];
  const report = formatReport(markers);
  assert.match(report, /a\.js:1.*ceiling: x.*upgrade: y/);
  assert.match(report, /b\.js:2.*ceiling: z.*no-trigger/);
  assert.match(report, /2 markers, 1 with no trigger\./);
});
