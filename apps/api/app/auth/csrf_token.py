"""CSRF token generation.

Lives in its own module so route handlers can import it without pulling in
``app.auth.wiring`` (which imports the route modules) and creating an import
cycle.
"""

import secrets


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)
