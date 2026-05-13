---
title: Shipping
---

# Shipping

The `shipping` namespace is everything you need **before** booking a shipment: list available couriers, configure the workspace's default origin, and quote rates. It's intentionally separate from `shipments` &mdash; the latter mutates state, this one is mostly read-only metadata. The Python SDK wraps four endpoints behind `fulkruma.shipping`. For HTTP shapes, see [**API &rarr; Shipping**](/docs/api/resources/shipping).

## Namespace

```python
fulkruma.shipping     # ShippingResources
```

Four methods. Three reads, one config mutation (`set_origin`).

## Methods

### `couriers`

```python
fulkruma.shipping.couriers(*, on_behalf_of: str | None = None) -> list
```

Returns the list of couriers available in the workspace, with their service codes (e.g. JNE `reg`, JNE `yes`, J&T `ez`). The shape passes through whatever Biteship (or future direct integrations) returns &mdash; wrap in your own adapter if you depend on specific fields.

```python
couriers = fulkruma.shipping.couriers()
for c in couriers:
    print(c["courierCode"], c["courierName"], len(c.get("services", [])), "services")
```

The list is keyed off the merchant's enabled couriers in the portal &mdash; if a courier isn't there, enable it in the dashboard first.

### `origin` and `set_origin`

```python
fulkruma.shipping.origin(*, on_behalf_of: str | None = None) -> dict
fulkruma.shipping.set_origin(body: dict, *, on_behalf_of: str | None = None) -> dict
```

The workspace's default origin &mdash; pickup location, sender contact, area code &mdash; used when a shipment doesn't explicitly include an `origin`. Read it via `origin()`, write it via `set_origin()`.

```python
current = fulkruma.shipping.origin()

fulkruma.shipping.set_origin({
    "contactName": "Warehouse Manager",
    "contactPhone": "+62211234567",
    "address": "Jl. Sudirman No. 1",
    "postalCode": "12190",
    "areaId": "IDN-JKT-CTL",
    "lat": -6.2088,
    "lng": 106.8456,
})
```

The default origin is what `shipments.create(body={"origin": {"warehouseId": ...}})` resolves against when a warehouse doesn't have its own address on file. If every warehouse you have is fully populated, you can ignore the workspace-level origin.

### `rates`

```python
fulkruma.shipping.rates(body: dict, *, on_behalf_of: str | None = None) -> dict
```

The most-used method on this namespace. Posts a destination + line items + (optional) insurance flag, returns a list of `{"courierCode", "courierServiceCode", "courierType", "price", "etd", ...}` &mdash; one per (courier, service) combination. Quotes are live (round-tripped through Biteship) and valid for a short window.

```python
quote = fulkruma.shipping.rates({
    "destination": {
        "areaId": "IDN-JKT-MTH",
        "postalCode": "10310",
    },
    "items": [
        {"variantId": "var_01HX...", "quantity": 2, "weight": 0.5},
    ],
    "insurance": True,
})

for r in quote["rates"]:
    print(f"{r['courierCode']}/{r['courierServiceCode']}: Rp{r['price']} (ETD {r['etd']})")
```

The same `courierCode`/`courierServiceCode`/`price` triple is what you pass to [`shipments.create`](/docs/sdk/python/resources/shipments).

## Types

The shipping namespace returns intentionally-loose shapes &mdash; the upstream courier API (Biteship today) controls them. Fields we promise across courier providers:

- `rates[]["courierCode"]` &mdash; matches what `shipments.create` expects
- `rates[]["courierServiceCode"]`
- `rates[]["courierType"]`
- `rates[]["price"]` (integer rupiah)
- `rates[]["etd"]` (estimated delivery, vendor-specific format)

Everything else is passthrough. See [**API &rarr; Shipping**](/docs/api/resources/shipping) for the full per-provider field map.

## Common patterns

**Quote, render, book.** The canonical pattern &mdash; user picks from a list of quotes, then you book:

```python
def quote_for_checkout(fulkruma, destination: dict, items: list) -> list:
    quote = fulkruma.shipping.rates({"destination": destination, "items": items})
    return quote["rates"]   # render in your UI, return user's pick

# Then book via fulkruma.shipments.create — see shipments docs.
```

**Cache courier list per session.** `shipping.couriers()` is workspace-scoped config that rarely changes &mdash; safe to memoize for the process lifetime:

```python
from functools import lru_cache

@lru_cache(maxsize=1)
def get_couriers(fulkruma):
    return tuple(map(tuple, fulkruma.shipping.couriers()))  # tuples are hashable
```

Or invalidate on a `fulkruma.integration.biteship.updated` webhook if you need to be fully reactive; in practice, restart-on-deploy is fine.

**Initial setup: configure origin once.** For a fresh workspace, you'll typically call `set_origin` exactly once at onboarding time:

```python
fulkruma.shipping.set_origin({
    "contactName": "Fulfillment",
    "contactPhone": "+62211234567",
    "address": "Jl. Sudirman No. 1, Jakarta",
    "postalCode": "12190",
    "areaId": "IDN-JKT-CTL",
})
```

After that, individual shipments inherit it via `origin: {"warehouseId": ...}` resolution.

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Bad `areaId`, missing `weight` on items. |
| `404` | `not_found` | Variant in `items[]` doesn't exist. |
| `502` | `courier_error` | Upstream Biteship rejected the rate request. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:shipping:read` / `:write`. |

`courier_error` is the retry candidate &mdash; transient blips at the courier aggregator are the most common failure mode.

## Next

- [**Shipments**](/docs/sdk/python/resources/shipments) &mdash; the other side of the quote-then-book flow.
- [**Addresses**](/docs/sdk/python/resources/addresses) &mdash; destinations to quote against.
- [**API &rarr; Shipping**](/docs/api/resources/shipping) &mdash; HTTP-level reference.
