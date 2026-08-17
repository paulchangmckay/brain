// SessionStart hook: combines i-have-adhd's structural ruleset (read live
// from the plugin's own SKILL.md, never copied) with a caveman-density
// lexicon into one reminder. Gated by the same flag file i-have-adhd
// itself uses, so the existing on/off state carries over with no
// migration. Never blocks session start: any failure exits 0.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  const claudeDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  const flagPath = path.join(claudeDir, ".i-have-adhd-always");

  if (!fs.existsSync(flagPath)) process.exit(0);

  const skillPath =
    process.env.ADHD_CAVEMAN_SKILL_PATH_OVERRIDE ||
    path.join(
      claudeDir,
      "plugins",
      "marketplaces",
      "i-have-adhd",
      "skills",
      "i-have-adhd",
      "SKILL.md",
    );

  let adhdBody = null;
  try {
    adhdBody = fs
      .readFileSync(skillPath, "utf8")
      .replace(/^---[^\S\r\n]*\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n|$)/, "")
      .replace(/(?:\r?\n)+$/, "");
  } catch {
    adhdBody = null;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const lexiconPath = path.join(scriptDir, "caveman-lexicon.md");
  const lexiconBody = fs.readFileSync(lexiconPath, "utf8").replace(/(?:\r?\n)+$/, "");

  const adhdSection =
    adhdBody ??
    "(i-have-adhd SKILL.md not found -- structural rules unavailable this session)";

  const combined =
    `ADHD-CAVEMAN MODE ACTIVE (always-on). Structure rules and prose-density rules below both apply to every response. "stop adhd mode" turns off structure only; "stop caveman mode" turns off density only; "normal mode" turns off both at once; either of the first two alone leaves the other active. Delete ${flagPath} to turn always-on off for good (turns off both).\n\n` +
    `${adhdSection}\n\n---\n\n${lexiconBody}\n`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: combined,
      },
    }) + "\n",
  );
} catch {
  process.exit(0);
}
