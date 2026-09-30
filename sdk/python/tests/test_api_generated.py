"""client.api: every feature route, one method each, generated from the API spec
(scripts/apigen.sh). Calls are signed like every other request."""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import List
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from fulkruma import FulkrumaClient


def _client(seen: List[httpx.Request]) -> FulkrumaClient:
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        body = {"data": {"ok": True}, "error": None, "meta": {"requestId": "r"}}
        return httpx.Response(200, content=json.dumps(body).encode())

    http = httpx.Client(transport=httpx.MockTransport(handler))
    return FulkrumaClient(key_id="AKIAFULKTEST", secret="sk", base_url="https://fulkruma.test", http=http)


def _server_accepts(request: httpx.Request, secret: str) -> bool:
    """The server's recipe (backend middleware/hmac-auth.ts): the path as sent, and the
    body hashed as JSON.stringify(req.body) -- the empty string when there is no field."""
    parsed = json.loads(request.content) if request.content else {}
    body_json = json.dumps(parsed, separators=(",", ":"), ensure_ascii=False) if parsed else ""
    idem = request.headers.get("idempotency-key")
    to_sign = "\n".join(
        [
            request.method,
            request.url.raw_path.decode(),
            request.headers["x-fulkruma-timestamp"],
            hashlib.sha256(body_json.encode()).hexdigest(),
        ]
    ) + (f"\n{idem}" if idem else "")
    expected = hmac.new(secret.encode(), to_sign.encode(), hashlib.sha256).hexdigest()
    return request.headers["authorization"].endswith(f"signature={expected}")


def test_create_sends_the_fields_fulkruma_validates_signed() -> None:
    seen: List[httpx.Request] = []
    client = _client(seen)
    client.api.warehouses_create(name="Gudang Utama", city="Jakarta", is_default=True)
    request = seen[0]
    assert (request.method, request.url.path) == ("POST", "/api/v1/warehouses")
    assert json.loads(request.content) == {"name": "Gudang Utama", "city": "Jakarta", "isDefault": True}
    assert request.headers["authorization"].startswith("Fulkruma-HMAC-SHA256 keyId=AKIAFULKTEST, scope=*, signature=")
    assert request.headers.get("idempotency-key")
    assert _server_accepts(request, "sk")


def test_path_and_query() -> None:
    seen: List[httpx.Request] = []
    client = _client(seen)
    client.api.products_get("prd 1")
    client.api.shipments_list(status="delivered")
    assert seen[0].url.raw_path.decode() == "/api/v1/products/prd%201"
    assert seen[1].url.path == "/api/v1/shipments"
    assert parse_qs(urlsplit(str(seen[1].url)).query) == {"status": ["delivered"]}
    assert _server_accepts(seen[0], "sk")
    assert _server_accepts(seen[1], "sk")


def test_no_body_when_no_field_is_given() -> None:
    seen: List[httpx.Request] = []
    client = _client(seen)
    client.api.shipments_cancel("shp_1")
    assert seen[0].url.path == "/api/v1/shipments/shp_1/cancel"
    assert seen[0].content == b""
    assert _server_accepts(seen[0], "sk")
    client.api.shipments_cancel("shp_1", reason="Buyer changed address")
    assert json.loads(seen[1].content) == {"reason": "Buyer changed address"}
    assert _server_accepts(seen[1], "sk")


def test_a_required_field_is_asked_for() -> None:
    client = _client([])
    with pytest.raises(ValueError, match="needs name"):
        client.api.warehouses_create(city="Jakarta")


def test_every_feature_route_has_a_method() -> None:
    methods = [n for n in dir(_client([]).api) if not n.startswith("_")]
    assert len(methods) > 70
