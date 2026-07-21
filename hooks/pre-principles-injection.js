#!/usr/bin/env node
// PreToolUse hook (matcher: Write|Edit|MultiEdit): injects
// cross-cutting-principles.md as context whenever a SKILL.md file is about
// to be created or edited. Triggers on the file path being touched, not on
// which meta-skill (if any) is doing the touching — covers direct small
// edits (the common case for the two-tier apply design), edits following
// writing-skills, and new-skill creation with one mechanism.
// See docs/superpowers/specs/2026-07-20-skill-observation-system-design.md

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

const cwd = input.cwd || process.cwd();
const filePath = (input.tool_input && input.tool_input.file_path) || '';

if (!filePath.endsWith('SKILL.md')) process.exit(0);

const principlesPath = resolve(cwd, '.wolf/cross-cutting-principles.md');

try {
  if (!existsSync(principlesPath)) process.exit(0);
  const content = readFileSync(principlesPath, 'utf8').trim();
  if (!content || content.includes('(none yet)')) process.exit(0);

  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: `Cross-cutting principles checklist (.wolf/cross-cutting-principles.md) — check this SKILL.md edit against it:\n\n${content}`,
    },
  })}\n`);
} catch (_) {
  // Silent fail — a stdout error at hook exit must not surface as a hook failure.
}

process.exit(0);
