import { getEncoding } from 'js-tiktoken';

let cachedEncoder;

function getEncoder() {
  if (!cachedEncoder) {
    cachedEncoder = getEncoding('cl100k_base');
  }
  return cachedEncoder;
}

export function estimateTokens(text) {
  if (!text) return 0;
  return getEncoder().encode(text).length;
}
