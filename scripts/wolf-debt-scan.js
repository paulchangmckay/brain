#!/usr/bin/env node
// Deterministic scanner for wolf-debt: markers, used by the debt-ledger skill.
// See CLAUDE.md §3 and docs/superpowers/specs/2026-07-15-ponytail-bloat-tooling-design.md.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, basename } from 'node:path';

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

function grepMarkers(cwd) {
  // grep's --exclude-dir=PATTERN matches a single directory-name component
  // during recursion, not a multi-segment relative path. Reduce submodule
  // paths (which may be nested, e.g. "skills/senior-engineering-partner")
  // to their basename so grep actually excludes them. Tradeoff: two
  // different submodules sharing a final path segment (e.g. "foo/vendor"
  // and "bar/vendor") both get excluded by one --exclude-dir=vendor — this
  // matches grep's own basename-matching semantics and is not solved further.
  const submoduleDirs = getSubmodulePaths(cwd).map((p) => basename(p));
  const excludeDirs = ['.git', 'node_modules', ...submoduleDirs];
  const args = [
    '-rnE',
    '(#|//) ?wolf-debt:',
    ...excludeDirs.map((d) => `--exclude-dir=${d}`),
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
  return grepMarkers(cwd).map(parseLine).filter(Boolean);
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
