"""Smoke test: async Postgres reachable with DATABASE_URL from .env (run from fin-backend)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import asyncpg

from app.config import get_settings


async def main() -> int:
    raw = get_settings().database_url
    dsn = raw.replace("postgresql+asyncpg://", "postgresql://", 1)
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=8)
    except Exception as e:  # noqa: BLE001 — surface any connect failure
        print(f"postgres_check_failed: {e}", file=sys.stderr)
        return 1
    try:
        one = await conn.fetchval("SELECT 1")
        print(f"postgres_ok: connected, SELECT 1 => {one}")
        return 0 if one == 1 else 2
    finally:
        await conn.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
