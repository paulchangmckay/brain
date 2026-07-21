import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPluginDrift } from './plugin-health-check.js';

function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

function setupFakeClaudeHome() {
  const home = mkdtempSync(join(tmpdir(), 'plugin-health-'));
  const submodule = join(home, 'superpowers');
  mkdirSync(submodule, { recursive: true });
  git(submodule, 'init', '-q');
  git(submodule, 'config', 'user.email', 'a@b.c');
  git(submodule, 'config', 'user.name', 'test');
  mkdirSync(join(submodule, 'skills', 'brainstorming'), { recursive: true });
  writeFileSync(join(submodule, 'skills', 'brainstorming', 'SKILL.md'), '# brainstorming');
  writeFileSync(join(submodule, 'README.md'), 'x');
  git(submodule, 'add', '.');
  git(submodule, 'commit', '-q', '-m', 'init');
  const sha = git(submodule, 'rev-parse', 'HEAD').trim();

  const installPath = join(home, 'plugins/cache/superpowers-dev/superpowers/1.0.0');
  mkdirSync(join(installPath, 'skills'), { recursive: true });
  mkdirSync(join(home, 'plugins'), { recursive: true });
  return { home, sha, installPath };
}

test('flags drift when installed_plugins.json sha does not match submodule HEAD', () => {
  const { home, installPath } = setupFakeClaudeHome();
  try {
    writeFileSync(join(home, 'plugins/installed_plugins.json'), JSON.stringify({
      plugins: { 'superpowers@superpowers-dev': [{ gitCommitSha: '0'.repeat(40), installPath }] },
    }));
    writeFileSync(join(home, 'CLAUDE.md'), 'no superpowers refs here');
    const findings = checkPluginDrift(home);
    assert.ok(findings.some((f) => f.includes('plugin cache may be stale')));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('flags a CLAUDE.md-referenced skill missing from the installed cache', () => {
  const { home, sha, installPath } = setupFakeClaudeHome();
  try {
    writeFileSync(join(home, 'plugins/installed_plugins.json'), JSON.stringify({
      plugins: { 'superpowers@superpowers-dev': [{ gitCommitSha: sha, installPath }] },
    }));
    writeFileSync(join(home, 'CLAUDE.md'), 'invoke superpowers:executing-plans here');
    const findings = checkPluginDrift(home);
    assert.ok(findings.some((f) => f.includes('superpowers:executing-plans')));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('reports no findings when everything matches', () => {
  const { home, sha, installPath } = setupFakeClaudeHome();
  try {
    writeFileSync(join(home, 'plugins/installed_plugins.json'), JSON.stringify({
      plugins: { 'superpowers@superpowers-dev': [{ gitCommitSha: sha, installPath }] },
    }));
    writeFileSync(join(home, 'CLAUDE.md'), 'no refs');
    const findings = checkPluginDrift(home);
    assert.deepEqual(findings, []);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
