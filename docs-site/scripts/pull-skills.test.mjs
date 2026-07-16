import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from './pull-skills.mjs';

test('parseFrontmatter extracts name and description', () => {
  const content = '---\nname: brainstorming\ndescription: "Explore before building"\n---\n\n# Body\n';
  const result = parseFrontmatter(content);
  assert.equal(result.name, 'brainstorming');
  assert.equal(result.description, 'Explore before building');
  assert.equal(result.body, '# Body\n');
});

test('parseFrontmatter returns undefined fields when frontmatter is missing', () => {
  const result = parseFrontmatter('# No frontmatter here\n');
  assert.equal(result.name, undefined);
  assert.equal(result.description, undefined);
});

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDenylisted, findNestedMarkdownFiles } from './pull-skills.mjs';

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'pull-skills-test-'));
}

test('isDenylisted matches known OSS scaffolding filenames', () => {
  assert.equal(isDenylisted('CONTRIBUTING.md'), true);
  assert.equal(isDenylisted('CODE_OF_CONDUCT.md'), true);
  assert.equal(isDenylisted('testing.md'), false);
});

test('findNestedMarkdownFiles finds nested files, skips SKILL.md and denylist', () => {
  const dir = makeTempDir();
  try {
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: x\n---\n');
    writeFileSync(join(dir, 'CONTRIBUTING.md'), 'boilerplate');
    mkdirSync(join(dir, 'references'));
    writeFileSync(join(dir, 'references', 'testing.md'), 'testing content');
    const found = findNestedMarkdownFiles(dir);
    assert.deepEqual(found, [join('references', 'testing.md')]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

import { buildSkillPage } from './pull-skills.mjs';

test('buildSkillPage renders title and description frontmatter plus body', () => {
  const page = buildSkillPage({
    name: 'brainstorming',
    description: 'Explore before building',
    body: '# Brainstorming\n\nBody text.\n',
  });
  assert.match(page, /^---\ntitle: "brainstorming"\ndescription: "Explore before building"\n---\n\n/);
  assert.match(page, /# Brainstorming/);
});

test('buildSkillPage omits description line when description is missing', () => {
  const page = buildSkillPage({ name: 'x', description: undefined, body: 'Body\n' });
  assert.doesNotMatch(page, /description:/);
});

test('buildSkillPage escapes internal quotes in description frontmatter', () => {
  const page = buildSkillPage({
    name: 'test-skill',
    description: 'Use when the user says "give me ideas"',
    body: 'Body\n',
  });
  // Verify JSON-escaped quote appears in the frontmatter block
  assert.match(page, /description: "Use when the user says \\"give me ideas\\"/);
});

import { existsSync, readFileSync } from 'node:fs';
import { syncSkills } from './pull-skills.mjs';

test('syncSkills skips directories with no SKILL.md', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    mkdirSync(join(skillsDir, 'ba-agent'));
    mkdirSync(join(skillsDir, 'ba-agent', 'agents'));
    const { warnings } = syncSkills({ skillsDir, outputDir });
    assert.equal(existsSync(join(outputDir, 'ba-agent.md')), false);
    assert.deepEqual(warnings, []);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills warns but still writes a page when frontmatter fields are missing', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'broken-skill');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: broken-skill\n---\n\nBody text\n');
    const { warnings } = syncSkills({ skillsDir, outputDir });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /broken-skill\/SKILL\.md is missing/);
    assert.equal(existsSync(join(outputDir, 'broken-skill.md')), true);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills warns and uses skillName fallback when name field is missing', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'missing-name-skill');
    mkdirSync(skillDir);
    writeFileSync(join(skillDir, 'SKILL.md'), '---\ndescription: "A skill without a name field"\n---\n\nBody text\n');
    const { warnings } = syncSkills({ skillsDir, outputDir });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /missing-name-skill\/SKILL\.md is missing/);
    assert.equal(existsSync(join(outputDir, 'missing-name-skill.md')), true);
    // Verify the title uses the skillName fallback
    const content = readFileSync(join(outputDir, 'missing-name-skill.md'), 'utf8');
    assert.match(content, /title: "missing-name-skill"/);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills writes nested reference files as sub-pages, excluding denylist', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'senior-engineering-partner');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: senior-engineering-partner\ndescription: "A strict reviewer"\n---\n\nBody\n'
    );
    writeFileSync(join(skillDir, 'CONTRIBUTING.md'), 'boilerplate');
    mkdirSync(join(skillDir, 'references'));
    writeFileSync(join(skillDir, 'references', 'testing.md'), 'testing guidance');

    syncSkills({ skillsDir, outputDir });

    assert.equal(existsSync(join(outputDir, 'senior-engineering-partner.md')), true);
    assert.equal(
      existsSync(join(outputDir, 'senior-engineering-partner', 'references', 'testing.md')),
      true
    );
    assert.equal(existsSync(join(outputDir, 'senior-engineering-partner', 'CONTRIBUTING.md')), false);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills is idempotent', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'brainstorming');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: brainstorming\ndescription: "Explore before building"\n---\n\nBody\n'
    );
    syncSkills({ skillsDir, outputDir });
    const firstRun = readFileSync(join(outputDir, 'brainstorming.md'), 'utf8');
    syncSkills({ skillsDir, outputDir });
    const secondRun = readFileSync(join(outputDir, 'brainstorming.md'), 'utf8');
    assert.equal(firstRun, secondRun);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});
