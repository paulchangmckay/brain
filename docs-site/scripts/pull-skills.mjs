import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

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
]);

export function isDenylisted(filename) {
  return DENYLIST.has(filename);
}

export function findNestedMarkdownFiles(skillDir) {
  const results = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
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

export function syncSkills({ skillsDir, outputDir }) {
  const warnings = [];
  const skillNames = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
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

    const page = buildSkillPage({ name: name ?? skillName, description, body });
    const outFile = join(outputDir, `${skillName}.md`);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, page);

    for (const relPath of findNestedMarkdownFiles(skillDir)) {
      const nestedRaw = readFileSync(join(skillDir, relPath), 'utf8');
      const nestedOutFile = join(outputDir, skillName, relPath);
      mkdirSync(dirname(nestedOutFile), { recursive: true });
      writeFileSync(nestedOutFile, nestedRaw);
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
