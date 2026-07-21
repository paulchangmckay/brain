#!/usr/bin/env bash
# Automates transferring a commit from one worktree's submodule clone to
# another: names a branch at the commit in the source clone, then fetches
# that branch by name into the target clone (a raw SHA is not fetchable via
# a plain local-path fetch). See CLAUDE.md §3 "Submodule commit transfer".
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <submodule-path-relative-to-repo-root> <source-worktree-root> <commit-sha>" >&2
  exit 1
fi

SUBMODULE_PATH="$1"
SOURCE_WORKTREE="$2"
COMMIT_SHA="$3"
BRANCH_NAME="transfer-${COMMIT_SHA:0:12}"

SOURCE_SUBMODULE="${SOURCE_WORKTREE}/${SUBMODULE_PATH}"
TARGET_SUBMODULE="$(git rev-parse --show-toplevel)/${SUBMODULE_PATH}"

if [ ! -d "$SOURCE_SUBMODULE/.git" ] && [ ! -f "$SOURCE_SUBMODULE/.git" ]; then
  echo "Error: $SOURCE_SUBMODULE is not a git checkout" >&2
  exit 1
fi

if [ ! -d "$TARGET_SUBMODULE/.git" ] && [ ! -f "$TARGET_SUBMODULE/.git" ]; then
  echo "Error: $TARGET_SUBMODULE is not a git checkout" >&2
  exit 1
fi

git -C "$SOURCE_SUBMODULE" branch -f "$BRANCH_NAME" "$COMMIT_SHA"
git -C "$TARGET_SUBMODULE" fetch "$SOURCE_SUBMODULE" "$BRANCH_NAME"
git -C "$TARGET_SUBMODULE" branch -f "$BRANCH_NAME" FETCH_HEAD

echo "Commit $COMMIT_SHA is now available in $TARGET_SUBMODULE on branch $BRANCH_NAME"
echo "Merge or fast-forward your target branch from it, e.g.:"
echo "  git -C \"$TARGET_SUBMODULE\" merge $BRANCH_NAME"
