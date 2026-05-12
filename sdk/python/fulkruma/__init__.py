"""Official Python SDK for Fulkruma.

Mirrors the Node SDK (`@forjio/fulkruma-node`) API surface — HMAC-signed
requests, 14 resource namespaces, optional `X-Fulkruma-On-Behalf-Of`
platform-admin scoping, plus webhook signature verification.
"""

from .client import FulkrumaClient
from .errors import FulkrumaError
from .webhooks import verify_webhook

__all__ = [
    "FulkrumaClient",
    "FulkrumaError",
    "verify_webhook",
]

__version__ = "0.1.0"
