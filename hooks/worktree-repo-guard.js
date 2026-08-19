#!/usr/bin/env node
// PreToolUse hook (matcher: EnterWorktree): blocks EnterWorktree unless the
// session's cwd matches the primary repo it always targets. See
// docs/superpowers/specs/2026-07-20-tooling-friction-hardening-design.md §1.

import { resolve } from 'path';
import { homedir } from 'os';
import { readStdin } from '../scripts/hook-input.js';

const PRIMARY_REPO = resolve(homedir(), '.claude');

let input = {};
try {
  input = JSON.parse(readStdin() || '{}');
} catch (_) {
  process.exit(0);
}

const cwd = input.cwd || process.cwd();
const resolvedCwd = resolve(cwd);

if (resolvedCwd !== PRIMARY_REPO) {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: `[Worktree Guard] EnterWorktree always targets ${PRIMARY_REPO}, but this session's cwd is ${resolvedCwd}. Use "git worktree add <path> -b <branch> origin/<base>" instead for this project.`
  }) + '\n');
}

process.exit(0);
