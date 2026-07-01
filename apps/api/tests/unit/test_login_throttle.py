"""Tests for login throttling backends and the facade."""

import pytest
from app.auth import login_throttle
from app.auth.throttle import (
    MAX_ATTEMPTS,
    WINDOW_SEC,
    InMemoryLoginThrottle,
    RedisLoginThrottle,
)


class TestInMemoryLoginThrottle:
    def test_fresh_email_not_throttled(self) -> None:
        t = InMemoryLoginThrottle()
        assert t.is_throttled("alice@example.com") is False

    def test_throttles_after_max_attempts(self) -> None:
        t = InMemoryLoginThrottle()
        for _ in range(MAX_ATTEMPTS):
            t.record_failure("bob@example.com")
        assert t.is_throttled("bob@example.com") is True

    def test_below_max_not_throttled(self) -> None:
        t = InMemoryLoginThrottle()
        for _ in range(MAX_ATTEMPTS - 1):
            t.record_failure("carol@example.com")
        assert t.is_throttled("carol@example.com") is False

    def test_email_is_normalized(self) -> None:
        t = InMemoryLoginThrottle()
        for _ in range(MAX_ATTEMPTS):
            t.record_failure("  Dave@Example.COM  ")
        assert t.is_throttled("dave@example.com") is True

    def test_clear_resets(self) -> None:
        t = InMemoryLoginThrottle()
        for _ in range(MAX_ATTEMPTS):
            t.record_failure("erin@example.com")
        assert t.is_throttled("erin@example.com") is True
        t.clear("erin@example.com")
        assert t.is_throttled("erin@example.com") is False

    def test_failures_pruned_outside_window(self) -> None:
        clock = {"t": 1000.0}
        t = InMemoryLoginThrottle(time_fn=lambda: clock["t"])
        for _ in range(MAX_ATTEMPTS):
            t.record_failure("frank@example.com")
        assert t.is_throttled("frank@example.com") is True
        clock["t"] += WINDOW_SEC + 1
        assert t.is_throttled("frank@example.com") is False


class FakeRedis:
    """Minimal in-memory stand-in for the Redis commands the throttle uses."""

    def __init__(self) -> None:
        self.store: dict[str, dict[str, float]] = {}

    def zadd(self, key: str, mapping: dict[str, float]) -> None:
        self.store.setdefault(key, {}).update(mapping)

    def zremrangebyscore(self, key: str, lo: float, hi: float) -> None:
        members = self.store.get(key, {})
        for m, score in list(members.items()):
            if lo <= score <= hi:
                del members[m]

    def zcard(self, key: str) -> int:
        return len(self.store.get(key, {}))

    def expire(self, key: str, seconds: int) -> None:  # noqa: ARG002 - no TTL in fake
        pass

    def delete(self, key: str) -> None:
        self.store.pop(key, None)


class TestRedisLoginThrottle:
    def test_throttles_after_max_attempts(self) -> None:
        t = RedisLoginThrottle(FakeRedis())
        for _ in range(MAX_ATTEMPTS):
            t.record_failure("grace@example.com")
        assert t.is_throttled("grace@example.com") is True

    def test_clear_resets(self) -> None:
        t = RedisLoginThrottle(FakeRedis())
        for _ in range(MAX_ATTEMPTS):
            t.record_failure("heidi@example.com")
        t.clear("heidi@example.com")
        assert t.is_throttled("heidi@example.com") is False

    def test_failures_pruned_outside_window(self) -> None:
        clock = {"t": 1000.0}
        t = RedisLoginThrottle(FakeRedis(), time_fn=lambda: clock["t"])
        for _ in range(MAX_ATTEMPTS):
            t.record_failure("ivan@example.com")
        assert t.is_throttled("ivan@example.com") is True
        clock["t"] += WINDOW_SEC + 1
        assert t.is_throttled("ivan@example.com") is False


class TestFacade:
    @pytest.fixture(autouse=True)
    def reset_backend(self) -> None:
        login_throttle._backend.cache_clear()
        yield
        login_throttle._backend.cache_clear()

    def test_facade_uses_in_memory_by_default(self) -> None:
        assert isinstance(login_throttle._backend(), InMemoryLoginThrottle)

    def test_facade_round_trip(self) -> None:
        for _ in range(MAX_ATTEMPTS):
            login_throttle.record_login_failure("judy@example.com")
        assert login_throttle.is_login_throttled("judy@example.com") is True
        login_throttle.clear_login_failures("judy@example.com")
        assert login_throttle.is_login_throttled("judy@example.com") is False
