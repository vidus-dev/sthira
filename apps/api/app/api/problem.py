"""RFC 7807 problem+json responses."""

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


def problem_body(
    *,
    status: int,
    title: str,
    detail: str,
    type_: str = "about:blank",
    instance: str | None = None,
    request_id: str | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "type": type_,
        "title": title,
        "status": status,
        "detail": detail,
    }
    if instance is not None:
        body["instance"] = instance
    if request_id is not None:
        body["request_id"] = request_id
    return body


def problem_json_response(
    *,
    request: Request,
    status: int,
    title: str,
    detail: str,
    type_: str = "about:blank",
) -> JSONResponse:
    rid = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status,
        content=problem_body(
            status=status,
            title=title,
            detail=detail,
            type_=type_,
            instance=str(request.url.path),
            request_id=str(rid) if rid is not None else None,
        ),
        media_type="application/problem+json",
    )
