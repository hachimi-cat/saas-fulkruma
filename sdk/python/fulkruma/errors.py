"""Typed error class for the Fulkruma SDK.

Mirrors `FulkrumaError` from the Node SDK: every non-2xx response and
every enveloped `{ error: { code, message } }` payload raises this with
the upstream code preserved.
"""

from __future__ import annotations

from typing import Optional


class FulkrumaError(Exception):
    """Raised on any non-success response from a Fulkruma endpoint."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        request_id: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.request_id = request_id

    def __repr__(self) -> str:
        return (
            f"FulkrumaError(status={self.status}, code={self.code!r}, "
            f"message={self.message!r}, request_id={self.request_id!r})"
        )
