"""Login rate limiting facade.

Preserves the simple ``record_login_failure`` / ``clear_login_failures`` /
``is_login_throttled`` API used by the auth routes while delegating to a
configurable backend (in-process by default, Redis when ``REDIS_URL`` is set so
the limit holds across replicas). See :mod:`app.auth.throttle`.
"""

from __future__ import annotations

from functools import lru_cache

from app.auth.throttle import InMemoryLoginThrottle, LoginThrottle, RedisLoginThrottle
from app.config import get_settings


@lru_cache
def _backend() -> LoginThrottle:
    settings = get_settings()
    redis_url = getattr(settings, "redis_url", None)
    if redis_url:
        import redis

        client = redis.Redis.from_url(redis_url)
        return RedisLoginThrottle(client)
    return InMemoryLoginThrottle()


def record_login_failure(email: str) -> None:
    _backend().record_failure(email)


def clear_login_failures(email: str) -> None:
    _backend().clear(email)


def is_login_throttled(email: str) -> bool:
    return _backend().is_throttled(email)
