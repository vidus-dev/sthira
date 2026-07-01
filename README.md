# Sthira

A personal-finance platform — **web**, **mobile**, and **API** in a single monorepo.
Track accounts, transactions, budgets, and goals, with a double-entry ledger and
account-to-account transfers.

[![CI](https://github.com/vidus-dev/sthira/actions/workflows/ci.yml/badge.svg)](https://github.com/vidus-dev/sthira/actions/workflows/ci.yml)
[![CodeQL](https://github.com/vidus-dev/sthira/actions/workflows/codeql.yml/badge.svg)](https://github.com/vidus-dev/sthira/actions/workflows/codeql.yml)
![Python](https://img.shields.io/badge/python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)

## Overview

Sthira is a modular monolith: a FastAPI service exposes a versioned `/v1` API over
PostgreSQL, and two clients — a React/Vite web app and an Expo React Native app —
consume it through a shared, generated type contract. The whole stack runs locally
with a single `docker compose up`.

## Architecture

```mermaid
flowchart LR
  W[Web · React/Vite] -->|/v1| N[nginx]
  M[Mobile · Expo RN] -->|/v1| API
  N -->|/v1| API[FastAPI · app/modules]
  N -->|static| W
  API --> DB[(PostgreSQL)]
  API -.->|opt-in| O[OpenTelemetry / Prometheus]
```

The API follows a strict layering — a thin router delegates to a service, which
uses a repository over the models:

```
HTTP → router (app/api/v1) → service (app/modules/*/service.py)
     → repository (app/modules/*/repository.py) → model (app/models)
```

Domain modules live under `apps/api/app/modules/` (`accounts`, `transactions`,
`budgets`, `goals`, `transfers`). See [`docs/architecture.md`](./docs/architecture.md)
for the full picture and the [ADRs](./docs/adr/) for specific decisions.

## Tech stack

| Component | Path | Stack |
|---|---|---|
| Web | [`apps/web/`](./apps/web) | React 18, Vite, TypeScript, Tailwind, Vitest, Playwright |
| Mobile | [`apps/mobile/`](./apps/mobile) | Expo, React Native, React Navigation |
| API | [`apps/api/`](./apps/api) | FastAPI, async SQLAlchemy 2.0, Alembic, Pydantic, Postgres |

## Repository structure

```
.
├── apps/
│   ├── api/          # FastAPI modular monolith (Python / Poetry)
│   ├── web/          # React + Vite + TypeScript web client
│   └── mobile/       # Expo React Native app
├── deploy/           # Helm chart + Kubernetes deploy runbook
├── docs/             # architecture, development, deployment, ADRs, runbooks
├── scripts/          # local dev helper scripts
├── docker-compose.yml
└── package.json      # npm workspaces (web, mobile)
```

## Quick start (Docker)

```bash
docker compose up --build            # Postgres + API + web
docker compose run --rm api poetry run alembic upgrade head   # first run: apply schema
```

Then open <http://localhost:8080> (nginx serves the web app and proxies `/v1` to the API).

## Local development

### API (`apps/api`)

```bash
cd apps/api
poetry install --with dev
poetry run alembic upgrade head       # requires a running Postgres
poetry run uvicorn app.main:app --reload
```

### Web (`apps/web`)

```bash
npm install
npm run web                           # dev server
npm run web:build                     # production build
```

### Mobile (`apps/mobile`)

```bash
npm run mobile                        # Expo dev server
```

### Typed API contract

The clients generate their types from the server's OpenAPI schema, so they never
drift. After changing the API, re-export the schema and regenerate:

```bash
cd apps/api && poetry run python scripts/export_openapi.py
cd ../web && npm run gen:api-types
```

`apps/web/src/lib/api/openapi.json` is the source of truth; CI fails if it is stale.

## Testing

```bash
cd apps/api && poetry run pytest      # API: unit + integration (+ coverage floor)
npm run test -w finance-tracking-app  # web: Vitest unit/component
npm run test:e2e -w finance-tracking-app   # web: Playwright E2E (needs the stack up)
```

DB-backed integration tests under `apps/api/tests/integration` (balance consistency,
idempotency, concurrency) are skipped when no database is reachable. To run them,
point `DATABASE_URL` at a migrated database:

```bash
DATABASE_URL=postgresql+asyncpg://finance:finance@localhost:5432/finance \
  poetry run pytest tests/integration
```

## Configuration

The API reads configuration from environment variables (see
[`apps/api/.env.example`](./apps/api/.env.example)):

| Variable | Default | Notes |
|---|---|---|
| `ENVIRONMENT` | `development` | `staging`/`production` enforce a strong `SECRET_KEY` |
| `SECRET_KEY` | `change-me` | Must be ≥32 chars and non-placeholder outside development |
| `DATABASE_URL` | local Postgres | async (`postgresql+asyncpg://…`) |
| `CORS_ORIGINS` | localhost | comma-separated allowlist |
| `REDIS_URL` | — | optional; enables distributed login throttling |
| `LOG_LEVEL` | `INFO` | `DEBUG`/`INFO`/`WARNING`/`ERROR`/`CRITICAL` |

## Deployment

A Helm chart (probes, HPA, PDBs, Ingress, pre-upgrade migration Job, non-root) lives
under [`deploy/helm`](./deploy/helm). See [`docs/deployment.md`](./docs/deployment.md)
and the [`deploy/README.md`](./deploy/README.md) runbook.

## Continuous integration

Workflows are **manual** (`workflow_dispatch`) — run them from the Actions tab or
with `gh workflow run`:

- **CI** — web lint/test/build, mobile typecheck, API ruff + pytest (Postgres
  service, coverage floor), Docker build, and Playwright E2E.
- **CodeQL** — static security analysis for Python and JS/TS (manual + weekly).
- **Security** — gitleaks, Trivy, and SBOM generation (manual + weekly).
- **Release** — on `v*.*.*` tags, publishes API and web images to GHCR with SBOM.

## Documentation

- Architecture: [`docs/architecture.md`](./docs/architecture.md) · [ADRs](./docs/adr/)
- Development guide: [`docs/development.md`](./docs/development.md)
- Deployment: [`docs/deployment.md`](./docs/deployment.md) · [`deploy/README.md`](./deploy/README.md)
- Operations runbooks: [`docs/runbooks.md`](./docs/runbooks.md)
- Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md) · Security policy: [`SECURITY.md`](./SECURITY.md)

## License

Licensed under the [Apache License 2.0](./LICENSE).
