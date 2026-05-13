---
title: Licenses
---

# Licenses

A license is an activation-counted credential for a `licenseEnabled` product. Issue one per purchase; the buyer's software calls `activate` to bind a device and `validate` on each launch. Licenses pair with deliveries: the delivery hands over the bits, the license gates how many devices can run them. The Python SDK wraps six endpoints behind `fulkruma.licenses`. For HTTP shapes, see [**API &rarr; Licenses**](/docs/api/resources/licenses).

## Namespace

```python
fulkruma.licenses     # LicensesResources
```

The first three methods (`issue`, `list`, `revoke`) need the workspace HMAC key. The last three (`activate`, `deactivate`, `validate`) are **public** &mdash; called by the licensed software on the buyer's machine, which doesn't have your secret. The SDK still attaches the HMAC header when configured to (it doesn't hurt), but the backend treats these routes as unauthenticated.

## Methods

### `issue`

```python
fulkruma.licenses.issue(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Issues a license for a product + customer pair. Pass `maxActivations` to cap how many devices can use the key. Pass `expiresAt` for a time-limited license. The SDK auto-mints an idempotency key.

```python
from datetime import datetime, timedelta, timezone

result = fulkruma.licenses.issue({
    "productId": "prod_01HX...",
    "customerId": "cus_01HX...",
    "maxActivations": 3,
    "expiresAt": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
    "externalSource": "storlaunch",
    "externalRef": "order-118-license",
})

print(result["license"]["key"])  # "FULK-XXXX-XXXX-XXXX-XXXX"
```

The `key` is generated server-side using a high-entropy alphabet and is the only thing the buyer's software ever sees.

### `list`

```python
fulkruma.licenses.list(*, on_behalf_of: str | None = None) -> dict
```

Returns every license in the workspace. Not paginated.

```python
result = fulkruma.licenses.list()
active = [l for l in result["licenses"] if l["status"] == "active"]
```

### `revoke`

```python
fulkruma.licenses.revoke(license_id: str, *, on_behalf_of: str | None = None) -> dict
```

Marks a license as revoked. Subsequent `validate` calls return `valid: False, status: "revoked"`. There's no "un-revoke" &mdash; issue a fresh license to restore access.

```python
fulkruma.licenses.revoke("lic_01HX...")
```

Revoke is the right tool for chargebacks, fraud, and refunds.

### `activate` (public)

```python
fulkruma.licenses.activate(body: dict) -> dict
```

Called by the buyer's software on first launch to bind a device. Pass the license `key` and a stable `instanceId`. Returns `alreadyActive: True` if the (key, instanceId) pair is already registered &mdash; treat that as success, not error.

```python
result = fulkruma.licenses.activate({
    "key": "FULK-XXXX-XXXX-XXXX-XXXX",
    "instanceId": "550e8400-e29b-41d4-a716-446655440000",
})
if result.get("activation"):
    pass  # success — cache locally
```

If the license already has `maxActivations` instances registered, the call returns `409 max_activations_exceeded`.

### `deactivate` (public)

```python
fulkruma.licenses.deactivate(body: dict) -> dict
```

Releases an instance &mdash; the user is uninstalling, or moving to a new device.

```python
fulkruma.licenses.deactivate({
    "key": "FULK-XXXX-XXXX-XXXX-XXXX",
    "instanceId": "550e8400-e29b-41d4-a716-446655440000",
})
```

### `validate` (public)

```python
fulkruma.licenses.validate(
    *,
    key: str,
    product_id: str | None = None,
) -> dict
```

Called by licensed software on every launch (or periodically). Returns the current license state without binding a new activation.

```python
status = fulkruma.licenses.validate(key="FULK-XXXX-XXXX-XXXX-XXXX")
if not status["valid"]:
    raise SystemExit("License invalid")
```

Reasons a license can be invalid: `revoked`, `expired`, `not_found`, `product_mismatch`.

## Types

Returned dicts use plain JSON shapes. Key entries:

```python
# license
{
    "id": "lic_...",
    "accountId": "acc_...",
    "productId": "prod_...",
    "customerId": "cus_...",
    "key": "FULK-...",
    "status": "active" | "revoked" | "expired",
    "activations": int,
    "maxActivations": int | None,
    "expiresAt": "..." | None,
    "createdAt": "...",
    "updatedAt": "..."
}

# validate response
{
    "valid": bool,
    "key": "FULK-...",
    "status": "active" | "revoked" | "expired" | None,
    "productId": "prod_..." | None,
    "activations": int | None,
    "maxActivations": int | None,
    "expiresAt": "..." | None
}
```

## Common patterns

**Issue on purchase.** Tied to a `plugipay.checkout.completed` webhook:

```python
def on_checkout_completed(fulkruma, session: dict):
    pres = fulkruma.products.get(session["productId"])
    product = pres["product"]
    if not product.get("licenseEnabled"):
        return
    result = fulkruma.licenses.issue({
        "productId": product["id"],
        "customerId": session["customerId"],
        "externalRef": session["id"],
        "externalSource": "plugipay",
    })
    email_license(session["customerId"], result["license"]["key"])
```

**Software-side validate-on-launch.** Pseudo-Python for the buyer's app:

```python
from fulkruma import FulkrumaClient

# No secret needed for validate/activate/deactivate. The constructor
# requires SOME credentials, so use the merchant's distributed public
# keyId and any string as secret.
fulkruma = FulkrumaClient(key_id="AKIAFULK_DIST", secret="unused-for-public-routes")

def startup(saved_key: str):
    status = fulkruma.licenses.validate(key=saved_key)
    if not status["valid"]:
        show_license_invalid_screen()
        return
    # re-validate every hour via your own scheduler
```

**Deactivate-on-uninstall.**

```python
fulkruma.licenses.deactivate({"key": saved_key, "instanceId": saved_instance_id})
```

This frees a slot so the user can re-activate on a new machine without hitting `max_activations_exceeded`.

**Bulk revoke for refund batch.**

```python
def revoke_for_refunds(fulkruma, license_ids: list[str]):
    for lid in license_ids:
        fulkruma.licenses.revoke(lid)
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Missing required IDs, bad `expiresAt`. |
| `404` | `not_found` | License ID or `key` missing or wrong workspace. |
| `409` | `max_activations_exceeded` | Activate against an already-full license. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:license:write` (on issue/revoke). |
| `400` | `product_not_licensed` | Issuing on a product where `licenseEnabled = False`. |

## Next

- [**Deliveries**](/docs/sdk/python/resources/deliveries) &mdash; the download-link half of digital fulfillment.
- [**Products**](/docs/sdk/python/resources/products) &mdash; how to enable license-mode on a product.
- [**API &rarr; Licenses**](/docs/api/resources/licenses) &mdash; HTTP-level reference.
