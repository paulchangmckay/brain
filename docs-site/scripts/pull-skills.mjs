import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, relative, dirname, basename, sep } from 'node:path';

export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { name: undefined, description: undefined, body: content };
  }
  const [, frontmatter, body] = match;
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  return {
    name: nameMatch ? stripQuotes(nameMatch[1].trim()) : undefined,
    description: descMatch ? stripQuotes(descMatch[1].trim()) : undefined,
    body: body.trimStart(),
  };
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

const DENYLIST = new Set([
  'CODE_OF_CONDUCT.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'MAINTAINERS.md',
  'CHANGELOG.md',
  'LICENSE.md',
  'LICENSE.txt',
  'LICENSE',
  'NOTICE',
  // Personal/operational reference file (senior-engineering-partner) — contains
  // real environment details, not OSS scaffolding. The sibling
  // my-environment.template.md is generic and stays public.
  'my-environment.md',
]);

export function isDenylisted(filename) {
  return DENYLIST.has(filename);
}

export function findNestedMarkdownFiles(skillDir) {
  const results = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (
        stat.isFile() &&
        entry.name.endsWith('.md') &&
        entry.name !== 'SKILL.md' &&
        !isDenylisted(entry.name)
      ) {
        results.push(relative(skillDir, fullPath));
      }
    }
  }
  walk(skillDir);
  return results.sort();
}

export function buildSkillPage({ name, description, body }) {
  const descLine = description ? `description: ${JSON.stringify(description)}\n` : '';
  return `---\ntitle: ${JSON.stringify(name)}\n${descLine}---\n\n${body}`;
}

// Relative links inside SKILL.md/nested reference files sometimes point at
// OSS-scaffolding siblings (LICENSE, CHANGELOG.md, ...) that the denylist
// deliberately never syncs — those pages will never exist on this site, so
// the link can never resolve. Strip the markdown link syntax and keep the
// visible text rather than shipping a dead link.
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export function delinkDeadReferences(markdown) {
  return markdown.replace(LINK_PATTERN, (match, text, target) => {
    if (/^(https?:)?\/\//.test(target) || target.startsWith('/') || target.startsWith('#')) {
      return match;
    }
    const withoutAnchor = target.split('#')[0];
    // Directory-style reference (e.g. "references/") — no single synced page
    // corresponds to a whole subdirectory, so there's nothing to link to.
    if (withoutAnchor === '' || withoutAnchor.endsWith('/')) {
      return text;
    }
    return isDenylisted(basename(withoutAnchor)) ? text : match;
  });
}

// SKILL.md is renamed to index.md when a skill has nested files (see
// syncSkills), so any nested file's link literally naming "SKILL.md" needs
// rewriting to the new location, with enough "../" to escape back up from
// wherever that nested file sits.
export function rewriteSkillRootLinks(markdown, relPath) {
  const dir = dirname(relPath);
  const depth = dir === '.' ? 0 : dir.split(sep).length;
  const upToIndex = `${'../'.repeat(depth)}index.md`;
  return markdown.replace(LINK_PATTERN, (match, text, target) => {
    if (/^(https?:)?\/\//.test(target) || target.startsWith('/') || target.startsWith('#')) {
      return match;
    }
    const withoutAnchor = target.split('#')[0];
    if (!/(^|\/)SKILL\.md$/.test(withoutAnchor)) {
      return match;
    }
    const anchor = target.includes('#') ? `#${target.split('#')[1]}` : '';
    return `[${text}](${upToIndex}${anchor})`;
  });
}

function nestedPageTitle(relPath) {
  return relPath.replace(/\.md$/, '').split(sep).join(' / ');
}

const SKILLS_INDEX_PAGE = `---
title: "Skills Reference"
---

# Skills Reference

One page per skill, auto-generated from each \`skills/*/SKILL.md\` (and its nested reference files, where present). Skills without a \`SKILL.md\` are silently skipped.

Browse the sidebar for the full list.
`;

export function syncSkills({ skillsDir, outputDir }) {
  // content/skills/** is entirely generated output (see docs-site/README.md) —
  // wipe it before regenerating so a skill whose output shape changes (e.g.
  // gains nested reference files) doesn't leave stale pages from a previous
  // run's layout alongside the new ones.
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'index.md'), SKILLS_INDEX_PAGE);

  const warnings = [];
  const skillNames = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => statSync(join(skillsDir, entry.name)).isDirectory())
    .map((entry) => entry.name)
    .sort();

  for (const skillName of skillNames) {
    const skillDir = join(skillsDir, skillName);
    const skillMdPath = join(skillDir, 'SKILL.md');
    if (!existsSync(skillMdPath)) {
      continue;
    }

    const raw = readFileSync(skillMdPath, 'utf8');
    const { name, description, body } = parseFrontmatter(raw);
    if (!name || !description) {
      warnings.push(`${skillName}/SKILL.md is missing "name" or "description" frontmatter`);
    }

    const nestedFiles = findNestedMarkdownFiles(skillDir);
    const page = buildSkillPage({
      name: name ?? skillName,
      description,
      body: delinkDeadReferences(body),
    });
    // A skill with nested reference files is written as an index.md
    // alongside them, mirroring the source directory exactly, so relative
    // links between the top page and its nested files resolve without any
    // rewriting. A skill with no nested files stays a flat <skillName>.md.
    const outFile = nestedFiles.length > 0
      ? join(outputDir, skillName, 'index.md')
      : join(outputDir, `${skillName}.md`);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, page);

    for (const relPath of nestedFiles) {
      const nestedRaw = readFileSync(join(skillDir, relPath), 'utf8');
      const transformed = delinkDeadReferences(rewriteSkillRootLinks(nestedRaw, relPath));
      const nestedPage = `---\ntitle: ${JSON.stringify(nestedPageTitle(relPath))}\n---\n\n${transformed}`;
      const nestedOutFile = join(outputDir, skillName, relPath);
      mkdirSync(dirname(nestedOutFile), { recursive: true });
      writeFileSync(nestedOutFile, nestedPage);
    }
  }

  return { warnings };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const skillsDir = join(import.meta.dirname, '..', '..', 'skills');
  const outputDir = join(import.meta.dirname, '..', 'content', 'skills');
  const { warnings } = syncSkills({ skillsDir, outputDir });
  for (const warning of warnings) {
    console.warn(`[pull-skills] warning: ${warning}`);
  }
  console.log(`[pull-skills] synced skills into ${outputDir}`);
}
