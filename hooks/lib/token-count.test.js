import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens } from './token-count.js';

test('returns 0 for empty input', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
});

test('returns a positive count for real text', () => {
  const count = estimateTokens('The quick brown fox jumps over the lazy dog.');
  assert.ok(count > 0);
  assert.ok(count < 20);
});

test('longer text produces a larger count', () => {
  const short = estimateTokens('hello world');
  const long = estimateTokens('hello world '.repeat(100));
  assert.ok(long > short * 50);
});
