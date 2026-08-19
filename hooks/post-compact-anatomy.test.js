import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = fileURLToPath(new URL('./post-compact-anatomy.sh', import.meta.url));

function run(env) {
  return spawnSync('bash', [SCRIPT], { encoding: 'utf8', env: { ...process.env, ...env } });
}

// The script reads global anatomy from $HOME/.claude/.wolf/anatomy.md (a
// nested path under $HOME) and project anatomy from $CLAUDE_CWD/.wolf/anatomy.md
// (a top-level .wolf/ under $CLAUDE_CWD) — two independent locations, not
// the same directory. Each helper sets up exactly one of them.

function makeFakeHome(globalAnatomyContent) {
  const homeDir = mkdtempSync(join(tmpdir(), 'pca-home-'));
  const wolfDir = join(homeDir, '.claude', '.wolf');
  mkdirSync(wolfDir, { recursive: true });
  writeFileSync(join(wolfDir, 'anatomy.md'), globalAnatomyContent);
  return homeDir;
}

function makeFakeProjectCwd(projectAnatomyContent) {
  const cwdDir = mkdtempSync(join(tmpdir(), 'pca-cwd-'));
  const wolfDir = join(cwdDir, '.wolf');
  mkdirSync(wolfDir);
  writeFileSync(join(wolfDir, 'anatomy.md'), projectAnatomyContent);
  return cwdDir;
}

test('emits valid JSON with both global and project anatomy present', () => {
  const homeDir = makeFakeHome('# Global Anatomy\nglobal content');
  const cwdDir = makeFakeProjectCwd('# Project Anatomy\nsome content');
  const result = run({ HOME: homeDir, CLAUDE_CWD: cwdDir });
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'PostCompact');
  assert.match(parsed.hookSpecificOutput.additionalContext, /<GLOBAL_CLAUDE_ANATOMY>/);
  assert.match(parsed.hookSpecificOutput.additionalContext, /<PROJECT_ANATOMY>/);
  rmSync(homeDir, { recursive: true, force: true });
  rmSync(cwdDir, { recursive: true, force: true });
});

test('emits nothing when neither anatomy file exists', () => {
  const emptyHomeDir = mkdtempSync(join(tmpdir(), 'pca-empty-home-'));
  const emptyCwdDir = mkdtempSync(join(tmpdir(), 'pca-empty-cwd-'));
  const result = run({ HOME: emptyHomeDir, CLAUDE_CWD: emptyCwdDir });
  assert.equal(result.stdout.trim(), '');
  assert.equal(result.status, 0);
  rmSync(emptyHomeDir, { recursive: true, force: true });
  rmSync(emptyCwdDir, { recursive: true, force: true });
});

test('correctly escapes a raw control character the old 5-character allowlist did not cover (proves the correctness fix)', () => {
  // CORRECTION (found while verifying Task 8): this test originally
  // targeted a literal backslash, but the old escape_for_json()'s first
  // substitution (s="${s//\\/\\\\}") already handled backslash correctly
  // -- it was never actually an uncovered gap, and the original assertion
  // additionally expected a double backslash to survive JSON.parse, which
  // is wrong for correct round-tripping (a raw single backslash, properly
  // JSON-escaped and then parsed back, should yield a single backslash
  // again -- expecting two would mean over-escaping). The real gap is a
  // raw control character the 5-character allowlist doesn't name at all,
  // e.g. a vertical tab (0x0B). Verified directly: piping this exact
  // content through the OLD script (pre-Task-8, commit 786792f) produces
  // output that JSON.parse rejects with "Bad control character in string
  // literal in JSON" -- genuinely invalid JSON, not a hypothetical.
  const emptyHomeDir = mkdtempSync(join(tmpdir(), 'pca-empty-home-'));
  const cwdDir = makeFakeProjectCwd('vtab:[\v]end');
  const result = run({ HOME: emptyHomeDir, CLAUDE_CWD: cwdDir });
  const parsed = JSON.parse(result.stdout); // throws if invalid JSON -- this IS the assertion
  assert.match(parsed.hookSpecificOutput.additionalContext, /vtab:\[\v\]end/);
  rmSync(emptyHomeDir, { recursive: true, force: true });
  rmSync(cwdDir, { recursive: true, force: true });
});

test('falls back to escape_for_json when jq is not on PATH', () => {
  const emptyHomeDir = mkdtempSync(join(tmpdir(), 'pca-empty-home-'));
  const cwdDir = makeFakeProjectCwd('# Fallback test\nsome content');
  // Build a PATH containing only `bash` and `cat` (which the script needs) with no jq
  // anywhere on it. Confirmed jq lives at /usr/bin/jq on the dev machine, so
  // a plain '/usr/bin:/bin' PATH would still find it there — this
  // constructs a minimal bin dir instead, guaranteeing jq is absent
  // regardless of where it's installed on the machine running the test.
  // Both bash and cat are needed on the restricted PATH because spawnSync resolves
  // the 'bash' command itself against the PATH we pass in env, not the parent process's real PATH.
  const fakeBinDir = mkdtempSync(join(tmpdir(), 'pca-fakebin-'));
  // No shell:true here -- Node's spawnSync already resolves 'which' via
  // PATH lookup directly (it doesn't consult shell builtins/aliases at
  // all, so it finds the real /usr/bin/which binary), avoiding both a
  // shell dependency and Node's DEP0190 warning for args + shell:true.
  const catPath = spawnSync('which', ['cat'], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(catPath, join(fakeBinDir, 'cat'));
  const bashPath = spawnSync('which', ['bash'], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(bashPath, join(fakeBinDir, 'bash'));
  const result = run({ HOME: emptyHomeDir, CLAUDE_CWD: cwdDir, PATH: fakeBinDir });
  const parsed = JSON.parse(result.stdout);
  assert.match(parsed.hookSpecificOutput.additionalContext, /<PROJECT_ANATOMY>/);
  rmSync(emptyHomeDir, { recursive: true, force: true });
  rmSync(cwdDir, { recursive: true, force: true });
  rmSync(fakeBinDir, { recursive: true, force: true });
});
