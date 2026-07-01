# Deployment

This directory holds the Kubernetes deployment artifacts for Finance Tracker.

```
deploy/
└── helm/finance-tracker/      # Helm chart (API + web + migrations Job)
```

For local (non-Kubernetes) runs use the root [`docker-compose.yml`](../docker-compose.yml)
instead — it is the fastest way to bring the full stack up on one machine.

## Architecture on Kubernetes

```
            ┌─────────────── Ingress (host: finance.example.com) ───────────────┐
            │  /v1/*  ──────────────────────────────►  Service: <release>-api   │
            │  /*     ──────────────────────────────►  Service: <release>-web   │
            └───────────────────────────────────────────────────────────────────┘
                         │                                        │
                 Deployment: api (FastAPI)              Deployment: web (nginx + SPA)
                 - 2..N replicas (HPA on CPU)           - static assets only
                 - liveness  /v1/health/live
                 - readiness /v1/health/ready
                 - envFrom: ConfigMap + Secret
                         │
                 External / managed Postgres  ◄── pre-install/upgrade Job: `alembic upgrade head`
```

The web container's bundle calls the API **same-origin** under `/v1`, and the
Ingress routes `/v1` to the API Service — so no cross-origin config is needed.

## Prerequisites

- A Kubernetes cluster and `kubectl` context pointed at it
- [Helm](https://helm.sh/) 3.x
- An **external/managed PostgreSQL** reachable from the cluster
- Container images pushed to the registry in `values.yaml`
  (`ghcr.io/vinayykkumar/finance-tracker/{api,web}`), produced by the
  [`release.yml`](../.github/workflows/release.yml) workflow on a `v*.*.*` tag

## Create the application Secret (production)

Do **not** put real secrets in `values*.yaml`. Create a Secret out-of-band and
reference it with `secret.existingSecret`:

```bash
kubectl create secret generic finance-app-secrets \
  --from-literal=SECRET_KEY="$(openssl rand -hex 32)" \
  --from-literal=DATABASE_URL="postgresql+asyncpg://USER:PASS@HOST:5432/finance"
```

> The API refuses to start in `ENVIRONMENT=production` if `SECRET_KEY` is the
> placeholder or shorter than 32 characters (enforced in `app/config.py`).

## Install / upgrade

```bash
# Render locally to inspect first (no cluster changes):
helm template finance ./deploy/helm/finance-tracker \
  -f deploy/helm/finance-tracker/values-production.yaml

# Lint:
helm lint ./deploy/helm/finance-tracker

# Install or upgrade:
helm upgrade --install finance ./deploy/helm/finance-tracker \
  -f deploy/helm/finance-tracker/values-production.yaml \
  --set secret.existingSecret=finance-app-secrets \
  --namespace finance --create-namespace
```

The pre-install/pre-upgrade hook Job runs `alembic upgrade head` **before** new
pods roll out, so schema and code move together.

## Verify

```bash
kubectl -n finance rollout status deploy/finance-finance-tracker-api
kubectl -n finance rollout status deploy/finance-finance-tracker-web
kubectl -n finance get pods,svc,ingress,hpa
```

## Rollback

```bash
helm -n finance history finance
helm -n finance rollback finance <REVISION>
```

> Rollback reverts Kubernetes objects but **not** database migrations. If a
> release included a destructive migration, restore the database from backup
> before rolling the app back. See [`docs/runbooks.md`](../docs/runbooks.md).

## What the chart includes

| Resource | Purpose |
|---|---|
| `Deployment` (api, web) | Workloads with resource requests/limits + non-root `securityContext` |
| `Service` (api, web) | ClusterIP services fronted by the Ingress |
| `Ingress` | Path-based routing: `/v1` → api, `/` → web; optional TLS |
| `HorizontalPodAutoscaler` | CPU-based autoscaling for the API |
| `PodDisruptionBudget` | Keeps ≥1 replica during voluntary disruptions |
| `ConfigMap` + `Secret` | Non-secret env + `SECRET_KEY`/`DATABASE_URL` |
| `Job` (hook) | `alembic upgrade head` on install/upgrade |
| `NetworkPolicy` (opt-in) | Restricts who can reach the API pods |
| `ServiceAccount` | Dedicated identity for the workloads |

## Key values

See [`values.yaml`](helm/finance-tracker/values.yaml) for the full set. Common overrides:

| Value | Default | Notes |
|---|---|---|
| `image.apiTag` / `image.webTag` | `.Chart.appVersion` | Pin to a released tag |
| `api.autoscaling.{min,max}Replicas` | 2 / 6 | API HPA bounds |
| `secret.existingSecret` | `""` | Use a pre-created Secret in prod |
| `ingress.host` | `finance.example.com` | Public hostname |
| `ingress.tls.enabled` | `false` | Enable with cert-manager |
| `networkPolicy.enabled` | `false` | Turn on in hardened clusters |
| `migrations.enabled` | `true` | Disable to manage migrations manually |
