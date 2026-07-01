# Finance Platform — Architecture Review

Monorepo: React/Vite web (`fin-front`), Expo React Native (`fin-mobile`), FastAPI modular monolith (`fin-backend`) + Postgres, shipped via Docker Compose with nginx proxying `/v1` to the API.

> **Verdict: strong skeleton, pre-production.**
> The layering (router → service → repository → model), money typing (`Numeric(19,4)`), async SQLAlchemy + Alembic, and per-request ownership checks are genuinely well done. But it is not yet production-grade: no CI, almost no tests, no observability, cookie-auth without CSRF/rate-limiting, and an account-balance update path that races under concurrency. These are fixable and mostly well-scoped.

## Snapshot

| Metric | Value |
|---|---|
| To production-grade | ~50% |
| Test files in repo | ~1 |
| CI workflows | 0 |
| P0 blockers | 9 |
| Domain modules | 4 |

## Readiness scorecard by dimension

| Dimension | Grade | Where it stands today |
|---|:---:|---|
| Code structure / layering | A- | Thin v1 routers, service + repository per module, Pydantic schemas. Clean and idiomatic. |
| Data modeling | B+ | UUID PKs, indexed FKs, cascade deletes, tz-aware timestamps, correct money type. |
| Auth (mechanism) | B- | bcrypt hashing, signed cookie session, email lowercased + unique. Sound primitives. |
| Security hardening | C- | No CSRF, no rate-limit/lockout, weak default secret, cookie not Secure, no security headers. |
| API contract / typing | C+ | Types hand-duplicated in web + mobile; error shape mismatch (FastAPI `detail` vs FE RFC-7807 parser). |
| Scalability / infra | C | No Redis, no job queue, no IaC/orchestration, migrations run in-process on boot. |
| Automated testing | D | One FE unit test, zero backend tests, no E2E. |
| CI / CD | F | No pipeline — lint, typecheck, tests, builds are all manual. |
| Observability | D | No structured logs, metrics, tracing, or error tracking. |
| Data integrity / concurrency | C | Balance via read-modify-write with no row lock; no idempotency keys; no audit trail. |
| Mobile auth fit | C | Cookie sessions + `credentials:include` is web-centric; RN cookie persistence is fragile. |

## Critical gaps that block production (P0)

### 1. Account balances can corrupt under concurrency
`TransactionService.create/update/delete` reads the account, mutates `acc.balance` in Python, then commits — with no `SELECT … FOR UPDATE` and no version/optimistic check. Two concurrent writes to the same account lose updates and the stored balance drifts from the ledger. There are also no idempotency keys, so a retried/double-tapped create writes a duplicate transaction (the repo's own `transaction-flow-reliability.md` / `transaction-import-idempotency.md` notes flag exactly this).

### 2. Cookie auth without CSRF, rate-limiting, or secure cookies
Session is a signed cookie with `same_site="lax"`, `https_only=False`, and a default `secret_key="change-me"` (Compose injects a placeholder). With `allow_credentials=True` + `allow_methods=["*"]` CORS and no CSRF token, cookie-auth mutations are exposed. `/v1/auth/login` has no rate limit or lockout (brute-force open), and nginx serves no security headers (CSP/HSTS/X-Frame-Options).

### Remaining P0 blockers

| # | Blocker | Fix |
|---|---|---|
| 3 | Migrations run in-process on every boot | `init_db()` calls `alembic upgrade head` at startup → multiple replicas race. Move to a dedicated release/job step; app boot should not migrate. |
| 4 | No automated tests | Stand up pytest (service + repository + auth) and Vitest/RTL; gate merges on them. |
| 5 | No CI pipeline | GitHub Actions: lint + typecheck + test + docker build on every PR; block on red. |
| 6 | No observability | Structured JSON logs, propagate the `X-Request-Id` the FE already sends, add Sentry + a real readiness probe that checks the DB. |
| 7 | Demo-auth fallback in prod | `liveAuthCoordinator` falls back to a localStorage "demo session" on network/5xx — can look authenticated. Gate strictly behind a dev flag. |
| 8 | Secrets & per-env config | Fail fast if `SECRET_KEY` is default/short; set cookie `Secure` + tighten CORS; load secrets from a manager, not baked defaults. |
| 9 | Hard deletes, no audit trail | Financial mutations cascade-delete with no history. Add soft-delete + append-only audit log before real money data lands. |

## Prioritized roadmap (summary)

**Phase 1 — Harden (ship-blockers):** concurrency-safe ledger, auth hardening, CI + baseline tests, logging/Sentry, migration job, secure config.

**Phase 2 — Scale & contract:** OpenAPI-generated typed clients, pagination, mobile token auth, Redis (sessions/cache/rate-limit), background jobs, E2E tests.

**Phase 3 — Top-tier maturity:** IaC + orchestration, OpenTelemetry + metrics + SLOs, RBAC + admin plane, backups/replicas, supply-chain scanning, repo hygiene.

## Target shape, in one line
Keep the modular monolith (it's a strength) but make the ledger concurrency-safe and idempotent, put auth on revocable tokens/sessions with CSRF + rate limits, generate one typed API contract for both clients, run migrations as a release step, and wrap everything in CI + tests + tracing/metrics/error-tracking. That moves this from a clean prototype to an operable, auditable financial product.
