#!/usr/bin/env node
// Deterministic scanner for wolf-debt: markers, used by the debt-ledger skill.
// See CLAUDE.md §3 and docs/superpowers/specs/2026-07-15-ponytail-bloat-tooling-design.md.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

function getSubmodulePaths(cwd) {
  const gitmodulesPath = resolve(cwd, '.gitmodules');
  if (!existsSync(gitmodulesPath)) return [];
  const content = readFileSync(gitmodulesPath, 'utf8');
  const paths = [];
  for (const match of content.matchAll(/^\s*path\s*=\s*(.+)$/gm)) {
    paths.push(match[1].trim());
  }
  return paths;
}

function isUnderSubmodule(file, submodulePaths) {
  const normalized = file.startsWith('./') ? file.slice(2) : file;
  return submodulePaths.some(
    (p) => normalized === p || normalized.startsWith(`${p}/`),
  );
}

function grepMarkers(cwd) {
  // grep's --exclude-dir=PATTERN only matches a single directory-name
  // component during recursion, not a multi-segment relative path — so it
  // can't be used to exclude submodule paths directly (which may be nested,
  // e.g. "skills/senior-engineering-partner", or collide on basename with
  // an unrelated real directory, e.g. a "superpowers" submodule vs. a
  // tracked "docs/superpowers/" directory). Only use --exclude-dir for the
  // two fixed, well-known top-level names where basename matching is safe;
  // submodule exclusion is instead applied afterward in JS, as a full-path
  // prefix filter against the paths read from .gitmodules.
  const args = [
    '-rnE',
    '(#|//) ?wolf-debt:',
    '--exclude-dir=.git',
    '--exclude-dir=node_modules',
    // Claude Code's own runtime state when this scanner is run against
    // ~/.claude itself — conversation history, file snapshots, and SDD
    // review artifacts, never source. Fixed top-level names, safe for
    // basename exclusion like .git/node_modules above.
    '--exclude-dir=.wolf',
    '--exclude-dir=.superpowers',
    '--exclude-dir=file-history',
    '--exclude=*.jsonl',
    '.',
  ];
  try {
    const out = execFileSync('grep', args, { cwd, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch (e) {
    if (e.status === 1) return []; // grep: no matches
    throw e;
  }
}

function parseLine(line) {
  const m = line.match(/^(.+?):(\d+):(.*)$/);
  if (!m) return null;
  const [, file, lineno, content] = m;
  const markerMatch = content.match(/(?:#|\/\/) ?wolf-debt:\s*(.*)$/);
  if (!markerMatch) return null;
  const rest = markerMatch[1];
  const commaIdx = rest.indexOf(',');
  if (commaIdx === -1) {
    return { file, line: Number(lineno), ceiling: rest.trim(), trigger: null };
  }
  return {
    file,
    line: Number(lineno),
    ceiling: rest.slice(0, commaIdx).trim(),
    trigger: rest.slice(commaIdx + 1).trim(),
  };
}

export function scanDebtMarkers(cwd) {
  const submodulePaths = getSubmodulePaths(cwd);
  return grepMarkers(cwd)
    .map(parseLine)
    .filter(Boolean)
    .filter((m) => !isUnderSubmodule(m.file, submodulePaths));
}

export function formatReport(markers) {
  if (markers.length === 0) return 'No wolf-debt: markers. Clean ledger.';
  const rows = markers.map((m) => (
    m.trigger
      ? `${m.file}:${m.line}, ceiling: ${m.ceiling}. upgrade: ${m.trigger}.`
      : `${m.file}:${m.line}, ceiling: ${m.ceiling}. no-trigger.`
  ));
  const noTriggerCount = markers.filter((m) => !m.trigger).length;
  rows.push(`${markers.length} markers, ${noTriggerCount} with no trigger.`);
  return rows.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cwd = process.argv[2] || process.cwd();
  console.log(formatReport(scanDebtMarkers(cwd)));
}
