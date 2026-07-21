#!/usr/bin/env node
// PreToolUse hook (matcher: Edit|Write): warns when an absolute file_path
// escapes an active worktree. Field name `tool_input.file_path` follows the
// same documented PreToolUse payload contract already relied on by
// hooks/pre-skill-gate.js (session_id/cwd) for a different matcher — see
// Task 2, Step 1 of the implementation plan for why a live diagnostic
// capture wasn't possible here. See
// docs/superpowers/specs/2026-07-20-tooling-friction-hardening-design.md §1.

import { readFileSync, realpathSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve, isAbsolute, dirname, basename, join } from 'path';

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

let input = {};
try {
  input = JSON.parse(readStdin() || '{}');
} catch (_) {
  process.exit(0);
}

const filePath = input.tool_input && input.tool_input.file_path;
const cwd = input.cwd || process.cwd();

if (!filePath || !isAbsolute(filePath)) process.exit(0);

function gitRevParse(flag, at) {
  try {
    return execFileSync('git', ['-C', at, 'rev-parse', flag], { encoding: 'utf8' }).trim();
  } catch (_) {
    return null;
  }
}

const gitDirPath = gitRevParse('--git-dir', cwd);
const gitCommonPath = gitRevParse('--git-common-dir', cwd);

// Not in a worktree at all (or not a git repo) — nothing to guard.
if (!gitDirPath || !gitCommonPath || resolve(cwd, gitDirPath) === resolve(cwd, gitCommonPath)) {
  process.exit(0);
}

const worktreeRoot = gitRevParse('--show-toplevel', cwd);
if (!worktreeRoot) process.exit(0);

// git rev-parse --show-toplevel returns a symlink-resolved path (e.g. macOS
// /var -> /private/var), so the file path must be resolved the same way or
// paths under a symlinked tmpdir compare unequal despite being identical.
function canonicalize(p) {
  const dir = dirname(p);
  try {
    return join(realpathSync(dir), basename(p));
  } catch (_) {
    return p;
  }
}

const resolvedFilePath = canonicalize(resolve(filePath));
const resolvedWorktreeRoot = resolve(worktreeRoot);

if (!resolvedFilePath.startsWith(resolvedWorktreeRoot + '/') && resolvedFilePath !== resolvedWorktreeRoot) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `[Worktree Guard] ${resolvedFilePath} is outside the active worktree (${resolvedWorktreeRoot}) — this edit will land in the main working tree, not the branch, unless that's intentional.`
    }
  }) + '\n');
}

process.exit(0);
