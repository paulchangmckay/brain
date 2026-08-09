#!/usr/bin/env bash
# Test suite for verify-python.sh. Run: bash verify-python.test.sh
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/verify-python.sh"
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
OUT=$("$SCRIPT" install "requests==2.31.0" 2>&1)
assert_contains "$OUT" "Requested spec: requests==2.31.0" "reports requested spec"
assert_contains "$OUT" "Resolved version: 2.31.0" "reports resolved version"
assert_contains "$OUT" "charset-normalizer" "reports a real declared dependency"

echo "--- install: fails loudly on a nonexistent package ---"
"$SCRIPT" install "this-package-does-not-exist-xyz123==1.0.0" >/tmp/verify-python-fail-out.txt 2>&1
FAIL_STATUS=$?
if [ "$FAIL_STATUS" -ne 0 ]; then
  echo "PASS: nonexistent package exits non-zero"
else
  echo "FAIL: nonexistent package should exit non-zero"
  FAILURES=$((FAILURES + 1))
fi

echo "--- install: pip invocation is wrapped in timeout (static check) ---"
if grep -q 'timeout "\$TIMEOUT" "\$VENV_PIP" install' "$SCRIPT"; then
  echo "PASS: pip install call is wrapped in timeout"
else
  echo "FAIL: pip install call is not wrapped in timeout — grep the script source"
  FAILURES=$((FAILURES + 1))
fi

echo "--- cleanup: no leftover tmpdirs after a run ---"
BEFORE=$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name "tmp.*" 2>/dev/null | wc -l | tr -d ' ')
"$SCRIPT" install "requests==2.31.0" >/dev/null 2>&1
AFTER=$(find "${TMPDIR:-/tmp}" -maxdepth 1 -name "tmp.*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$AFTER" -le "$BEFORE" ]; then
  echo "PASS: no leftover tmpdirs (before=$BEFORE after=$AFTER)"
else
  echo "FAIL: leftover tmpdirs after run (before=$BEFORE after=$AFTER)"
  FAILURES=$((FAILURES + 1))
fi

echo "--- inspect: reports a real class's MRO and __init__ signature ---"
OUT=$("$SCRIPT" inspect "requests==2.31.0" "requests.exceptions.HTTPError" 2>&1)
assert_contains "$OUT" "=== requests.exceptions.HTTPError ===" "prints the symbol header"
assert_contains "$OUT" "MRO:" "reports MRO for a class"
assert_contains "$OUT" "HTTPError" "MRO includes the class itself"
assert_contains "$OUT" "__init__ signature:" "reports __init__ signature"

echo "--- inspect: reports a real function's signature ---"
OUT=$("$SCRIPT" inspect "requests==2.31.0" "requests.get" 2>&1)
assert_contains "$OUT" "=== requests.get ===" "prints the symbol header"
assert_contains "$OUT" "Signature:" "reports function signature"
assert_contains "$OUT" "url" "signature mentions the url parameter"

echo "--- inspect: multiple symbols in one invocation ---"
OUT=$("$SCRIPT" inspect "requests==2.31.0" "requests.get" "requests.post" 2>&1)
assert_contains "$OUT" "=== requests.get ===" "first symbol present"
assert_contains "$OUT" "=== requests.post ===" "second symbol present"

echo ""
if [ "$FAILURES" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "$FAILURES FAILURE(S)"
  exit 1
fi
