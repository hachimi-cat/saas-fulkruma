"""High-level Fulkruma HMAC client.

Mirrors `FulkrumaClient` from the Node SDK 1:1:

- ``Authorization: Fulkruma-HMAC-SHA256 keyId=…, scope=*, signature=…``
- ``X-Fulkruma-Timestamp: <unix>``
- ``X-Fulkruma-On-Behalf-Of: <accountId>`` for platform-admin keys
- ``Idempotency-Key`` on every mutation that needs replay safety
- Standard ``{ data, error, meta }`` envelope unwrapping
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx

from .errors import FulkrumaError
from .resources import (
    AddressesResources,
    AdminResources,
    ApiKeysResources,
    AuditLogResources,
    BillingResources,
    DeliveriesResources,
    IntegrationsResources,
    LicensesResources,
    ProductsResources,
    ShipmentsResources,
    ShippingResources,
    StatsResources,
    StockResources,
    WarehousesResources,
    WebhooksResources,
)


class FulkrumaClient:
    """HMAC-signed client for the Fulkruma REST API.

    Parameters
    ----------
    key_id:
        HMAC access key id, e.g. ``AKIAFULK...``.
    secret:
        HMAC secret.
    base_url:
        Default ``https://fulkruma.com``. Trailing slashes are stripped.
    on_behalf_of:
        Optional merchant ``accountId`` — forwarded as
        ``X-Fulkruma-On-Behalf-Of``. Only allowed when ``key_id`` holds
        the ``fulkruma:platform:admin`` scope.
    timeout_ms:
        Per-request timeout in milliseconds. Default 30 000.
    http:
        Inject a pre-configured ``httpx.Client`` (e.g. with a custom
        transport for tests). Caller owns its lifecycle.
    """

    def __init__(
        self,
        *,
        key_id: str,
        secret: str,
        base_url: str = "https://fulkruma.com",
        on_behalf_of: Optional[str] = None,
        timeout_ms: int = 30_000,
        http: Optional[httpx.Client] = None,
    ) -> None:
        if not key_id or not secret:
            raise ValueError("FulkrumaClient: key_id and secret are required")
        self.key_id = key_id
        self._secret = secret
        self.base_url = base_url.rstrip("/")
        self._default_obo = on_behalf_of
        self.timeout_ms = timeout_ms
        self._http = http or httpx.Client(timeout=timeout_ms / 1000.0)
        self._owns_http = http is None

        # Resource namespaces — match the Node SDK property names.
        self.products = ProductsResources(self)
        self.warehouses = WarehousesResources(self)
        self.stock = StockResources(self)
        self.addresses = AddressesResources(self)
        self.shipments = ShipmentsResources(self)
        self.shipping = ShippingResources(self)
        self.licenses = LicensesResources(self)
        self.deliveries = DeliveriesResources(self)
        self.api_keys = ApiKeysResources(self)
        self.audit_log = AuditLogResources(self)
        self.billing = BillingResources(self)
        self.integrations = IntegrationsResources(self)
        self.stats = StatsResources(self)
        self.webhooks = WebhooksResources(self)
        self.admin = AdminResources(self)

    # ─── Lifecycle ───────────────────────────────────────────────────────

    def close(self) -> None:
        if self._owns_http:
            self._http.close()

    def __enter__(self) -> "FulkrumaClient":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    def for_merchant(self, account_id: str) -> "FulkrumaClient":
        """Clone scoped to a specific merchant. For platform-admin keys."""
        return FulkrumaClient(
            key_id=self.key_id,
            secret=self._secret,
            base_url=self.base_url,
            on_behalf_of=account_id,
            timeout_ms=self.timeout_ms,
        )

    # ─── Internal helpers ────────────────────────────────────────────────

    @staticmethod
    def _qs(params: Dict[str, Any]) -> str:
        entries = [(k, v) for k, v in params.items() if v is not None]
        if not entries:
            return ""
        # str(bool) → "True"/"False"; Node SDK emits the JS coercion ("true"/"false")
        norm = []
        for k, v in entries:
            if isinstance(v, bool):
                norm.append((k, "true" if v else "false"))
            else:
                norm.append((k, str(v)))
        return "?" + urlencode(norm)

    @staticmethod
    def _gen_idem() -> str:
        return f"idem_{uuid.uuid4()}"

    def _sign(
        self,
        *,
        method: str,
        path: str,
        body: Optional[str],
        idempotency_key: Optional[str],
    ) -> Dict[str, str]:
        ts = str(int(time.time()))
        body_hash = hashlib.sha256((body or "").encode("utf-8")).hexdigest()
        idem = f"\n{idempotency_key}" if idempotency_key else ""
        string_to_sign = f"{method.upper()}\n{path}\n{ts}\n{body_hash}{idem}"
        signature = hmac.new(
            self._secret.encode("utf-8"),
            string_to_sign.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return {"signature": signature, "timestamp": ts}

    # ─── Low-level request ───────────────────────────────────────────────

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Any = None,
        idempotency_key: Optional[str] = None,
        on_behalf_of: Optional[str] = None,
    ) -> Any:
        body_json = json.dumps(body, separators=(",", ":")) if body is not None else None
        signed = self._sign(
            method=method, path=path, body=body_json, idempotency_key=idempotency_key,
        )

        headers: Dict[str, str] = {
            "Accept": "application/json",
            "Authorization": (
                f"Fulkruma-HMAC-SHA256 keyId={self.key_id}, scope=*, "
                f"signature={signed['signature']}"
            ),
            "X-Fulkruma-Timestamp": signed["timestamp"],
        }
        if body_json is not None:
            headers["Content-Type"] = "application/json"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        effective_obo = on_behalf_of if on_behalf_of is not None else self._default_obo
        if effective_obo:
            headers["X-Fulkruma-On-Behalf-Of"] = effective_obo

        try:
            res = self._http.request(
                method.upper(),
                f"{self.base_url}{path}",
                headers=headers,
                content=body_json,
            )
        except httpx.TimeoutException as exc:
            raise FulkrumaError(
                0, "timeout", f"Fulkruma request timed out after {self.timeout_ms}ms",
            ) from exc
        except httpx.HTTPError as exc:
            raise FulkrumaError(0, "network_error", str(exc)) from exc

        text = res.text
        try:
            env = json.loads(text) if text else {}
        except ValueError:
            raise FulkrumaError(
                res.status_code, "invalid_response", f"Non-JSON response: {text[:200]}",
            ) from None

        request_id = None
        if isinstance(env, dict):
            meta = env.get("meta")
            if isinstance(meta, dict):
                request_id = meta.get("requestId")
            err = env.get("error")
        else:
            err = None

        if res.status_code >= 400 or err:
            if not err:
                err = {"code": "unknown", "message": f"HTTP {res.status_code}"}
            raise FulkrumaError(
                res.status_code,
                err.get("code", "unknown"),
                err.get("message", f"HTTP {res.status_code}"),
                request_id,
            )

        return env.get("data") if isinstance(env, dict) else env
