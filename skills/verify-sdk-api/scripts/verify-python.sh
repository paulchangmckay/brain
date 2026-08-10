#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage:" >&2
  echo "  verify-python.sh install <pip-requirement-spec> [--python <python-binary>] [--timeout <seconds>]" >&2
  echo "  verify-python.sh inspect <pip-requirement-spec> <dotted.symbol.path> [<dotted.symbol.path> ...] [--timeout <seconds>]" >&2
  exit 2
}

[ $# -ge 2 ] || usage
MODE=$1; shift
SPEC=$1; shift

PYTHON_BIN="python3"
TIMEOUT=180
SYMBOLS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --python) PYTHON_BIN="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) SYMBOLS+=("$1"); shift ;;
  esac
done

if [ "$MODE" = "inspect" ] && [ ${#SYMBOLS[@]} -eq 0 ]; then
  echo "inspect mode requires at least one dotted.symbol.path" >&2
  usage
fi

TIMEOUT_BIN=$(command -v timeout || command -v gtimeout || true)
if [ -z "$TIMEOUT_BIN" ]; then
  echo "Error: neither 'timeout' nor 'gtimeout' found. Install GNU coreutils (e.g. 'brew install coreutils' on macOS) and retry." >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "Creating ephemeral venv at $TMPDIR/venv (python: $PYTHON_BIN)..." >&2
"$PYTHON_BIN" -m venv "$TMPDIR/venv"

VENV_PY="$TMPDIR/venv/bin/python3"
VENV_PIP="$TMPDIR/venv/bin/pip"

echo "Installing '$SPEC' (timeout ${TIMEOUT}s)..." >&2
set +e
"$TIMEOUT_BIN" "$TIMEOUT" "$VENV_PIP" install -q "$SPEC"
INSTALL_STATUS=$?
set -e
if [ "$INSTALL_STATUS" -ne 0 ]; then
  if [ "$INSTALL_STATUS" -eq 124 ]; then
    echo "TIMEOUT: install of '$SPEC' did not finish within ${TIMEOUT}s. Retry with a larger --timeout for known-heavy packages." >&2
  else
    echo "INSTALL FAILED: '$SPEC' (exit $INSTALL_STATUS). See pip output above." >&2
  fi
  exit "$INSTALL_STATUS"
fi

DIST_NAME=$(python3 -c "
import re, sys
spec = sys.argv[1].strip(\"'\\\"\")
print(re.split(r'[\[=<>!~; ]', spec, maxsplit=1)[0])
" "$SPEC")

if [ "$MODE" = "install" ]; then
  "$VENV_PY" - "$DIST_NAME" "$SPEC" <<'PYEOF'
import importlib.metadata as md
import sys

dist_name, spec = sys.argv[1], sys.argv[2]
resolved = md.version(dist_name)
print(f"Requested spec: {spec}")
print(f"Resolved version: {resolved}")

requires = md.requires(dist_name) or []
if requires:
    print("Declared dependencies (Requires-Dist):")
    for r in requires:
        print(f"  {r}")
else:
    print("Declared dependencies (Requires-Dist): none")
PYEOF
  exit 0
fi

if [ "$MODE" = "inspect" ]; then
  for SYM in "${SYMBOLS[@]}"; do
    "$VENV_PY" - "$SYM" <<'PYEOF'
import importlib
import inspect
import sys

dotted = sys.argv[1]
parts = dotted.split(".")

obj = None
remaining = []
for i in range(len(parts), 0, -1):
    mod_name = ".".join(parts[:i])
    try:
        obj = importlib.import_module(mod_name)
        remaining = parts[i:]
        break
    except ModuleNotFoundError:
        continue
else:
    raise ModuleNotFoundError(f"Could not import any module prefix of '{dotted}'")

for attr in remaining:
    obj = getattr(obj, attr)

print(f"=== {dotted} ===")
if inspect.isclass(obj):
    print(f"MRO: {[c.__name__ for c in obj.__mro__]}")
    try:
        print(f"__init__ signature: {inspect.signature(obj.__init__)}")
    except (TypeError, ValueError):
        print("__init__ signature: (unavailable)")
    print(f"Public attributes: {[a for a in dir(obj) if not a.startswith('_')]}")
elif inspect.isfunction(obj) or inspect.ismethod(obj):
    print(f"Signature: {inspect.signature(obj)}")
else:
    print(f"Type: {type(obj)}")
    print(f"Value repr: {obj!r}")

doc = inspect.getdoc(obj)
print(f"Docstring: {doc if doc else '(none)'}")
PYEOF
  done
  exit 0
fi

usage
