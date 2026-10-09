"""Domain errors that map to HTTP status codes (see ``app.api.exception_handlers``).

``ValueError`` (bad input) already maps to 400.
"""


class NotFoundError(LookupError):
    """A referenced row doesn't exist in the caller's household (404)."""


class ConflictError(Exception):
    """The request clashes with existing state, e.g. a duplicate import (409)."""
