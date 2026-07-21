#!/usr/bin/env node
// Deterministic check for plugin/submodule registration drift: compares
// installed_plugins.json's recorded commit for the superpowers plugin
// against the submodule's live HEAD, and flags any superpowers:* skill
// CLAUDE.md references that isn't present in the installed plugin cache.
// See CLAUDE.md §3 "Plugin registration has no monitoring" fix.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function checkPluginDrift(claudeHome) {
  const findings = [];
  const installedPath = resolve(claudeHome, 'plugins/installed_plugins.json');
  const submodulePath = resolve(claudeHome, 'superpowers');

  if (!existsSync(installedPath) || !existsSync(submodulePath)) {
    return findings;
  }

  let installed;
  try {
    installed = JSON.parse(readFileSync(installedPath, 'utf8'));
  } catch (_) {
    findings.push('installed_plugins.json is not valid JSON — cannot check for drift.');
    return findings;
  }

  const entries = installed.plugins && installed.plugins['superpowers@superpowers-dev'];
  const recordedSha = entries && entries[0] && entries[0].gitCommitSha;

  let liveSha = null;
  try {
    liveSha = execFileSync('git', ['-C', submodulePath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (_) {}

  if (recordedSha && liveSha && recordedSha.slice(0, 12) !== liveSha.slice(0, 12)) {
    findings.push(`installed_plugins.json records superpowers@${recordedSha.slice(0, 12)} but the submodule is at ${liveSha.slice(0, 12)} — plugin cache may be stale.`);
  }

  const cachePath = entries && entries[0] && entries[0].installPath;
  if (cachePath && existsSync(cachePath)) {
    const skillsDir = resolve(cachePath, 'skills');
    if (!existsSync(skillsDir)) {
      findings.push(`installed plugin cache at ${cachePath} has no skills/ directory — cache may be corrupt or incomplete.`);
    } else {
      const cachedSkills = new Set(readdirSync(skillsDir));
      const claudeMdPath = resolve(claudeHome, 'CLAUDE.md');
      if (existsSync(claudeMdPath)) {
        const claudeMd = readFileSync(claudeMdPath, 'utf8');
        const referenced = [...claudeMd.matchAll(/superpowers:([a-z-]+)/g)].map((m) => m[1]);
        for (const skill of new Set(referenced)) {
          if (!cachedSkills.has(skill)) {
            findings.push(`CLAUDE.md references superpowers:${skill} but it isn't in the installed plugin cache at ${cachePath}/skills/.`);
          }
        }
      }
    }
  }

  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const claudeHome = process.argv[2] || process.cwd();
  const findings = checkPluginDrift(claudeHome);
  if (findings.length === 0) {
    console.log('No plugin/submodule registration drift detected.');
  } else {
    findings.forEach((f) => console.log(`Drift: ${f}`));
    process.exitCode = 1;
  }
}
