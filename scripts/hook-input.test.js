import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MODULE_PATH = fileURLToPath(new URL('./hook-input.js', import.meta.url));

test('readStdin returns piped content', () => {
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `
      import { readStdin } from ${JSON.stringify(MODULE_PATH)};
      process.stdout.write(readStdin());
    `],
    { input: 'hello from stdin', encoding: 'utf8' }
  );
  assert.equal(out, 'hello from stdin');
});

test('readStdin returns empty string when stdin is empty', () => {
  // /dev/null as stdin: readFileSync(0) succeeds and returns '' — still
  // exercises the non-throwing path, which is the common real case
  // (a hook invoked with no piped input).
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `
      import { readStdin } from ${JSON.stringify(MODULE_PATH)};
      process.stdout.write(JSON.stringify(readStdin()));
    `],
    { input: '', encoding: 'utf8' }
  );
  assert.equal(out, '""');
});

test('SAFE_NAME matches valid session/skill identifiers', async () => {
  const { SAFE_NAME } = await import('./hook-input.js');
  assert.equal(SAFE_NAME.test('abc123'), true);
  assert.equal(SAFE_NAME.test('my-session_2026.08.17'), true);
});

test('SAFE_NAME rejects slashes and other unsafe characters', async () => {
  const { SAFE_NAME } = await import('./hook-input.js');
  assert.equal(SAFE_NAME.test('../etc/passwd'), false);
  assert.equal(SAFE_NAME.test('a/b'), false);
  assert.equal(SAFE_NAME.test(''), false);
  assert.equal(SAFE_NAME.test('a b'), false);
  // Pins the real (documented) behavior: bare '..' DOES match this regex.
  // Traversal safety comes only from call sites embedding the value inside
  // a filename with a non-empty literal prefix — see the comment above
  // SAFE_NAME in hook-input.js.
  assert.equal(SAFE_NAME.test('..'), true);
});
