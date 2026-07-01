"""Tests for the JSON structured logging formatter and setup."""

import json
import logging

from app.observability.logging import JsonFormatter, configure_logging, get_logger


def _format(record: logging.LogRecord) -> dict:
    return json.loads(JsonFormatter().format(record))


def _make_record(**kwargs) -> logging.LogRecord:
    defaults = dict(
        name="app.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )
    defaults.update(kwargs)
    return logging.LogRecord(**defaults)


def test_format_produces_valid_json_with_core_fields() -> None:
    out = _format(_make_record())
    assert out["level"] == "INFO"
    assert out["logger"] == "app.test"
    assert out["message"] == "hello world"
    assert "ts" in out


def test_extra_fields_are_included() -> None:
    record = _make_record()
    record.request_id = "rid-42"
    record.duration_ms = 12.5
    out = _format(record)
    assert out["request_id"] == "rid-42"
    assert out["duration_ms"] == 12.5


def test_exception_info_is_rendered() -> None:
    try:
        raise ValueError("boom")
    except ValueError:
        import sys

        record = _make_record(exc_info=sys.exc_info())
    out = _format(record)
    assert "ValueError: boom" in out["exc_info"]


def test_configure_logging_is_idempotent() -> None:
    configure_logging("DEBUG")
    configure_logging("INFO")
    root = logging.getLogger()
    assert len(root.handlers) == 1
    assert root.level == logging.INFO
    assert isinstance(root.handlers[0].formatter, JsonFormatter)


def test_get_logger_returns_named_logger() -> None:
    assert get_logger("app.widgets").name == "app.widgets"
