// Shared stdin-reading + identifier-sanitization primitives for hooks and
// scripts that need them. Deliberately does NOT include JSON-parse-and-
// failure-handling — that genuinely varies by caller (see
// docs/superpowers/specs/2026-08-17-bucket-b-consolidation-design.md,
// "What does NOT get extracted, and why").
import { readFileSync } from 'node:fs';

export function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

export const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
