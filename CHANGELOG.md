# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Account-to-account transfers: atomic, double-entry ledger movements between two
  of a user's accounts, recorded in the audit log.

## [0.1.0]

Initial release of the Sthira platform.

### API
- FastAPI modular monolith over PostgreSQL with `accounts`, `transactions`,
  `budgets`, and `goals` modules, layered router → service → repository → model.
- Double-entry ledger with `Numeric(19,4)` money handling, `SELECT … FOR UPDATE`
  row locks for balance updates, and `Idempotency-Key` support on transaction
  creation.
- Soft delete plus an append-only audit log for financial mutations.
- Session-cookie auth (bcrypt) with CSRF protection, per-email login throttling
  (in-memory or Redis), and role-based access control over an admin/audit surface.
- Structured JSON logging with request IDs, Prometheus `/metrics`, opt-in
  OpenTelemetry tracing, RFC 7807 error responses, and `/health/live` + `/health/ready`.
- Alembic migrations run as an explicit release step, not on boot.

### Clients
- React/Vite web app and Expo React Native app that generate their TypeScript
  types from the server's OpenAPI schema; CI fails on contract drift.

### Tooling & delivery
- Multi-stage non-root Docker images and a Docker Compose stack.
- Helm chart (probes, HPA, PDBs, Ingress, pre-upgrade migration Job) for Kubernetes.
- CI (web/mobile/API + Docker build + Playwright E2E), CodeQL, secret/vulnerability
  scanning with SBOM, and tag-driven image releases to GHCR.
