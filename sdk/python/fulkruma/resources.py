"""Resource namespaces for FulkrumaClient — Python parity with fulkruma-node.

Each builder takes the parent FulkrumaClient and exposes methods that map
1:1 to backend REST routes. Every method accepts a keyword-only
``on_behalf_of`` for per-call merchant override (no-op unless the key
holds the ``fulkruma:platform:admin`` scope).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Dict, List, Optional

if TYPE_CHECKING:
    from .client import FulkrumaClient


class _Namespace:
    def __init__(self, client: "FulkrumaClient") -> None:
        self._c = client


class ProductsResources(_Namespace):
    def create(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/products", body=body,
            idempotency_key=self._c._gen_idem(), on_behalf_of=on_behalf_of,
        )

    def get(self, product_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", f"/api/v1/products/{product_id}", on_behalf_of=on_behalf_of)

    def list(self, *, archived: Optional[bool] = None, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "GET", "/api/v1/products" + self._c._qs({"archived": archived}),
            on_behalf_of=on_behalf_of,
        )

    def update(self, product_id: str, patch: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "PATCH", f"/api/v1/products/{product_id}", body=patch, on_behalf_of=on_behalf_of,
        )

    def archive(self, product_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "DELETE", f"/api/v1/products/{product_id}", on_behalf_of=on_behalf_of,
        )

    def add_variant(self, product_id: str, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", f"/api/v1/products/{product_id}/variants",
            body=body, on_behalf_of=on_behalf_of,
        )

    def update_variant(
        self, product_id: str, variant_id: str, patch: Dict[str, Any],
        *, on_behalf_of: Optional[str] = None,
    ):
        return self._c.request(
            "PATCH", f"/api/v1/products/{product_id}/variants/{variant_id}",
            body=patch, on_behalf_of=on_behalf_of,
        )

    def archive_variant(self, product_id: str, variant_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "DELETE", f"/api/v1/products/{product_id}/variants/{variant_id}",
            on_behalf_of=on_behalf_of,
        )


class WarehousesResources(_Namespace):
    def create(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request("POST", "/api/v1/warehouses", body=body, on_behalf_of=on_behalf_of)

    def list(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/warehouses", on_behalf_of=on_behalf_of)

    def update(self, warehouse_id: str, patch: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "PATCH", f"/api/v1/warehouses/{warehouse_id}", body=patch, on_behalf_of=on_behalf_of,
        )

    def archive(self, warehouse_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "DELETE", f"/api/v1/warehouses/{warehouse_id}", on_behalf_of=on_behalf_of,
        )


class StockResources(_Namespace):
    def levels(self, *, variant_id: Optional[str] = None, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "GET", "/api/v1/stock/levels" + self._c._qs({"variant_id": variant_id}),
            on_behalf_of=on_behalf_of,
        )

    def movements(self, *, variant_id: Optional[str] = None, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "GET", "/api/v1/stock/movements" + self._c._qs({"variant_id": variant_id}),
            on_behalf_of=on_behalf_of,
        )

    def reservations(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/stock/reservations", on_behalf_of=on_behalf_of)

    def adjust(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/stock/adjust", body=body,
            idempotency_key=self._c._gen_idem(), on_behalf_of=on_behalf_of,
        )


class AddressesResources(_Namespace):
    def list(self, *, customer_id: Optional[str] = None, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "GET", "/api/v1/addresses" + self._c._qs({"customer_id": customer_id}),
            on_behalf_of=on_behalf_of,
        )

    def create(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request("POST", "/api/v1/addresses", body=body, on_behalf_of=on_behalf_of)

    def delete(self, address_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "DELETE", f"/api/v1/addresses/{address_id}", on_behalf_of=on_behalf_of,
        )


class ShipmentsResources(_Namespace):
    def list(self, *, status: Optional[str] = None, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "GET", "/api/v1/shipments" + self._c._qs({"status": status}),
            on_behalf_of=on_behalf_of,
        )

    def get(self, shipment_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", f"/api/v1/shipments/{shipment_id}", on_behalf_of=on_behalf_of)

    def create(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/shipments", body=body,
            idempotency_key=self._c._gen_idem(), on_behalf_of=on_behalf_of,
        )


class ShippingResources(_Namespace):
    def couriers(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/shipping/couriers", on_behalf_of=on_behalf_of)

    def origin(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/shipping/origin", on_behalf_of=on_behalf_of)

    def set_origin(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "PATCH", "/api/v1/shipping/origin", body=body, on_behalf_of=on_behalf_of,
        )

    def rates(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/shipping/rates", body=body, on_behalf_of=on_behalf_of,
        )


class LicensesResources(_Namespace):
    def list(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/licenses", on_behalf_of=on_behalf_of)

    def issue(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/licenses", body=body,
            idempotency_key=self._c._gen_idem(), on_behalf_of=on_behalf_of,
        )

    def revoke(self, license_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", f"/api/v1/licenses/{license_id}/revoke",
            body={}, on_behalf_of=on_behalf_of,
        )

    def activate(self, body: Dict[str, Any]):
        """Public unauthenticated endpoint — buyers' apps call this."""
        return self._c.request("POST", "/api/v1/licenses/activate", body=body)

    def deactivate(self, body: Dict[str, Any]):
        """Public unauthenticated — release a previously-activated instance."""
        return self._c.request("POST", "/api/v1/licenses/deactivate", body=body)

    def validate(self, *, key: str, product_id: Optional[str] = None):
        """Public unauthenticated — software pings this on launch."""
        return self._c.request(
            "GET", "/api/v1/licenses/validate" + self._c._qs({"key": key, "productId": product_id}),
        )


class DeliveriesResources(_Namespace):
    def list(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/deliveries", on_behalf_of=on_behalf_of)

    def get(self, delivery_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "GET", f"/api/v1/deliveries/{delivery_id}", on_behalf_of=on_behalf_of,
        )

    def create(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/deliveries", body=body,
            idempotency_key=self._c._gen_idem(), on_behalf_of=on_behalf_of,
        )


class ApiKeysResources(_Namespace):
    def list(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/api-keys", on_behalf_of=on_behalf_of)

    def create(self, body: Optional[Dict[str, Any]] = None, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/api-keys", body=body or {},
            idempotency_key=self._c._gen_idem(), on_behalf_of=on_behalf_of,
        )

    def revoke(self, key_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", f"/api/v1/api-keys/{key_id}/revoke",
            body={}, on_behalf_of=on_behalf_of,
        )


class AuditLogResources(_Namespace):
    def list(
        self,
        *,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
        since: Optional[str] = None,
        event_type: Optional[str] = None,
        on_behalf_of: Optional[str] = None,
    ):
        return self._c.request(
            "GET",
            "/api/v1/audit-log" + self._c._qs({
                "limit": limit,
                "cursor": cursor,
                "since": since,
                "eventType": event_type,
            }),
            on_behalf_of=on_behalf_of,
        )


class BillingResources(_Namespace):
    def plans(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/billing/plans", on_behalf_of=on_behalf_of)

    def current_plan(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/billing/plan", on_behalf_of=on_behalf_of)

    def subscription(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/billing/subscription", on_behalf_of=on_behalf_of)

    def usage(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/billing/usage", on_behalf_of=on_behalf_of)

    def invoices(
        self, *, limit: Optional[int] = None, cursor: Optional[str] = None,
        on_behalf_of: Optional[str] = None,
    ):
        return self._c.request(
            "GET",
            "/api/v1/billing/invoices" + self._c._qs({"limit": limit, "cursor": cursor}),
            on_behalf_of=on_behalf_of,
        )

    def checkout(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/billing/checkout", body=body, on_behalf_of=on_behalf_of,
        )

    def cancel(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/billing/cancel", body={}, on_behalf_of=on_behalf_of,
        )


class IntegrationsResources(_Namespace):
    def status(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/integrations/status", on_behalf_of=on_behalf_of)


class StatsResources(_Namespace):
    def overview(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request("GET", "/api/v1/stats/overview", on_behalf_of=on_behalf_of)


class WebhooksResources(_Namespace):
    def list_endpoints(self, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "GET", "/api/v1/webhooks/endpoints", on_behalf_of=on_behalf_of,
        )

    def create_endpoint(self, body: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "POST", "/api/v1/webhooks/endpoints", body=body,
            idempotency_key=self._c._gen_idem(), on_behalf_of=on_behalf_of,
        )

    def update_endpoint(self, endpoint_id: str, patch: Dict[str, Any], *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "PATCH", f"/api/v1/webhooks/endpoints/{endpoint_id}",
            body=patch, on_behalf_of=on_behalf_of,
        )

    def delete_endpoint(self, endpoint_id: str, *, on_behalf_of: Optional[str] = None):
        return self._c.request(
            "DELETE", f"/api/v1/webhooks/endpoints/{endpoint_id}",
            on_behalf_of=on_behalf_of,
        )

    def list_events(
        self,
        *,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
        type: Optional[str] = None,
        on_behalf_of: Optional[str] = None,
    ):
        return self._c.request(
            "GET",
            "/api/v1/webhooks/events"
            + self._c._qs({"limit": limit, "cursor": cursor, "type": type}),
            on_behalf_of=on_behalf_of,
        )


class AdminResources(_Namespace):
    def provision_workspace(self, body: Dict[str, Any]):
        """Idempotent — refuses to re-route a workspace already provisioned
        by a different partner. Mirrors the Node SDK key `ws_<acc>_<partner>`."""
        account_id = body.get("accountId", "unknown")
        partner = body.get("partner", "unknown")
        return self._c.request(
            "POST", "/api/v1/admin/workspaces", body=body,
            idempotency_key=f"ws_{account_id}_{partner}",
        )

    def get_workspace(self, account_id: str):
        return self._c.request("GET", f"/api/v1/admin/workspaces/{account_id}")

    def partner_usage(self, *, partner: str, from_: str, to: str):
        return self._c.request(
            "GET",
            "/api/v1/admin/partner/usage"
            + self._c._qs({"partner": partner, "from": from_, "to": to}),
        )
