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
  assert.equal(isDenylisted('NOTICE'), true);
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

test('findNestedMarkdownFiles follows symlinked subdirectories', () => {
  const dir = makeTempDir();
  const realReferencesDir = makeTempDir();
  try {
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: x\n---\n');
    writeFileSync(join(realReferencesDir, 'testing.md'), 'testing content');
    symlinkSync(realReferencesDir, join(dir, 'references'), 'dir');
    const found = findNestedMarkdownFiles(dir);
    assert.deepEqual(found, [join('references', 'testing.md')]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(realReferencesDir, { recursive: true, force: true });
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

import { existsSync, readFileSync, symlinkSync } from 'node:fs';
import { syncSkills, delinkDeadReferences } from './pull-skills.mjs';

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

    // A skill with nested reference files gets its top page written as
    // index.md alongside them (not a flat sibling .md), so that relative
    // links written in the original SKILL.md/nested files resolve correctly
    // once synced — see the "resolves relative links" tests below.
    assert.equal(existsSync(join(outputDir, 'senior-engineering-partner.md')), false);
    assert.equal(existsSync(join(outputDir, 'senior-engineering-partner', 'index.md')), true);
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

test('syncSkills follows symlinked skill directories (e.g. superpowers submodule skills)', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  const realSkillDir = makeTempDir();
  try {
    writeFileSync(
      join(realSkillDir, 'SKILL.md'),
      '---\nname: systematic-debugging\ndescription: "Root cause before fix"\n---\n\nBody\n'
    );
    symlinkSync(realSkillDir, join(skillsDir, 'systematic-debugging'), 'dir');

    const { warnings } = syncSkills({ skillsDir, outputDir });

    assert.deepEqual(warnings, []);
    assert.equal(existsSync(join(outputDir, 'systematic-debugging.md')), true);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
    rmSync(realSkillDir, { recursive: true, force: true });
  }
});

test('syncSkills writes a flat <skill>.md when the skill has no nested markdown files', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'no-refs');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: no-refs\ndescription: "No nested files"\n---\n\nBody\n'
    );
    syncSkills({ skillsDir, outputDir });
    assert.equal(existsSync(join(outputDir, 'no-refs.md')), true);
    assert.equal(existsSync(join(outputDir, 'no-refs', 'index.md')), false);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills resolves a top-page-to-nested-file link with no rewriting needed (same directory)', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'with-nested');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: with-nested\ndescription: "Has refs"\n---\n\nSee [REF.md](REF.md).\n'
    );
    writeFileSync(join(skillDir, 'REF.md'), 'Ref content.\n');

    syncSkills({ skillsDir, outputDir });

    const indexPage = readFileSync(join(outputDir, 'with-nested', 'index.md'), 'utf8');
    assert.match(indexPage, /See \[REF\.md\]\(REF\.md\)\./);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills rewrites a nested file\'s link back to SKILL.md, since the top page is renamed to index.md', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'with-nested');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: with-nested\ndescription: "Has refs"\n---\n\nBody\n'
    );
    // Same-directory nested file: SKILL.md is a sibling of REF.md, so the
    // rewritten link needs zero "../" segments.
    writeFileSync(join(skillDir, 'REF.md'), 'Back to [SKILL.md](./SKILL.md) for the overview.\n');

    syncSkills({ skillsDir, outputDir });

    const refPage = readFileSync(join(outputDir, 'with-nested', 'REF.md'), 'utf8');
    assert.match(refPage, /Back to \[SKILL\.md\]\(index\.md\) for the overview\./);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills rewrites a deeply-nested file\'s link back to SKILL.md with the right number of "../" segments', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'with-nested');
    mkdirSync(join(skillDir, 'references'), { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: with-nested\ndescription: "Has refs"\n---\n\nBody\n'
    );
    // One directory deeper than SKILL.md, so the rewritten link needs one
    // "../" segment to escape back up to index.md.
    writeFileSync(
      join(skillDir, 'references', 'testing.md'),
      'See [SKILL.md](SKILL.md) for the philosophy.\n'
    );

    syncSkills({ skillsDir, outputDir });

    const nestedPage = readFileSync(
      join(outputDir, 'with-nested', 'references', 'testing.md'),
      'utf8'
    );
    assert.match(nestedPage, /See \[SKILL\.md\]\(\.\.\/index\.md\) for the philosophy\./);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills gives each nested file a distinct title so it cannot collide with the skill\'s own nav label', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'with-nested');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: with-nested\ndescription: "Has refs"\n---\n\nBody\n'
    );
    // Mirrors the real senior-engineering-partner/README.md case: an OSS
    // README whose H1 heading repeats the skill's own name, which Blume
    // would otherwise pick up as this page's nav label too.
    writeFileSync(join(skillDir, 'README.md'), '# with-nested\n\nSome content.\n');

    syncSkills({ skillsDir, outputDir });

    const readmePage = readFileSync(join(outputDir, 'with-nested', 'README.md'), 'utf8');
    assert.match(readmePage, /^---\ntitle: "README"\n---\n\n/);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('delinkDeadReferences strips directory-style references (trailing slash) that have no single synced page', () => {
  const input = 'See the [references/](references/) directory for detail.';
  const output = delinkDeadReferences(input);
  assert.equal(output, 'See the references/ directory for detail.');
});

test('syncSkills removes stale output before regenerating, so a layout change does not leave duplicate pages', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    // Simulate output left behind by a previous run under a different shape
    // (e.g. a flat <skill>.md from before the skill grew nested files).
    writeFileSync(join(outputDir, 'stale-flat.md'), 'stale content');

    const skillDir = join(skillsDir, 'with-nested');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: with-nested\ndescription: "Has refs"\n---\n\nBody\n'
    );
    writeFileSync(join(skillDir, 'REF.md'), 'Ref body\n');

    syncSkills({ skillsDir, outputDir });

    assert.equal(existsSync(join(outputDir, 'stale-flat.md')), false);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('delinkDeadReferences strips markdown links pointing at denylisted filenames, leaves other links untouched', () => {
  const input = 'See [LICENSE](LICENSE) and [Docs](https://example.com) and [Ref](REF.md).';
  const output = delinkDeadReferences(input);
  assert.equal(output, 'See LICENSE and [Docs](https://example.com) and [Ref](REF.md).');
});

test('syncSkills strips links to denylisted sibling files so no dead links reach the synced page', () => {
  const skillsDir = makeTempDir();
  const outputDir = makeTempDir();
  try {
    const skillDir = join(skillsDir, 'licensed-skill');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      '---\nname: licensed-skill\ndescription: "Has a license"\n---\n\nSee [LICENSE](LICENSE) for terms.\n'
    );
    writeFileSync(join(skillDir, 'LICENSE'), 'MIT');

    syncSkills({ skillsDir, outputDir });

    const page = readFileSync(join(outputDir, 'licensed-skill.md'), 'utf8');
    assert.match(page, /See LICENSE for terms\./);
    assert.doesNotMatch(page, /\[LICENSE\]/);
  } finally {
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test('syncSkills writes an index page for the skills section, since content/skills/** is wiped and fully regenerated', () => {
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
    assert.equal(existsSync(join(outputDir, 'index.md')), true);
    const indexContent = readFileSync(join(outputDir, 'index.md'), 'utf8');
    assert.match(indexContent, /^---\ntitle: "Skills Reference"\n---\n\n/);
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
