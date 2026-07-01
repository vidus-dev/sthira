import logging
import traceback

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.problem import problem_body, problem_json_response

log = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return problem_json_response(
            request=request,
            status=status.HTTP_400_BAD_REQUEST,
            title="Bad request",
            detail=str(exc),
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exc_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, list):
            detail_str = "; ".join(str(x) for x in detail)
        else:
            detail_str = str(detail)
        title = "HTTP error"
        if exc.status_code == 401:
            title = "Unauthorized"
        elif exc.status_code == 403:
            title = "Forbidden"
        elif exc.status_code == 404:
            title = "Not found"
        elif exc.status_code == 409:
            title = "Conflict"
        elif exc.status_code == 429:
            title = "Too many requests"
        return problem_json_response(
            request=request,
            status=exc.status_code,
            title=title,
            detail=detail_str,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        parts: list[str] = []
        for err in exc.errors():
            loc = ".".join(str(x) for x in err.get("loc", ()))
            msg = err.get("msg", "")
            parts.append(f"{loc}: {msg}")
        return problem_json_response(
            request=request,
            status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            title="Validation error",
            detail="; ".join(parts) if parts else "Invalid request body",
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        log.error("Unhandled error: %s\n%s", exc, traceback.format_exc())
        rid = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=problem_body(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                title="Internal server error",
                detail="An unexpected error occurred.",
                instance=str(request.url.path),
                request_id=str(rid) if rid is not None else None,
            ),
            media_type="application/problem+json",
        )
