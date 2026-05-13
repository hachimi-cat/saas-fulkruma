---
title: Warehouses
---

# Warehouses

A warehouse is a physical (or logical) location stock lives at &mdash; every `VariantStock` row pins to one warehouse + one variant, every `Shipment` has an origin warehouse, and the routing engine picks a warehouse per order based on availability + proximity. The Python SDK wraps the four warehouse endpoints behind `fulkruma.warehouses`. Each method returns the raw envelope dict the API sent (`{"warehouse": {...}}` or `{"warehouses": [...]}`); no schema enforcement. For HTTP shapes and the full field reference, see [**API &rarr; Warehouses**](/docs/api/resources/warehouses).

## Namespace

```python
fulkruma.warehouses     # WarehousesResources — every warehouse method below
```

The namespace is instantiated on the `FulkrumaClient` constructor and shares its underlying `httpx.Client`. There is no per-namespace state &mdash; calls are independent.

## Methods

### `create`

```python
fulkruma.warehouses.create(
    body: dict,
    *,
    on_behalf_of: str | None = None,
) -> dict
```

Creates a warehouse in the workspace this key belongs to. Only `name` is required in `body`; everything else (`address`, `city`, `postal`, `lat`, `lng`, `phone`, `isDefault`) is optional. The SDK does **not** auto-mint an idempotency key here &mdash; warehouse creation is naturally non-idempotent and rarely retried.

```python
result = fulkruma.warehouses.create({
    "name": "Jakarta DC-1",
    "address": "Jl. Sudirman No. 1",
    "city": "Jakarta",
    "postal": "12190",
    "lat": -6.2088,
    "lng": 106.8456,
    "phone": "+62211234567",
    "isDefault": True,
})

print(result["warehouse"]["id"])   # → "wh_01HXAB..."
```

Setting `isDefault: True` automatically clears the flag on whichever warehouse currently holds it &mdash; the backend does the swap inside a single transaction.

### `list`

```python
fulkruma.warehouses.list(*, on_behalf_of: str | None = None) -> dict
```

Returns every warehouse in the workspace, including archived ones. Filter on `archivedAt` to find active. **Not paginated** &mdash; we expect single-digit warehouse counts per merchant.

```python
result = fulkruma.warehouses.list()
active = [w for w in result["warehouses"] if not w.get("archivedAt")]
for w in active:
    print(w["id"], w["name"], w.get("city"))
```

### `update`

```python
fulkruma.warehouses.update(
    warehouse_id: str,
    patch: dict,
    *,
    on_behalf_of: str | None = None,
) -> dict
```

Partial update. Pass only fields you want to change. Promote a warehouse with `{"isDefault": True}` &mdash; the API clears the flag on the previous default in the same transaction.

```python
result = fulkruma.warehouses.update("wh_01HX...", {
    "phone": "+62217654321",
    "lat": -6.2090,
    "lng": 106.8460,
})
```

### `archive`

```python
fulkruma.warehouses.archive(
    warehouse_id: str,
    *,
    on_behalf_of: str | None = None,
) -> dict
```

Soft-delete. The warehouse stays referenceable from historic shipments and stock movements; it no longer shows up in the routing pool. **Not reversible** via the API &mdash; mint a new warehouse if you need to "un-archive".

```python
fulkruma.warehouses.archive("wh_01HX...")
```

If the warehouse still has active stock (`onHand > 0` on any variant), the API returns `409 conflict` &mdash; zero it out first via `stock.adjust` with a negative delta.

## Types

The Python SDK does not define `Warehouse` dataclasses &mdash; every resource method returns a plain dict matching the API envelope:

```python
{
    "warehouse": {
        "id": "wh_...",
        "accountId": "acc_...",
        "name": "...",
        "address": "..." | None,
        "city": "..." | None,
        "postal": "..." | None,
        "lat": float | None,
        "lng": float | None,
        "phone": "..." | None,
        "isDefault": bool,
        "archivedAt": "..." | None,
        "createdAt": "...",
        "updatedAt": "..."
    }
}
```

Wrap in your own typed dataclass if your codebase prefers strict types. The Python SDK errs on the side of "pass through what the server sent" so it doesn't lag behind backend evolution.

## Common patterns

**Bootstrap a default warehouse.** If you don't know whether a workspace has a warehouse yet (first-run setup, fresh tenants), create-or-promote:

```python
def ensure_default(fulkruma, name: str):
    result = fulkruma.warehouses.list()
    active = [w for w in result["warehouses"] if not w.get("archivedAt")]
    if not active:
        return fulkruma.warehouses.create({"name": name, "isDefault": True})
    default = next((w for w in active if w.get("isDefault")), None)
    if default:
        return {"warehouse": default}
    return fulkruma.warehouses.update(active[0]["id"], {"isDefault": True})
```

**Resolve a warehouse by city.** Routing logic typically asks "which warehouse should fulfill this Jakarta order?":

```python
def warehouse_for_city(fulkruma, city: str):
    result = fulkruma.warehouses.list()
    matches = [
        w for w in result["warehouses"]
        if not w.get("archivedAt") and (w.get("city") or "").lower() == city.lower()
    ]
    matches.sort(key=lambda w: w.get("isDefault", False), reverse=True)
    return matches[0] if matches else None
```

For real proximity routing, use the `lat`/`lng` columns and do haversine math client-side &mdash; we don't expose a server-side "nearest" query.

**Context manager for short scripts.** The client owns an `httpx.Client` by default. Use `with` to release sockets:

```python
from fulkruma import FulkrumaClient

with FulkrumaClient(key_id="AKIAFULK...", secret="...") as fulkruma:
    print(fulkruma.warehouses.list())
# httpx pool closed here
```

**`for_merchant` for platform keys.** If you hold a `fulkruma:platform:admin` scope key (e.g. Storlaunch's platform key), scope a clone to one merchant:

```python
merchant_client = fulkruma.for_merchant("acc_01H...")
merchant_client.warehouses.list()  # operates inside that merchant's workspace
```

Or pass `on_behalf_of` per call.

## Errors

Warehouse endpoints raise `FulkrumaError` &mdash; the SDK does not define `WarehouseNotFound` or similar subclasses. Branch on `err.status` and `err.code`:

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Missing `name`, bad coordinate range, postal too long. |
| `404` | `not_found` | Warehouse ID doesn't exist or lives in another workspace. |
| `409` | `conflict` | Archive attempted on a warehouse with live stock. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:warehouse:write`. |

Transport failures surface as `FulkrumaError(0, "timeout", ...)` or `FulkrumaError(0, "network_error", ...)`. See [**Errors**](/docs/sdk/python/errors) for the full handling guide.

## Next

- [**Stock**](/docs/sdk/python/resources/stock) &mdash; what lives in a warehouse.
- [**Shipments**](/docs/sdk/python/resources/shipments) &mdash; what leaves a warehouse.
- [**API &rarr; Warehouses**](/docs/api/resources/warehouses) &mdash; HTTP-level reference.
