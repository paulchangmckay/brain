#!/usr/bin/env node
// PostToolUseFailure hook (matcher: Read|Edit): on a failed Read/Edit whose
// error indicates a missing path, suggests the correct path when exactly
// one file on disk shares the failed path's basename. Silent in every
// ambiguous case — a wrong suggestion is worse than no suggestion.
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { readStdin } from '../scripts/hook-input.js';

const MISSING_PATH_PATTERN = /ENOENT|no such file|cannot find|does not exist/i;
const ANATOMY_HEADER = /^##\s+(.+?)\s*$/;
const ANATOMY_BULLET = /^-\s+`([^`]+)`(?:\s+—\s+.*?)?\s+\(~\d+\s*tok\)\s*$/;

export function findRescuePath(anatomyContent, failedPath) {
  const failedBasename = path.basename(failedPath);
  const matches = [];
  let currentDir = null;
  for (const line of anatomyContent.split('\n')) {
    const headerMatch = line.match(ANATOMY_HEADER);
    if (headerMatch) {
      currentDir = headerMatch[1];
      continue;
    }
    const bulletMatch = line.match(ANATOMY_BULLET);
    if (!bulletMatch || currentDir === null) continue;
    const filename = bulletMatch[1];
    if (path.basename(filename) === failedBasename) {
      const dir = currentDir.endsWith('/') ? currentDir : `${currentDir}/`;
      const fullPath = dir === './' ? filename : `${dir}${filename}`;
      matches.push(fullPath);
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

  // Real field per Claude Code's PostToolUseFailure contract is `error`,
  // not `tool_error` — verified directly against the installed CLI binary
  // (`strings` on the app bundle: "Input to command is JSON with
  // tool_name, tool_input, tool_use_id, error, error_type, is_interrupt,
  // and is_timeout").
  const toolError = input.error || '';
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
  // A stale or foreign-project anatomy.md entry can be the only basename
  // match yet not exist on disk here — only suggest a path that's real,
  // right now, in this project.
  if (!rescuePath || !existsSync(path.resolve(cwd, rescuePath))) process.exit(0);

  // Claude Code's documented PostToolUseFailure contract: exit 0 shows
  // stdout only in transcript mode (not to the model); exit 2 shows
  // stderr to the model immediately. Use stderr + exit 2 to guarantee
  // delivery, per the CLI's own per-event exit-code table (verified
  // against the installed binary).
  process.stderr.write(`[OpenWolf] Did you mean: ${rescuePath}?\n`);
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
