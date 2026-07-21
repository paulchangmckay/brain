#!/usr/bin/env bash
# Reproducible branch-protection setup for a repo owned by this account.
# Encodes two lessons already paid for once (see .wolf/buglog.json bug-029,
# bug-030): gh api's -f shorthand sends non-JSON types for nested/boolean
# fields (422), and classic branch protection needs a paid plan or a public
# repo on personal accounts.
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: $0 <owner> <repo> <base-branch>" >&2
  exit 1
fi

OWNER="$1"
REPO="$2"
BASE_BRANCH="$3"

VISIBILITY=$(gh api "repos/${OWNER}/${REPO}" --jq '.visibility')
if [ "$VISIBILITY" != "public" ]; then
  echo "Repo is $VISIBILITY — classic branch protection requires a paid plan or a public repo on personal accounts."
  echo "Make it public first if that's acceptable: gh repo edit ${OWNER}/${REPO} --visibility public --accept-visibility-change-consequences"
  exit 1
fi

gh api "repos/${OWNER}/${REPO}/branches/${BASE_BRANCH}/protection" \
  --method PUT \
  --input - <<EOF
{
  "required_status_checks": { "strict": true, "contexts": [] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null
}
EOF

echo "Branch protection applied to ${OWNER}/${REPO}#${BASE_BRANCH}."
