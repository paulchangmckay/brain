#!/usr/bin/env node
// PostToolUse hook (matcher: Skill): records each invoked skill into a
// session-scoped state file so pre-skill-gate.js can check what already
// ran earlier in this session (e.g. did grilling run before writing-plans).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

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

const sessionId = input.session_id;
const cwd = input.cwd || process.cwd();
const skill = input.tool_input && input.tool_input.skill;

if (!sessionId || !skill) process.exit(0);

const statePath = resolve(cwd, `.wolf/_skill-gate-${sessionId}.json`);

try {
  mkdirSync(dirname(statePath), { recursive: true });
  let state = { skills: [] };
  if (existsSync(statePath)) {
    try { state = JSON.parse(readFileSync(statePath, 'utf8')); } catch (_) {}
  }
  if (!Array.isArray(state.skills)) state.skills = [];
  state.skills.push(skill);
  writeFileSync(statePath, JSON.stringify(state, null, 2));
} catch (_) {}

process.exit(0);
