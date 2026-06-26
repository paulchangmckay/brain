#!/usr/bin/env node
// PostToolUse hook (Bash): warns when command output exceeds 15KB.
// Cannot actually truncate (output is already in context by PostToolUse time),
// but the warning tells Claude to summarize rather than carry all of it forward.

const THRESHOLD_BYTES = 15_000;

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(raw);
    const output = payload?.tool_response?.output ?? payload?.output ?? '';
    const bytes = Buffer.byteLength(output, 'utf8');
    if (bytes > THRESHOLD_BYTES) {
      const kb = Math.round(bytes / 1024);
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `[Context Guard] Bash output was ${kb}KB — extract only what you need and discard the rest rather than keeping the full output in context.`
        }
      }) + '\n');
    }
  } catch (_) {}
  process.exit(0);
});
