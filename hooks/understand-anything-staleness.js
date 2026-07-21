#!/usr/bin/env node
// SessionStart hook: reminds when a project's understand-anything knowledge
// graph has drifted meaningfully from its current git history. Never throws
// — every failure path returns null, so a broken/missing graph never
// affects SessionStart. See docs/superpowers/specs/2026-07-20-understand-anything-staleness-check-design.md.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

export function readMeta(cwd) {
  try {
    const raw = readFileSync(join(cwd, '.understand-anything', 'meta.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function countCommitsBehind(cwd, commitHash) {
  try {
    const out = execFileSync(
      'git',
      ['-C', cwd, 'rev-list', '--count', `${commitHash}..HEAD`],
      { encoding: 'utf8' }
    );
    const count = Number(out.trim());
    return Number.isInteger(count) ? count : null;
  } catch {
    return null;
  }
}
