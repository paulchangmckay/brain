#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:" >&2
  echo "  verify-js.sh install <pkg>@<version> [--timeout <seconds>]" >&2
  echo "  verify-js.sh inspect <pkg>@<version> <exportName> [<exportName> ...] [--timeout <seconds>]" >&2
  exit 2
}

[ $# -ge 2 ] || usage
MODE=$1; shift
SPEC=$1; shift

TIMEOUT=180
EXPORTS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) EXPORTS+=("$1"); shift ;;
  esac
done

if [ "$MODE" = "inspect" ] && [ ${#EXPORTS[@]} -eq 0 ]; then
  echo "inspect mode requires at least one exportName" >&2
  usage
fi

PKG_NAME=$(node -e "
const spec = process.argv[1];
const at = spec.lastIndexOf('@');
console.log(at > 0 ? spec.slice(0, at) : spec);
" "$SPEC")

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

(cd "$TMPDIR" && npm init -y >/dev/null 2>&1)

echo "Scratch npm install of '$SPEC' in $TMPDIR (timeout ${TIMEOUT}s)..." >&2
set +e
(cd "$TMPDIR" && timeout "$TIMEOUT" npm install --no-audit --no-fund -q "$SPEC")
INSTALL_STATUS=$?
set -e
if [ "$INSTALL_STATUS" -ne 0 ]; then
  if [ "$INSTALL_STATUS" -eq 124 ]; then
    echo "TIMEOUT: install of '$SPEC' did not finish within ${TIMEOUT}s. Retry with a larger --timeout for known-heavy packages." >&2
  else
    echo "INSTALL FAILED: '$SPEC' (exit $INSTALL_STATUS). See npm output above." >&2
  fi
  exit "$INSTALL_STATUS"
fi

PKG_JSON="$TMPDIR/node_modules/$PKG_NAME/package.json"
if [ ! -f "$PKG_JSON" ]; then
  echo "INSTALL FAILED: $PKG_JSON not found after install." >&2
  exit 1
fi

RESOLVED_VERSION=$(node -e "console.log(require(process.argv[1]).version)" "$PKG_JSON")

if [ "$MODE" = "install" ]; then
  echo "Requested spec: $SPEC"
  echo "Resolved version: $RESOLVED_VERSION"
  echo "Declared dependencies:"
  node -e "
    const pkg = require(process.argv[1]);
    const deps = pkg.dependencies || {};
    const keys = Object.keys(deps);
    if (keys.length === 0) { console.log('  none'); }
    else { keys.forEach(k => console.log('  ' + k + '@' + deps[k])); }
  " "$PKG_JSON"
  exit 0
fi

usage
