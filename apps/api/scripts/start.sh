#!/bin/sh
# Container entrypoint: optionally apply migrations, then serve on $PORT (Render sets it).
set -e
if [ "${RUN_MIGRATIONS_ON_START:-false}" = "true" ]; then
  alembic upgrade head
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips="*"
