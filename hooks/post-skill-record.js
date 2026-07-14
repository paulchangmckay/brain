#!/usr/bin/env node
// PostToolUse hook (matcher: Skill): records each invoked skill as a
// per-(session, skill) marker file so pre-skill-gate.js can check what
// already ran earlier in this session (e.g. did grilling run before
// writing-plans). One marker file per skill avoids any read-modify-write
// race on shared state between concurrent Skill invocations.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

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
if (!SAFE_NAME.test(sessionId) || !SAFE_NAME.test(skill)) process.exit(0);

const markerPath = resolve(cwd, `.wolf/_skill-gate-${sessionId}--${skill}.json`);

try {
  mkdirSync(dirname(markerPath), { recursive: true });
  if (!existsSync(markerPath)) {
    writeFileSync(markerPath, JSON.stringify({ skill, ts: Date.now() }));
  }
} catch (_) {}

process.exit(0);
