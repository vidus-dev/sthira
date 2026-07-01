# Operations Runbooks

Operational procedures for running the Finance Tracker API in production. These
assume the observability added to the service: JSON structured logs, a
Prometheus `/metrics` endpoint, opt-in OpenTelemetry tracing, and
`/v1/health/live` + `/v1/health/ready` probes.

## Health & readiness

| Probe | Path | Meaning |
|---|---|---|
| Liveness | `GET /v1/health/live` | Process is up; restart the pod if this fails |
| Readiness | `GET /v1/health/ready` | DB reachable; pull from the load balancer if this fails |

Wire `live` to the orchestrator's liveness probe and `ready` to the readiness
probe so traffic is only routed to instances that can reach Postgres.

## Observing a request

Every request carries an `X-Request-Id` (generated if absent). The access log
emits one JSON line per request with `request_id`, `method`, `path`,
`status_code`, and `duration_ms`. To trace a user-reported error, ask for the
`X-Request-Id` from the response and grep logs for it.

Metrics at `/metrics` (scrape with Prometheus):

- `http_requests_total{method,path,status}` — rate and error ratio
- `http_request_duration_seconds` — latency histogram (p50/p95/p99)
- `http_requests_in_progress` — saturation / in-flight load

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to ship traces to a collector for end-to-end
spans across the request.

## Deploy

1. Merge to `main` (CI green, required). Tag a release: `git tag vX.Y.Z && git push --tags`.
2. The release workflow builds and publishes `…-api` and `…-web` images to GHCR
   with provenance + SBOM.
3. Apply migrations **before** rolling out new app code:
   `alembic upgrade head` (run as a one-off job against the target DB).
4. Roll out the new image. Watch readiness, error rate, and latency.

## Rollback

1. Re-deploy the previous image tag (images are immutable in GHCR).
2. If a migration must be reverted: `alembic downgrade -1`. Prefer
   forward-fixing; only downgrade when the new migration is the cause and is
   known to be safely reversible.
3. Confirm `/v1/health/ready` and error rate return to baseline.

## Incident triage

1. **Is it up?** Check liveness/readiness across instances.
2. **What changed?** Correlate with the most recent deploy/tag.
3. **Where?** Use `http_requests_total` by `status` and `path` to localize the
   failing endpoint; pull `request_id`s from 5xx access logs.
4. **Why?** Unhandled errors are logged with stack traces (still RFC 7807 to the
   client). Traces (if OTLP is enabled) show the slow/failing span.
5. **Mitigate** — roll back (above) or scale out if saturation
   (`http_requests_in_progress`) is the driver.

## Secrets & configuration

- `SECRET_KEY` must be ≥32 chars and non-placeholder in staging/production
  (enforced at startup — the app refuses to boot otherwise).
- Rotate `SECRET_KEY` by deploying a new value; existing sessions are
  invalidated (users re-authenticate).
- For multi-replica deployments set `REDIS_URL` so login throttling is shared.
