from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.exception_handlers import register_exception_handlers
from app.api.v1 import health as health_v1
from app.config import get_settings
from app.db.session import close_engine, init_db
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.observability.logging import configure_logging
from app.observability.metrics import MetricsMiddleware, metrics_endpoint
from app.observability.tracing import configure_tracing


def create_app(*, enable_auth: bool = True) -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        await init_db()
        yield
        await close_engine()

    app = FastAPI(title="Finance API", version="0.1.0", lifespan=lifespan)
    register_exception_handlers(app)

    if enable_auth:
        from app.auth.wiring import install_auth_stack

        install_auth_stack(app)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-Request-Id",
            "X-CSRF-Token",
            "Idempotency-Key",
            "Accept",
        ],
        expose_headers=["X-Request-Id"],
    )
    app.add_middleware(AccessLogMiddleware)
    if settings.metrics_enabled:
        app.add_middleware(MetricsMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    configure_tracing(
        app,
        endpoint=settings.otel_exporter_otlp_endpoint,
        service_name=settings.service_name,
    )

    if settings.metrics_enabled:
        app.add_route("/metrics", metrics_endpoint, include_in_schema=False)

    v1 = APIRouter(prefix="/v1")
    v1.include_router(health_v1.router)
    if enable_auth:
        from app.api.v1 import accounts as accounts_v1
        from app.api.v1 import admin as admin_v1
        from app.api.v1 import budgets as budgets_v1
        from app.api.v1 import categories as categories_v1
        from app.api.v1 import export as export_v1
        from app.api.v1 import goals as goals_v1
        from app.api.v1 import household as household_v1
        from app.api.v1 import monthly_payments as monthly_payments_v1
        from app.api.v1 import summary as summary_v1
        from app.api.v1 import transactions as transactions_v1
        from app.api.v1 import transfers as transfers_v1
        from app.auth.wiring import include_auth_routes

        include_auth_routes(v1)
        v1.include_router(household_v1.router)
        v1.include_router(goals_v1.router)
        v1.include_router(accounts_v1.router)
        v1.include_router(categories_v1.router)
        v1.include_router(transactions_v1.router)
        v1.include_router(transfers_v1.router)
        v1.include_router(monthly_payments_v1.router)
        v1.include_router(summary_v1.router)
        v1.include_router(export_v1.router)
        v1.include_router(budgets_v1.router)
        v1.include_router(admin_v1.router)
    app.include_router(v1)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {"service": "finance-api", "docs": "/docs"}

    return app
