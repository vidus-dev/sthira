# Enabling branch protection on `main`

Branch protection lives in GitHub repository settings, not in the repo. The CI,
CodeQL, and security workflows exist; branch protection is what makes their checks
*enforced* (blocking a merge) rather than advisory. Note that these workflows are
configured to run manually (`workflow_dispatch`), so to require them on pull
requests you must also add a `pull_request` trigger to the workflows you want to
block on.

## What to require

- **Require a pull request before merging** (no direct pushes to `main`)
- **Require approvals**: at least 1, and **require review from Code Owners**
  (`.github/CODEOWNERS`)
- **Require status checks to pass before merging**, with these checks:
  - `Web (lint, test, build)`
  - `Mobile (typecheck)`
  - `API (ruff, pytest)`
  - `Docker Compose (build)`
  - `Analyze` (CodeQL)
- **Require branches to be up to date before merging**
- **Require conversation resolution before merging**
- **Do not allow force pushes** / **deletions**

## Option A — GitHub UI

Settings → Branches → **Add branch ruleset** (or **Add classic branch protection
rule**) → branch name pattern `main` → tick the boxes above → Create.

## Option B — `gh` CLI

Requires admin on the repo and the GitHub CLI authenticated (`gh auth login`):

```bash
gh api -X PUT repos/vinayykkumar/finance-tracker/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Web (lint, test, build)",
      "Mobile (typecheck)",
      "API (ruff, pytest)",
      "Docker Compose (build)",
      "Analyze"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

## Verifying

After enabling, open a test PR: merging should be blocked until all checks pass
and a Code Owner approves. Direct `git push origin main` should be rejected.
