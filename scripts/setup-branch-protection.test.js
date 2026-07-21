import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./setup-branch-protection.sh', import.meta.url));

function withFakeGh(visibility, fn) {
  const binDir = mkdtempSync(join(tmpdir(), 'fake-gh-'));
  const logPath = join(binDir, 'gh-calls.log');
  const fakeGh = `#!/usr/bin/env bash
echo "$@" >> "${logPath}"
if [ "$1" = "api" ] && [ "$2" = "repos/acme/widgets" ]; then
  if [ "$3" = "--jq" ] && [ "$4" = ".visibility" ]; then
    echo "${visibility}"
  else
    echo '{"visibility":"${visibility}"}'
  fi
  exit 0
fi
if [ "$1" = "api" ]; then
  cat > /dev/null
  exit 0
fi
exit 1
`;
  writeFileSync(join(binDir, 'gh'), fakeGh);
  chmodSync(join(binDir, 'gh'), 0o755);
  try {
    fn({ binDir, logPath });
  } finally {
    rmSync(binDir, { recursive: true, force: true });
  }
}

test('rejects a private repo with a clear message instead of calling the protection API', () => {
  withFakeGh('private', ({ binDir }) => {
    const result = spawnSync('bash', [SCRIPT, 'acme', 'widgets', 'main'], {
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /paid plan or a public repo/);
  });
});

test('calls the branch protection endpoint with --input - for a public repo', () => {
  withFakeGh('public', ({ binDir, logPath }) => {
    const result = spawnSync('bash', [SCRIPT, 'acme', 'widgets', 'main'], {
      env: { ...process.env, PATH: `${binDir}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const log = readFileSync(logPath, 'utf8');
    assert.match(log, /api repos\/acme\/widgets\/branches\/main\/protection --method PUT --input -/);
  });
});

test('errors with a usage message when arguments are missing', () => {
  const result = spawnSync('bash', [SCRIPT], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});
