"""Login throttling backends.

Two interchangeable implementations of a sliding-window failure counter keyed by
normalized email:

- :class:`InMemoryLoginThrottle` — process-local; fine for a single replica or
  development. Not shared across processes.
- :class:`RedisLoginThrottle` — shared across replicas via a Redis sorted set,
  so a clustered deployment enforces one global limit.

Both expose the same small interface (``record_failure`` / ``clear`` /
``is_throttled``); :func:`app.auth.login_throttle` selects one based on config.
"""

from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock
from typing import Protocol

WINDOW_SEC = 15 * 60
MAX_ATTEMPTS = 12


def normalize_email(email: str) -> str:
    return email.strip().lower()


class LoginThrottle(Protocol):
    def record_failure(self, email: str) -> None: ...
    def clear(self, email: str) -> None: ...
    def is_throttled(self, email: str) -> bool: ...


class InMemoryLoginThrottle:
    """Process-local sliding-window throttle."""

    def __init__(
        self,
        *,
        window_sec: int = WINDOW_SEC,
        max_attempts: int = MAX_ATTEMPTS,
        time_fn: Callable[[], float] = time.monotonic,
    ) -> None:
        self._window = window_sec
        self._max = max_attempts
        self._now = time_fn
        self._lock = Lock()
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> None:
        q = self._failures[key]
        while q and now - q[0] > self._window:
            q.popleft()

    def record_failure(self, email: str) -> None:
        key = normalize_email(email)
        now = self._now()
        with self._lock:
            self._prune(key, now)
            self._failures[key].append(now)

    def clear(self, email: str) -> None:
        with self._lock:
            self._failures.pop(normalize_email(email), None)

    def is_throttled(self, email: str) -> bool:
        key = normalize_email(email)
        now = self._now()
        with self._lock:
            self._prune(key, now)
            return len(self._failures[key]) >= self._max


class RedisLoginThrottle:
    """Cluster-wide throttle backed by a Redis sorted set per email.

    The ``client`` is any object implementing the handful of Redis commands used
    below (``zadd``/``zremrangebyscore``/``zcard``/``expire``/``delete``), so it
    can be a real ``redis.Redis`` or a fake in tests. Wall-clock time is used for
    scores so independent replicas agree on the window.
    """

    def __init__(
        self,
        client,
        *,
        window_sec: int = WINDOW_SEC,
        max_attempts: int = MAX_ATTEMPTS,
        time_fn: Callable[[], float] = time.time,
        key_prefix: str = "login_throttle:",
    ) -> None:
        self._client = client
        self._window = window_sec
        self._max = max_attempts
        self._now = time_fn
        self._prefix = key_prefix

    def _key(self, email: str) -> str:
        return f"{self._prefix}{normalize_email(email)}"

    def record_failure(self, email: str) -> None:
        key = self._key(email)
        now = self._now()
        self._client.zremrangebyscore(key, 0, now - self._window)
        # Unique member per failure (scored by time) so simultaneous failures —
        # including from other replicas at the same instant — all count.
        self._client.zadd(key, {uuid.uuid4().hex: now})
        self._client.expire(key, self._window)

    def clear(self, email: str) -> None:
        self._client.delete(self._key(email))

    def is_throttled(self, email: str) -> bool:
        key = self._key(email)
        now = self._now()
        self._client.zremrangebyscore(key, 0, now - self._window)
        return int(self._client.zcard(key)) >= self._max
