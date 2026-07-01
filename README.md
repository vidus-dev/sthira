# Finance Tracker

A personal-finance platform built as a monorepo: a **React/Vite web app**, an
**Expo React Native mobile app**, and a **FastAPI modular-monolith API** backed
by PostgreSQL — shipped together with Docker Compose (nginx proxies `/v1` to the
API).

| Component | Path | Stack |
|---|---|---|
| Web | [`fin-front/`](./fin-front) | React 18, Vite, TypeScript, Tailwind, Vitest |
| Mobile | [`fin-mobile/`](./fin-mobile) | Expo, React Native, React Navigation |
| API | [`fin-backend/`](./fin-backend) | FastAPI, async SQLAlchemy 2.0, Alembic, Pydantic, Postgres |

## Architecture

The backend is a **modular monolith**: thin `v1` routers delegate to a
service-per-module, which uses a repository-per-module over async SQLAlchemy
models. Domain modules live under `fin-backend/app/modules/`
(`accounts`, `transactions`, `budgets`, `goals`).

```
HTTP → router (app/api/v1) → service (app/modules/*/service.py)
     → repository (app/modules/*/repository.py) → model (app/models)
```

Cross-cutting concerns:

- **Request IDs** — every request carries an `X-Request-Id` (generated or echoed).
- **Structured logging** — JSON logs with per-request context and latency (`app/observability`).
- **Metrics & tracing** — Prometheus `/metrics`; opt-in OpenTelemetry tracing via `OTEL_EXPORTER_OTLP_ENDPOINT`.
- **Security headers** — CSP, HSTS, X-Frame-Options, and more, on the API and nginx.
- **Problem+JSON** — errors follow [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807).
- **CSRF protection** — token required on authenticated mutating requests.
- **Login throttling** — per-email failure rate limiting (in-memory or Redis).
- **Idempotency** — `Idempotency-Key` support for transaction creation.

### Typed API contract

The web/mobile clients generate their types from the server's OpenAPI schema, so
they never drift from the API:

```bash
# Re-export the schema after changing the API, then regenerate client types
cd fin-backend && poetry run python scripts/export_openapi.py
cd ../fin-front && npm run gen:api-types
```

`fin-front/src/lib/api/openapi.json` is the source of truth; CI fails if it is
stale. Import domain types from `fin-front/src/lib/api/types.ts`.

See [`docs/architecture-review.md`](./docs/architecture-review.md) and the
[ADRs](./docs/adr/) for deeper context.

## Quick start (Docker)

```bash
# Build and run Postgres + API + web
docker compose up --build

# First run (or after pulling new migrations): apply the schema
docker compose run --rm api poetry run alembic upgrade head
```

Then open <http://localhost:8080>.

## Local development

### Backend (`fin-backend`)

```bash
cd fin-backend
poetry install --with dev
poetry run alembic upgrade head        # requires a running Postgres
poetry run uvicorn app.main:app --reload
```

Run the checks:

```bash
poetry run ruff check app tests        # lint
poetry run pytest                      # tests + coverage gate
```

DB-backed integration tests under `tests/integration` (account-balance
consistency, idempotency, and concurrency) are skipped automatically when no
database is reachable. To run them, point `DATABASE_URL` at a migrated database:

```bash
DATABASE_URL=postgresql+asyncpg://finance:finance@localhost:5432/finance \
  poetry run pytest tests/integration
```

### Web (`fin-front`)

```bash
npm install
npm run web                            # dev server
npm run web:build                      # production build
```

### Mobile (`fin-mobile`)

```bash
npm run mobile                         # Expo dev server
```

## Configuration

The API reads configuration from environment variables (see
[`fin-backend/.env.example`](./fin-backend/.env.example)):

| Variable | Default | Notes |
|---|---|---|
| `ENVIRONMENT` | `development` | `staging`/`production` enforce a strong `SECRET_KEY` |
| `SECRET_KEY` | `change-me` | Must be ≥32 chars and non-placeholder outside development |
| `DATABASE_URL` | local Postgres | async (`postgresql+asyncpg://…`) |
| `CORS_ORIGINS` | localhost | comma-separated allowlist |
| `LOG_LEVEL` | `INFO` | `DEBUG`/`INFO`/`WARNING`/`ERROR`/`CRITICAL` |

## Continuous integration

GitHub Actions are **manual-only** — run them from the Actions tab or with
`gh workflow run` (the security scans also run on a weekly schedule):

- **CI** ([`ci.yml`](./.github/workflows/ci.yml)) — web lint/test/build, mobile
  typecheck, API ruff + pytest (with a coverage floor), and a Docker Compose build.
  Trigger manually (`gh workflow run CI`).
- **CodeQL** ([`codeql.yml`](./.github/workflows/codeql.yml)) — static security
  analysis for Python and JavaScript/TypeScript; manual plus a weekly scheduled scan.
- **Security** ([`security.yml`](./.github/workflows/security.yml)) — gitleaks
  secret scanning, Trivy vulnerability scanning, and SBOM generation; manual plus a
  weekly scheduled scan.
- **Release** ([`release.yml`](./.github/workflows/release.yml)) — on `v*.*.*`
  tags, publishes API and web images to GHCR with provenance + SBOM.
- **Dependabot** keeps dependencies patched.

## Operations & governance

- Operations runbooks: [`docs/runbooks.md`](./docs/runbooks.md)
- Branch-protection setup: [`docs/branch-protection.md`](./docs/branch-protection.md)
- Contribution workflow: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Vulnerability disclosure: [`SECURITY.md`](./SECURITY.md)
- Change history: [`CHANGELOG.md`](./CHANGELOG.md)

## License

Licensed under the [Apache License 2.0](./LICENSE).
