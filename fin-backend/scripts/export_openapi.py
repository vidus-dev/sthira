"""Export the FastAPI OpenAPI schema to a JSON file.

Single source of truth for the API contract: the web/mobile clients generate
their types from this file, so they never drift from the server.

    poetry run python scripts/export_openapi.py [output_path]

Defaults to writing ../fin-front/src/lib/api/openapi.json relative to the repo.
Building the app touches no database, so this is safe to run anywhere.
"""

from __future__ import annotations

import json
import os
import sys

# Make ``app`` importable when run as a plain script (scripts/ is sys.path[0]).
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# A weak dev secret is fine here — we only build the app to read its schema.
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("SECRET_KEY", "openapi-export-not-a-real-secret")

from app.factory import create_app  # noqa: E402

DEFAULT_OUTPUT = os.path.join(
    os.path.dirname(__file__), "..", "..", "fin-front", "src", "lib", "api", "openapi.json"
)


def main() -> int:
    output = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_OUTPUT
    app = create_app(enable_auth=True)
    schema = app.openapi()
    output = os.path.abspath(output)
    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Wrote OpenAPI schema ({len(schema.get('paths', {}))} paths) to {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
