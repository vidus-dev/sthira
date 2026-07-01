# Deployment

## Local / single machine

Use Docker Compose — the fastest way to bring the full stack (Postgres + API + web)
up on one host:

```bash
docker compose up --build
docker compose run --rm api poetry run alembic upgrade head
```

## Kubernetes

A Helm chart under [`deploy/helm`](../deploy/helm) deploys the API and web behind an
Ingress that routes `/v1` to the API and `/` to the web app. It includes:

- liveness / readiness / startup probes
- Horizontal Pod Autoscaler and Pod Disruption Budgets
- a **pre-upgrade migration Job** that runs `alembic upgrade head` before the new
  pods roll out (the app never migrates on boot)
- ConfigMap + Secret for configuration
- non-root security context and an opt-in NetworkPolicy

See the [`deploy/README.md`](../deploy/README.md) runbook for the install/upgrade
commands and value reference.

## Releases

Pushing a `v*.*.*` tag runs the **Release** workflow, which builds the API and web
images, publishes them to GHCR with provenance + SBOM, and creates a GitHub release.

## Configuration & secrets

All runtime configuration is environment-driven (see [`apps/api/.env.example`](../apps/api/.env.example)).
In `staging`/`production` the API fails fast unless `SECRET_KEY` is strong and
non-placeholder. Provide secrets through your platform's secret store (Kubernetes
Secret, cloud secrets manager) — never bake them into images.
