"""Structured (JSON) logging for the API.

Emits one JSON object per log record so logs are machine-parseable by
aggregators (CloudWatch, Loki, Datadog, ...). Pure stdlib — no extra deps.

Use :func:`configure_logging` once at startup, then :func:`get_logger` for a
module logger. Attach per-request context (e.g. ``request_id``) via the
``extra=`` argument; any non-standard record attributes are merged into the
JSON output automatically.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

# Attributes present on every ``logging.LogRecord``; anything beyond these was
# supplied by the caller via ``extra=`` and should be surfaced in the JSON.
_RESERVED: frozenset[str] = frozenset(
    {
        "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
        "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
        "created", "msecs", "relativeCreated", "thread", "threadName",
        "processName", "process", "taskName",
    }
)


class JsonFormatter(logging.Formatter):
    """Render a ``LogRecord`` as a single-line JSON object."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack_info"] = self.formatStack(record.stack_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    """Install the JSON formatter on the root logger (idempotent).

    Replaces any existing handlers so repeated calls (e.g. across workers or
    test runs) don't multiply output.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # uvicorn ships its own handlers; defer to root so everything is JSON.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True


def get_logger(name: str) -> logging.Logger:
    """Return a module logger (thin wrapper over :func:`logging.getLogger`)."""
    return logging.getLogger(name)
