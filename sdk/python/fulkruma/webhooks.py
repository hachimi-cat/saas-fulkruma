"""HMAC-SHA256 webhook signature verifier for Fulkruma.

Fulkruma signs every webhook delivery with::

    Fulkruma-Signature: t=<unix_seconds>,v1=<hex>

where ``<hex> = HMAC-SHA256(secret, f"{t}.{rawBody}")``. The *raw* body
bytes are what got signed — re-serialising parsed JSON will produce
different whitespace and the signature will never match.

Flask example::

    from flask import Flask, request, abort
    from fulkruma import verify_webhook, FulkrumaError

    app = Flask(__name__)

    @app.post("/webhooks/fulkruma")
    def fulkruma_hook():
        raw = request.get_data()
        sig = request.headers.get("Fulkruma-Signature")
        try:
            event = verify_webhook(raw_body=raw, signature=sig, secret=SECRET)
        except FulkrumaError:
            abort(400)
        # event["type"], event["data"], ...
        return "", 204
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional, Union

from .errors import FulkrumaError


def verify_webhook(
    *,
    raw_body: Union[bytes, str],
    signature: Optional[str],
    secret: str,
    tolerance_sec: int = 300,
    now: Optional[float] = None,
) -> Dict[str, Any]:
    """Verify and parse an inbound Fulkruma webhook.

    Returns the decoded event envelope on success. Raises
    :class:`FulkrumaError` on any failure (missing header, drift, bad
    signature, malformed JSON).

    Parameters
    ----------
    raw_body:
        The unparsed request body as received over the wire. ``str`` is
        encoded as UTF-8 before hashing.
    signature:
        The value of the ``Fulkruma-Signature`` header.
    secret:
        The endpoint's shared signing secret.
    tolerance_sec:
        Maximum drift in seconds — defaults to 300 (5 min), matching the
        Node SDK and Stripe/GitHub conventions.
    now:
        Inject a clock for tests; seconds since epoch.
    """
    if not signature:
        raise FulkrumaError(0, "missing_signature", "missing Fulkruma-Signature header")

    parts: Dict[str, str] = {}
    for segment in signature.split(","):
        segment = segment.strip()
        if not segment or "=" not in segment:
            continue
        k, _, v = segment.partition("=")
        parts[k.strip()] = v.strip()

    ts = parts.get("t")
    v1 = parts.get("v1")
    if not ts or not v1:
        raise FulkrumaError(0, "malformed_signature", "malformed signature header")

    try:
        ts_num = int(ts)
    except ValueError:
        raise FulkrumaError(0, "malformed_signature", "non-numeric timestamp") from None

    current = now if now is not None else time.time()
    drift = abs(int(current) - ts_num)
    if drift > tolerance_sec:
        raise FulkrumaError(
            0, "signature_expired", f"signature timestamp {drift}s out of tolerance",
        )

    body_bytes = raw_body.encode("utf-8") if isinstance(raw_body, str) else raw_body
    expected = hmac.new(
        secret.encode("utf-8"),
        f"{ts}.".encode("utf-8") + body_bytes,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, v1):
        raise FulkrumaError(0, "bad_signature", "bad signature")

    body_str = body_bytes.decode("utf-8")
    try:
        return json.loads(body_str)
    except ValueError:
        raise FulkrumaError(0, "invalid_body", "webhook body is not valid JSON") from None
