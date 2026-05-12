"""End-to-end tests for the Fulkruma Python SDK.

Strategy mirrors the Node SDK's vitest suite — install a `httpx.MockTransport`,
capture every request, assert on path/method/headers/body. `respx` is
included as a dev dep for future expansion.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any, Dict, List, Tuple

import httpx
import pytest

from fulkruma import FulkrumaClient, FulkrumaError, verify_webhook


# ─── Test fixtures ───────────────────────────────────────────────────────


def _envelope(data: Any, *, status: int = 200, error: Dict[str, str] | None = None) -> httpx.Response:
    body = {"data": data, "error": error, "meta": {"requestId": "req_test", "timestamp": "now"}}
    return httpx.Response(status, content=json.dumps(body).encode())


def _make_client(
    handler=None,
    *,
    on_behalf_of: str | None = None,
) -> Tuple[FulkrumaClient, List[httpx.Request]]:
    captured: List[httpx.Request] = []

    def default_handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return _envelope({"ok": True})

    transport = httpx.MockTransport(handler or default_handler)
    http = httpx.Client(transport=transport, timeout=5.0)
    client = FulkrumaClient(
        key_id="ak_test",
        secret="sk_test",
        base_url="https://fulkruma.test",
        on_behalf_of=on_behalf_of,
        http=http,
    )
    return client, captured


# ─── Construction ────────────────────────────────────────────────────────


def test_construction_requires_key_id_and_secret():
    with pytest.raises(ValueError, match="key_id and secret are required"):
        FulkrumaClient(key_id="", secret="sk")
    with pytest.raises(ValueError):
        FulkrumaClient(key_id="ak", secret="")


def test_base_url_strips_trailing_slash():
    c = FulkrumaClient(key_id="ak", secret="sk", base_url="https://fulkruma.test///")
    assert c.base_url == "https://fulkruma.test"


def test_for_merchant_clones_with_obo():
    c = FulkrumaClient(key_id="ak", secret="sk", base_url="https://fulkruma.test")
    cloned = c.for_merchant("acc_merchant")
    assert cloned._default_obo == "acc_merchant"
    assert cloned.key_id == c.key_id
    assert cloned.base_url == c.base_url


# ─── HMAC signing ────────────────────────────────────────────────────────


def test_hmac_headers_attached():
    client, captured = _make_client()
    client.billing.plans()
    req = captured[0]
    auth = req.headers["authorization"]
    assert auth.startswith("Fulkruma-HMAC-SHA256")
    assert "keyId=ak_test" in auth
    assert "scope=*" in auth
    assert "signature=" in auth
    assert req.headers["x-fulkruma-timestamp"].isdigit()


def test_hmac_signature_is_correct():
    """Recompute the expected HMAC and assert the wire format matches."""
    client, captured = _make_client()
    client.warehouses.list()
    req = captured[0]
    ts = req.headers["x-fulkruma-timestamp"]
    auth = req.headers["authorization"]
    # extract signature
    sig = [p.strip() for p in auth.split(",") if p.strip().startswith("signature=")][0]
    sig = sig.split("=", 1)[1]
    body_hash = hashlib.sha256(b"").hexdigest()
    expected_string = f"GET\n/api/v1/warehouses\n{ts}\n{body_hash}"
    expected = hmac.new(b"sk_test", expected_string.encode(), hashlib.sha256).hexdigest()
    assert sig == expected


def test_hmac_signature_includes_body_and_idem():
    client, captured = _make_client()
    client.stock.adjust({"variantId": "v_1", "warehouseId": "w_1", "delta": 5, "reason": "initial_stock"})
    req = captured[0]
    body = req.read()
    idem = req.headers["idempotency-key"]
    ts = req.headers["x-fulkruma-timestamp"]
    body_hash = hashlib.sha256(body).hexdigest()
    expected_string = f"POST\n/api/v1/stock/adjust\n{ts}\n{body_hash}\n{idem}"
    expected = hmac.new(b"sk_test", expected_string.encode(), hashlib.sha256).hexdigest()
    auth = req.headers["authorization"]
    sig = [p for p in auth.split(", ") if p.startswith("signature=")][0].split("=", 1)[1]
    assert sig == expected


def test_on_behalf_of_header_from_default():
    client, captured = _make_client(on_behalf_of="acc_default")
    client.shipments.list()
    assert captured[0].headers["x-fulkruma-on-behalf-of"] == "acc_default"


def test_on_behalf_of_per_call_override():
    client, captured = _make_client(on_behalf_of="acc_default")
    client.shipments.list(on_behalf_of="acc_override")
    assert captured[0].headers["x-fulkruma-on-behalf-of"] == "acc_override"


# ─── Resource route round-trips ──────────────────────────────────────────


def test_products_list_with_archived_query():
    client, captured = _make_client()
    client.products.list(archived=True)
    req = captured[0]
    assert req.method == "GET"
    assert req.url.path == "/api/v1/products"
    assert req.url.params.get("archived") == "true"


def test_products_create_posts_with_idempotency():
    client, captured = _make_client()
    client.products.create({"name": "Widget"})
    req = captured[0]
    assert req.method == "POST"
    assert req.url.path == "/api/v1/products"
    assert req.headers["idempotency-key"].startswith("idem_")
    assert json.loads(req.read()) == {"name": "Widget"}


def test_products_update_patch_path():
    client, captured = _make_client()
    client.products.update("pr_1", {"name": "Renamed"})
    assert captured[0].method == "PATCH"
    assert captured[0].url.path == "/api/v1/products/pr_1"


def test_warehouses_archive_deletes():
    client, captured = _make_client()
    client.warehouses.archive("wh_1")
    assert captured[0].method == "DELETE"
    assert captured[0].url.path == "/api/v1/warehouses/wh_1"


def test_stock_levels_filters_variant():
    client, captured = _make_client()
    client.stock.levels(variant_id="var_1")
    assert captured[0].url.params.get("variant_id") == "var_1"


def test_addresses_list_filters_customer():
    client, captured = _make_client()
    client.addresses.list(customer_id="cus_1")
    assert captured[0].url.params.get("customer_id") == "cus_1"


def test_shipments_create_idempotent():
    client, captured = _make_client()
    client.shipments.create({
        "courierCode": "jne", "courierServiceCode": "reg", "courierType": "land",
        "price": 12000, "origin": {}, "destination": {}, "items": [],
    })
    req = captured[0]
    assert req.method == "POST"
    assert req.url.path == "/api/v1/shipments"
    assert "idempotency-key" in req.headers


def test_shipping_rates_post():
    client, captured = _make_client()
    client.shipping.rates({"destination": {}, "items": []})
    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/shipping/rates"


def test_licenses_validate_is_unauthenticated_get_with_query():
    client, captured = _make_client()
    client.licenses.validate(key="ABCD-1234", product_id="pr_1")
    req = captured[0]
    assert req.method == "GET"
    assert req.url.path == "/api/v1/licenses/validate"
    assert req.url.params.get("key") == "ABCD-1234"
    assert req.url.params.get("productId") == "pr_1"


def test_licenses_revoke_posts():
    client, captured = _make_client()
    client.licenses.revoke("lic_1")
    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/licenses/lic_1/revoke"


def test_deliveries_create_posts_with_idempotency():
    client, captured = _make_client()
    client.deliveries.create({
        "productId": "pr_1", "customerId": "cus_1", "checkoutSessionId": "ck_1",
    })
    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/deliveries"
    assert "idempotency-key" in captured[0].headers


def test_api_keys_create_posts():
    client, captured = _make_client()
    client.api_keys.create({"description": "CI key"})
    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/api-keys"


def test_audit_log_list_query_camelcased():
    client, captured = _make_client()
    client.audit_log.list(limit=50, event_type="shipment.created")
    req = captured[0]
    assert req.url.path == "/api/v1/audit-log"
    assert req.url.params.get("limit") == "50"
    assert req.url.params.get("eventType") == "shipment.created"


def test_billing_checkout_posts():
    client, captured = _make_client()
    client.billing.checkout({"planId": "pro"})
    assert captured[0].method == "POST"
    assert captured[0].url.path == "/api/v1/billing/checkout"


def test_integrations_status_gets():
    client, captured = _make_client()
    client.integrations.status()
    assert captured[0].url.path == "/api/v1/integrations/status"


def test_stats_overview_gets():
    client, captured = _make_client()
    client.stats.overview()
    assert captured[0].url.path == "/api/v1/stats/overview"


def test_webhooks_create_endpoint_has_idempotency():
    client, captured = _make_client()
    client.webhooks.create_endpoint({"url": "https://x.com/hook", "events": ["shipment.created"]})
    assert captured[0].method == "POST"
    assert "idempotency-key" in captured[0].headers


def test_webhooks_update_endpoint_patches():
    client, captured = _make_client()
    client.webhooks.update_endpoint("we_1", {"active": False})
    assert captured[0].method == "PATCH"
    assert captured[0].url.path == "/api/v1/webhooks/endpoints/we_1"


def test_webhooks_delete_endpoint_deletes():
    client, captured = _make_client()
    client.webhooks.delete_endpoint("we_1")
    assert captured[0].method == "DELETE"


def test_admin_provision_workspace_keyed_idempotency():
    """The Node SDK uses `ws_<acc>_<partner>` — verify Python matches."""
    client, captured = _make_client()
    client.admin.provision_workspace({
        "accountId": "acc_1", "partner": "storlaunch", "discountRate": 0.003,
    })
    assert captured[0].headers["idempotency-key"] == "ws_acc_1_storlaunch"


def test_admin_partner_usage_query():
    client, captured = _make_client()
    client.admin.partner_usage(partner="storlaunch", from_="2026-05-01", to="2026-05-31")
    req = captured[0]
    assert req.url.params.get("partner") == "storlaunch"
    assert req.url.params.get("from") == "2026-05-01"
    assert req.url.params.get("to") == "2026-05-31"


# ─── Error handling ──────────────────────────────────────────────────────


def test_error_response_raises_fulkruma_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return _envelope(None, status=404, error={"code": "not_found", "message": "missing"})

    client, _ = _make_client(handler)
    with pytest.raises(FulkrumaError) as exc_info:
        client.products.get("pr_missing")
    assert exc_info.value.status == 404
    assert exc_info.value.code == "not_found"
    assert exc_info.value.request_id == "req_test"


def test_non_json_response_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, content=b"<html>nope</html>")

    client, _ = _make_client(handler)
    with pytest.raises(FulkrumaError) as exc_info:
        client.products.list()
    assert exc_info.value.code == "invalid_response"


def test_envelope_error_wins_over_status():
    """Backend can return 200 + error envelope; SDK still raises."""
    def handler(request: httpx.Request) -> httpx.Response:
        return _envelope(None, status=200, error={"code": "validation", "message": "bad"})

    client, _ = _make_client(handler)
    with pytest.raises(FulkrumaError) as exc_info:
        client.products.list()
    assert exc_info.value.code == "validation"


# ─── Webhook verification ────────────────────────────────────────────────


def _sign_webhook(secret: str, body: bytes, ts: int) -> str:
    payload = f"{ts}.".encode() + body
    digest = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


def test_verify_webhook_happy_path():
    body = json.dumps({"id": "evt_1", "type": "shipment.created", "data": {"x": 1}}).encode()
    ts = int(time.time())
    sig = _sign_webhook("whsec_test", body, ts)
    event = verify_webhook(raw_body=body, signature=sig, secret="whsec_test")
    assert event["id"] == "evt_1"
    assert event["type"] == "shipment.created"


def test_verify_webhook_missing_header_raises():
    with pytest.raises(FulkrumaError) as exc_info:
        verify_webhook(raw_body=b"{}", signature=None, secret="s")
    assert exc_info.value.code == "missing_signature"


def test_verify_webhook_bad_signature_raises():
    body = b'{"id":"evt_1"}'
    ts = int(time.time())
    sig = f"t={ts},v1={'0' * 64}"
    with pytest.raises(FulkrumaError) as exc_info:
        verify_webhook(raw_body=body, signature=sig, secret="whsec_test")
    assert exc_info.value.code == "bad_signature"


def test_verify_webhook_expired_timestamp_raises():
    body = b'{"id":"evt_1"}'
    ts = int(time.time()) - 3600  # 1h old
    sig = _sign_webhook("whsec_test", body, ts)
    with pytest.raises(FulkrumaError) as exc_info:
        verify_webhook(raw_body=body, signature=sig, secret="whsec_test")
    assert exc_info.value.code == "signature_expired"


def test_verify_webhook_malformed_header_raises():
    with pytest.raises(FulkrumaError) as exc_info:
        verify_webhook(raw_body=b"{}", signature="not-a-real-sig", secret="s")
    assert exc_info.value.code == "malformed_signature"


def test_verify_webhook_now_injection():
    body = b'{"id":"evt_1"}'
    ts = 1_000_000
    sig = _sign_webhook("whsec_test", body, ts)
    event = verify_webhook(
        raw_body=body, signature=sig, secret="whsec_test", now=ts + 10,
    )
    assert event["id"] == "evt_1"


# ─── Context manager + lifecycle ─────────────────────────────────────────


def test_client_is_context_manager():
    transport = httpx.MockTransport(lambda r: _envelope({"ok": True}))
    http = httpx.Client(transport=transport)
    with FulkrumaClient(key_id="ak", secret="sk", http=http) as c:
        c.stats.overview()
