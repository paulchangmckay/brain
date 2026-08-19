#!/usr/bin/env node
// PreToolUse hook (matcher: Skill): blocks invoking the writing-plans skill
// unless grilling (or its /grill-me wrapper) already ran earlier in this
// session. See CLAUDE.md gate table / brainstorming.md step 9.

import { existsSync } from 'fs';
import { resolve } from 'path';
import { readStdin, SAFE_NAME } from '../scripts/hook-input.js';

const SATISFYING_SKILLS = ['grilling', 'grill-me'];

let input = {};
try {
  input = JSON.parse(readStdin() || '{}');
} catch (_) {
  process.exit(0);
}

const sessionId = input.session_id;
const cwd = input.cwd || process.cwd();
const skill = input.tool_input && input.tool_input.skill;

if (skill !== 'writing-plans') process.exit(0);

const grilled = !!sessionId
  && SAFE_NAME.test(sessionId)
  && SATISFYING_SKILLS.some((s) => existsSync(resolve(cwd, `.wolf/_skill-gate-${sessionId}--${s}.json`)));

if (!grilled) {
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: '[Grilling Gate] writing-plans requires a grilling pass first this session. Invoke the grilling skill on the approved spec (see CLAUDE.md gate table / brainstorming.md step 9) before planning.'
  }) + '\n');
}

process.exit(0);
