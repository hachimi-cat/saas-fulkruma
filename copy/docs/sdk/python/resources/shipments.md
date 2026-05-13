---
title: Shipments
---

# Shipments

A shipment is the record of a parcel handed off to a courier. It carries the courier code + service code, the price the merchant was quoted, an origin + destination, and the items packed into it. Fulkruma wires this to Biteship (its first courier aggregator) and emits `fulkruma.shipment.*` webhooks as the carrier sends status updates. For HTTP shapes, see [**API &rarr; Shipments**](/docs/api/resources/shipments).

## Namespace

```python
fulkruma.shipments     # ShipmentsResources
```

Three methods. There's no `update` and no `cancel` &mdash; once a label is booked with a courier, mutation goes through the courier's portal (or a support ticket). The closest thing to "cancel" is the carrier's own cancellation event, surfaced as a `shipment.updated` webhook.

## Methods

### `create`

```python
fulkruma.shipments.create(body: dict, *, on_behalf_of: str | None = None) -> dict
```

Books a shipment with the chosen courier. The SDK auto-mints an idempotency key &mdash; replay-safe, which matters because creating one twice means paying the courier twice.

```python
result = fulkruma.shipments.create({
    "customerId": "cus_01HX...",
    "courierCode": "jne",
    "courierServiceCode": "reg",
    "courierType": "standard",
    "price": 18000,
    "origin": {"warehouseId": "wh_01HX..."},
    "destination": {
        "contactName": "Alice Tan",
        "contactPhone": "+62812xxxxxxxx",
        "address": "Jl. Diponegoro No. 5",
        "postalCode": "10310",
        "areaId": "IDN-JKT-MTH",
    },
    "items": [
        {"variantId": "var_01HX...", "quantity": 2, "weight": 0.3},
    ],
})

print(result["shipment"]["id"], result["shipment"].get("trackingNumber"))
```

`origin` and `destination` are intentionally loosely typed &mdash; the backend validates the shape per courier (Biteship expects a different envelope than a future direct integration). For warehouse-origin shipments, pass `{"warehouseId": "..."}` and let the server resolve the address.

<blockquote class="callout-note">

**The `price` you pass is what you charge the customer.** It must match (or exceed) the quote from `shipping.rates` for the same `courierCode`/`courierServiceCode`/`destination`. Fulkruma validates this server-side; if you pass below-quote, you'll get `400 validation_error`.

</blockquote>

### `get`

```python
fulkruma.shipments.get(shipment_id: str, *, on_behalf_of: str | None = None) -> dict
```

Fetches one shipment by `ship_*` ID. Includes the latest tracking events embedded in the response.

```python
result = fulkruma.shipments.get("ship_01HX...")
shipment = result["shipment"]
print(shipment["status"])             # "in_transit"
print(len(shipment["events"]))        # count of tracking events
```

### `list`

```python
fulkruma.shipments.list(
    *,
    status: str | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Lists shipments in the workspace. Pass `status` to filter (`"pending"`, `"confirmed"`, `"picked_up"`, `"in_transit"`, `"delivered"`, `"returned"`, `"cancelled"`).

```python
result = fulkruma.shipments.list(status="in_transit")
print(f"{len(result['shipments'])} parcels currently moving")
```

Status filter is exact-match. There's no date filter at the SDK layer &mdash; use the `webhooks.list_events` ledger if you need a time-bounded scan.

## Types

Each method returns a plain dict. Key shape:

```python
{
    "shipment": {
        "id": "ship_...",
        "accountId": "acc_...",
        "customerId": "cus_..." | None,
        "courierCode": "jne",
        "courierServiceCode": "reg",
        "courierType": "standard",
        "status": "pending" | "confirmed" | "picked_up" | "in_transit" |
                  "delivered" | "returned" | "cancelled",
        "trackingNumber": "..." | None,
        "price": int,
        "insurance": int | None,
        "insured": bool,
        "origin": {...},
        "destination": {...},
        "items": [{...}, ...],
        "events": [{...}, ...],
        "externalSource": "..." | None,
        "externalRef": "..." | None,
        "createdAt": "...",
        "updatedAt": "..."
    }
}
```

See [**API &rarr; Shipments**](/docs/api/resources/shipments) for the full courier-code vocabulary and per-courier `origin`/`destination` schemas.

## Common patterns

**Quote-then-book.** The robust pattern: quote first via [`shipping.rates`](/docs/sdk/python/resources/shipping), let the customer pick, then book:

```python
quote = fulkruma.shipping.rates({
    "destination": {"areaId": "IDN-JKT-MTH", "postalCode": "10310"},
    "items": [{"variantId": "var_01HX...", "quantity": 1, "weight": 0.5}],
})

picked = quote["rates"][0]   # user picked one in your UI

shipment = fulkruma.shipments.create({
    "customerId": "cus_01HX...",
    "courierCode": picked["courierCode"],
    "courierServiceCode": picked["courierServiceCode"],
    "courierType": picked["courierType"],
    "price": picked["price"],
    "origin": {"warehouseId": "wh_01HX..."},
    "destination": {
        "areaId": "IDN-JKT-MTH", "postalCode": "10310",
        "contactName": "Alice", "contactPhone": "+62812xxxxxxxx",
        "address": "Jl. Diponegoro 5",
    },
    "items": [{"variantId": "var_01HX...", "quantity": 1, "weight": 0.5}],
})
```

**Track via webhook.** Don't poll `shipments.get` in a loop &mdash; subscribe to `fulkruma.shipment.updated`:

```python
fulkruma.webhooks.create_endpoint({
    "url": "https://your-app.example.com/webhooks/fulkruma",
    "events": ["fulkruma.shipment.updated", "fulkruma.shipment.delivered"],
})
```

Then verify + handle in your endpoint. See [**Verifying webhooks**](/docs/sdk/python/verifying-webhooks).

**Idempotent re-booking after partial failure.** If the courier API timed out and you don't know whether the shipment was created, retry with the same `externalRef`:

```python
fulkruma.shipments.create({
    # ...
    "externalRef": "order-2026-118",
    "externalSource": "storlaunch",
})
```

The auto-generated idempotency key covers in-process retries; for cross-process replay use a stable `externalRef` and check `shipments.list()` first.

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Missing courier fields, price below quote, bad destination shape. |
| `404` | `not_found` | Customer, warehouse, or variant ID missing. |
| `409` | `insufficient_stock` | Stock at the origin warehouse is exhausted. |
| `502` | `courier_error` | Upstream Biteship rejected the booking. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:shipment:write`. |

`courier_error` is the retry candidate &mdash; transient upstream blips are the most common failure mode.

## Next

- [**Shipping**](/docs/sdk/python/resources/shipping) &mdash; rate quotes + courier listing + origin config.
- [**Stock**](/docs/sdk/python/resources/stock) &mdash; the inventory shipments draw from.
- [**Webhooks**](/docs/sdk/python/resources/webhooks) &mdash; how to receive status events.
- [**API &rarr; Shipments**](/docs/api/resources/shipments) &mdash; HTTP-level reference.
