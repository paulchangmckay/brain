#!/usr/bin/env node
// PostToolUseFailure hook (matcher: Read|Edit): on a failed Read/Edit whose
// error indicates a missing path, suggests the correct path when exactly
// one file on disk shares the failed path's basename. Silent in every
// ambiguous case — a wrong suggestion is worse than no suggestion.
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { readStdin } from '../scripts/hook-input.js';

const MISSING_PATH_PATTERN = /ENOENT|no such file|cannot find|does not exist/i;
const ANATOMY_LINE_PATH = /^([^\s].*?)\s+-\s+/;

export function findRescuePath(anatomyContent, failedPath) {
  const failedBasename = path.basename(failedPath);
  const matches = [];
  for (const line of anatomyContent.split('\n')) {
    const m = line.match(ANATOMY_LINE_PATH);
    if (!m) continue;
    const entryPath = m[1].trim();
    if (path.basename(entryPath) === failedBasename) {
      matches.push(entryPath);
    }
  }
  return matches.length === 1 ? matches[0] : null;
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readStdin() || '{}');
  } catch (_) {
    process.exit(0);
  }

  const toolName = input.tool_name;
  if (toolName !== 'Read' && toolName !== 'Edit') process.exit(0);

  const toolError = input.tool_error || '';
  if (!MISSING_PATH_PATTERN.test(toolError)) process.exit(0);

  const failedPath = input.tool_input && input.tool_input.file_path;
  if (!failedPath) process.exit(0);

  const cwd = input.cwd || process.cwd();
  const anatomyPath = path.resolve(cwd, '.wolf/anatomy.md');
  if (!existsSync(anatomyPath)) process.exit(0);

  let anatomyContent;
  try {
    anatomyContent = readFileSync(anatomyPath, 'utf8');
  } catch (_) {
    process.exit(0);
  }

  const rescuePath = findRescuePath(anatomyContent, failedPath);
  if (!rescuePath) process.exit(0);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUseFailure',
      additionalContext: `[OpenWolf] Did you mean: ${rescuePath}?`
    }
  }) + '\n');

  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
