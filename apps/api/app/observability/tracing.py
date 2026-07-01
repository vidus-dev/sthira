"""OpenTelemetry distributed tracing (opt-in).

Tracing is enabled only when an OTLP endpoint is configured (via
``OTEL_EXPORTER_OTLP_ENDPOINT``); otherwise this is a no-op so local and CI runs
need no collector. Spans are exported over OTLP/HTTP and the FastAPI app is
auto-instrumented, so each request becomes a trace correlated with the access
logs by request id.
"""

from __future__ import annotations

from fastapi import FastAPI

_instrumented = False


def configure_tracing(app: FastAPI, *, endpoint: str | None, service_name: str) -> bool:
    """Instrument ``app`` for tracing. Returns True if tracing was enabled.

    No-ops (returns False) when no endpoint is set, or if instrumentation has
    already been installed in this process.
    """
    global _instrumented
    if not endpoint or _instrumented:
        return False

    # Imported lazily so the dependency is only touched when tracing is on.
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    provider = TracerProvider(resource=Resource.create({"service.name": service_name}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app)

    _instrumented = True
    return True
