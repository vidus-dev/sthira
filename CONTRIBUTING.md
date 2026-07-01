# Contributing

Thanks for your interest in improving Finance Tracker. This guide covers how to
set up, make changes, and get them merged.

## Getting started

The repo is a monorepo with three apps. See the [README](./README.md) for setup
of each. In short:

```bash
# Backend
cd fin-backend && poetry install --with dev

# Web + mobile (from repo root)
npm install
```

## Branching & commits

- Branch off `main`. Use a descriptive branch name (e.g.
  `feature/idempotent-transfers`, `fix/balance-race`).
- Write clear, imperative commit messages ("Add CSRF token to write path").
- Keep PRs focused — one logical change per PR is easier to review.

## Before you open a PR

Run the same checks CI runs, locally:

**Backend**

```bash
cd fin-backend
poetry run ruff check app tests        # lint
poetry run pytest                      # tests + coverage gate (fails under threshold)
```

**Web**

```bash
npm run lint  -w finance-tracking-app
npm run test  -w finance-tracking-app
npm run build -w finance-tracking-app
```

**Mobile**

```bash
npm run typecheck -w fin-mobile
```

Pre-commit hooks are configured in [`.pre-commit-config.yaml`](./.pre-commit-config.yaml);
install them with `pre-commit install` to catch issues before committing.

## Tests

- New behavior needs tests. Backend tests live in `fin-backend/tests/`.
- Prefer fast, deterministic unit tests for domain logic (see
  `tests/test_goals_calculator.py`, `tests/test_schemas_validation.py`).
- The backend enforces a coverage floor; raise it as integration coverage grows
  rather than letting it slip.

## Database changes

Schema changes go through Alembic migrations:

```bash
cd fin-backend
poetry run alembic revision --autogenerate -m "describe change"
poetry run alembic upgrade head
```

Review the generated migration before committing — autogenerate is a starting
point, not the final word.

## Code review

- CI must be green before merge.
- At least one approving review is expected (see [`.github/CODEOWNERS`](./.github/CODEOWNERS)).
- Address review comments or explain why a suggestion doesn't apply.

## Reporting bugs & proposing features

Use the issue templates under [`.github/ISSUE_TEMPLATE`](./.github/ISSUE_TEMPLATE).
For security issues, do **not** open a public issue — see [SECURITY.md](./SECURITY.md).
