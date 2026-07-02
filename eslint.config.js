// Companion enforcement layer for skills/senior-engineering-partner/references/frontend-web-security.md
// (no eval/new Function, no unsanitized child_process, no secrets in code) and SKILL.md's
// eslint-plugin-security mandate. Scoped ONLY to the tracked Claude Code hook scripts.
import security from "eslint-plugin-security";

export default [
  { ignores: ["node_modules/**", "skills/**", "superpowers/**", "langsmith-plugin/**"] },
  {
    files: ["hooks/**/*.js", ".wolf/hooks/**/*.js"],
    plugins: { security },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { process: "readonly", console: "readonly", Buffer: "readonly" },
    },
    rules: {
      // Hard bans — direct match to frontend-web-security.md / SKILL.md floor. Block the commit.
      "no-eval": "error",
      "no-implied-eval": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-child-process": "error",
      // Advisory only — these two are known-noisy on legitimate dynamic fs/object access
      // (hooks read anatomy/session files by computed path); don't block Tier-0 commits on them.
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-object-injection": "warn",
    },
  },
];
