---
title: Deliveries
---

# Deliveries

A delivery is the digital-fulfilment counterpart to a shipment. Where a shipment hands a parcel to a courier, a delivery hands a download link (or a license) to a buyer of a `type: "digital"` product. Each delivery has a max download count, an expiry, and an event trail. The Python SDK wraps three endpoints behind `fulkruma.deliveries`. For HTTP shapes, see [**API &rarr; Deliveries**](/docs/api/resources/deliveries).

## Namespace

```python
fulkruma.deliveries     # DeliveriesResources
```

Three methods. There's no `update` (delivery terms are immutable after issuance) and no `revoke` &mdash; the closest thing to "revoke" is letting the delivery expire, or revoking the underlying license via `licenses.revoke` if the product is license-gated.

## Methods

### `create`

```python
fulkruma.deliveries.create(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Issues a delivery. Pass the product, the customer, the checkout session it came from, and optionally a download cap and expiry. The SDK auto-mints an idempotency key.

```python
from datetime import datetime, timedelta, timezone

result = fulkruma.deliveries.create({
    "productId": "prod_01HX...",
    "customerId": "cus_01HX...",
    "checkoutSessionId": "cs_01HX...",
    "maxDownloads": 5,
    "expiresAt": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
    "externalSource": "storlaunch",
    "externalRef": "order-118-dl-1",
})

print(result["delivery"]["id"], result["delivery"].get("downloadUrl"))
```

`maxDownloads` defaults to whatever the product configures (or unlimited if neither sets one). `expiresAt` defaults to 30 days.

<blockquote class="callout-note">

**The `downloadUrl` is signed and short-lived.** It carries an embedded HMAC and expires after a few minutes. Email it to the buyer directly; don't cache it in your own system. Re-fetching via `deliveries.get` returns a freshly-signed URL each time.

</blockquote>

### `get`

```python
fulkruma.deliveries.get(delivery_id: str, *, on_behalf_of: str | None = None) -> dict
```

Fetches one delivery by `del_*` ID. Returns a fresh signed `downloadUrl` and the latest download-count metrics.

```python
result = fulkruma.deliveries.get("del_01HX...")
d = result["delivery"]
print(f"{d['downloadCount']}/{d.get('maxDownloads') or '∞'} downloads used")
```

### `list`

```python
fulkruma.deliveries.list(*, on_behalf_of: str | None = None) -> dict
```

Returns every delivery in the workspace, freshest first. Not paginated.

```python
result = fulkruma.deliveries.list()
from datetime import datetime, timezone
now = datetime.now(timezone.utc)
expired = [
    d for d in result["deliveries"]
    if d.get("expiresAt") and datetime.fromisoformat(d["expiresAt"]) < now
]
```

## Types

Each method returns a plain dict. Key shape:

```python
{
    "delivery": {
        "id": "del_...",
        "accountId": "acc_...",
        "productId": "prod_...",
        "customerId": "cus_...",
        "checkoutSessionId": "cs_...",
        "status": "pending" | "ready" | "delivered" | "expired",
        "downloadUrl": "https://..." | None,
        "downloadCount": int,
        "maxDownloads": int | None,
        "expiresAt": "..." | None,
        "externalSource": "..." | None,
        "externalRef": "..." | None,
        "createdAt": "...",
        "updatedAt": "..."
    }
}
```

## Common patterns

**Issue on `plugipay.checkout.completed` webhook.** The canonical flow:

```python
def on_checkout_completed(fulkruma, session: dict):
    pres = fulkruma.products.get(session["productId"])
    product = pres["product"]
    if product["type"] != "digital":
        return

    result = fulkruma.deliveries.create({
        "productId": product["id"],
        "customerId": session["customerId"],
        "checkoutSessionId": session["id"],
    })

    send_download_email(session["customerId"], result["delivery"]["downloadUrl"])
```

If the product is `licenseEnabled`, issue a license too (see [`licenses.issue`](/docs/sdk/python/resources/licenses)) and email both.

**Re-send a download link.** Buyer lost the email; want to resend:

```python
from datetime import datetime, timezone

def resend(fulkruma, delivery_id: str):
    result = fulkruma.deliveries.get(delivery_id)
    d = result["delivery"]
    expires = d.get("expiresAt")
    if expires and datetime.fromisoformat(expires) > datetime.now(timezone.utc):
        send_download_email(d["customerId"], d["downloadUrl"])
    else:
        # Expired — issue a new delivery off the same checkout session
        fresh = fulkruma.deliveries.create({
            "productId": d["productId"],
            "customerId": d["customerId"],
            "checkoutSessionId": d["checkoutSessionId"],
        })
        send_download_email(d["customerId"], fresh["delivery"]["downloadUrl"])
```

**Audit expired deliveries.** For periodic cleanup or reporting:

```python
def expired_report(fulkruma):
    result = fulkruma.deliveries.list()
    return [d for d in result["deliveries"] if d["status"] == "expired"]
```

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Missing required IDs, bad `expiresAt` format. |
| `404` | `not_found` | Product, customer, or checkout-session ID missing. |
| `409` | `product_not_digital` | Product is not `type: "digital"`. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:delivery:write`. |

## Next

- [**Licenses**](/docs/sdk/python/resources/licenses) &mdash; the activation-counted credential layer for digital products.
- [**Products**](/docs/sdk/python/resources/products) &mdash; how to flag a product as digital.
- [**API &rarr; Deliveries**](/docs/api/resources/deliveries) &mdash; HTTP-level reference.
