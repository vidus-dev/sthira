# Development guide

How to get the stack running locally and work on it day to day.

## Prerequisites

- **Node.js** ≥ 18 (for the web and mobile workspaces)
- **Python** 3.12 + **Poetry** (for the API)
- **Docker** + Docker Compose (for the full stack and Postgres)

## Fastest path: the whole stack

```bash
docker compose up --build
docker compose run --rm api poetry run alembic upgrade head   # first run only
```

Open <http://localhost:8080>. nginx serves the web app and proxies `/v1` to the API.

## Running each app on its own

### API

```bash
cd apps/api
poetry install --with dev
poetry run alembic upgrade head        # needs a Postgres reachable via DATABASE_URL
poetry run uvicorn app.main:app --reload
```

Copy `apps/api/.env.example` to `.env` and adjust as needed. Outside `development`,
the app refuses to start with a weak or placeholder `SECRET_KEY`.

### Web

```bash
npm install          # installs all workspaces from the repo root
npm run web          # Vite dev server (http://localhost:5173)
```

### Mobile

```bash
npm run mobile       # Expo dev server
```

## Handy scripts

| Command | Does |
|---|---|
| `npm run docker:up` / `docker:down` / `docker:logs` | Manage the Compose stack |
| `npm run dev:api` | Start the API with reload (PowerShell helper) |
| `npm run dev:web` | Start the Vite dev server (PowerShell helper) |
| `npm run check:postgres` | Verify Postgres is reachable with `DATABASE_URL` |

Or use the [`Makefile`](../Makefile): `make dev`, `make test`, `make lint`.

## Tests

```bash
cd apps/api && poetry run ruff check app tests   # lint
cd apps/api && poetry run pytest                 # unit + integration (+ coverage floor)
npm run test -w finance-tracking-app             # web unit/component (Vitest)
```

DB-backed integration tests live in `apps/api/tests/integration` and are skipped
automatically when no database is reachable. Point `DATABASE_URL` at a migrated
database to run them.

## Changing the API contract

After editing the API, regenerate the client types so they stay in sync:

```bash
cd apps/api && poetry run python scripts/export_openapi.py
cd ../web && npm run gen:api-types
```

Commit the updated `apps/web/src/lib/api/openapi.json` — CI fails if it is stale.

## Before you open a PR

- `ruff` and tests pass locally.
- The OpenAPI schema is regenerated if the API changed.
- See [`CONTRIBUTING.md`](../CONTRIBUTING.md) for the full workflow.
