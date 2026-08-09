#!/usr/bin/env bash
# Test suite for verify-js.sh. Run: bash verify-js.test.sh
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/verify-js.sh"
FAILURES=0

assert_contains() {
  local haystack="$1" needle="$2" desc="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "PASS: $desc"
  else
    echo "FAIL: $desc — expected output to contain: $needle"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "--- install: resolves and reports a real pinned version ---"
OUT=$("$SCRIPT" install "lodash@4.17.20" 2>&1)
assert_contains "$OUT" "Requested spec: lodash@4.17.20" "reports requested spec"
assert_contains "$OUT" "Resolved version: 4.17.20" "reports resolved version"

echo "--- install: fails loudly on a nonexistent package ---"
"$SCRIPT" install "this-package-does-not-exist-xyz123@1.0.0" >/tmp/verify-js-fail-out.txt 2>&1
FAIL_STATUS=$?
if [ "$FAIL_STATUS" -ne 0 ]; then
  echo "PASS: nonexistent package exits non-zero"
else
  echo "FAIL: nonexistent package should exit non-zero"
  FAILURES=$((FAILURES + 1))
fi

echo "--- install: npm invocation is wrapped in timeout (static check) ---"
if grep -q 'timeout "\$TIMEOUT" npm install' "$SCRIPT"; then
  echo "PASS: npm install call is wrapped in timeout"
else
  echo "FAIL: npm install call is not wrapped in timeout — grep the script source"
  FAILURES=$((FAILURES + 1))
fi

echo "--- cleanup: no leftover tmpdirs after a run ---"
BEFORE=$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name "tmp.*" 2>/dev/null | wc -l | tr -d ' ')
"$SCRIPT" install "lodash@4.17.20" >/dev/null 2>&1
AFTER=$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name "tmp.*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$AFTER" -le "$BEFORE" ]; then
  echo "PASS: no leftover tmpdirs (before=$BEFORE after=$AFTER)"
else
  echo "FAIL: leftover tmpdirs after run (before=$BEFORE after=$AFTER)"
  FAILURES=$((FAILURES + 1))
fi

echo "--- install: correctly parses a scoped package name (last @ is the separator) ---"
OUT=$("$SCRIPT" install "@babel/runtime@7.20.0" 2>&1)
assert_contains "$OUT" "Requested spec: @babel/runtime@7.20.0" "reports requested spec for scoped package"
assert_contains "$OUT" "Resolved version: 7.20.0" "reports resolved version for scoped package"

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "$FAILURES FAILURE(S)"
  exit 1
fi
