---
title: Stock
---

# Stock

Stock is the per-variant, per-warehouse inventory ledger. Every variant has zero or more `VariantStock` rows (one per warehouse it lives at), and every change generates a `StockMovement` audit record. Reservations are short-lived holds that block checkout-bound inventory from being double-sold. The Python SDK wraps four endpoints behind `fulkruma.stock`. For HTTP shapes and the full field reference, see [**API &rarr; Stock**](/docs/api/resources/stock).

## Namespace

```python
fulkruma.stock     # StockResources
```

Four reads (`levels`, `movements`, `reservations`) plus one mutation (`adjust`) &mdash; the only way to change stock from the SDK. Reservations are created server-side by checkout sessions; movements are append-only.

## Methods

### `levels`

```python
fulkruma.stock.levels(
    *,
    variant_id: str | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Returns current on-hand and available levels for every (variant, warehouse) pair. Pass `variant_id` to scope.

```python
result = fulkruma.stock.levels(variant_id="var_01HX...")
for s in result["stock"]:
    print(f"{s['warehouseId']}: {s['available']} available "
          f"({s['onHand']} on hand, {s['reserved']} reserved)")
```

`available == onHand - reserved` always &mdash; the server keeps this invariant inside the same transaction as every stock mutation, so you'll never see drift.

### `movements`

```python
fulkruma.stock.movements(
    *,
    variant_id: str | None = None,
    on_behalf_of: str | None = None,
) -> dict
```

Returns the append-only ledger &mdash; every adjust, every checkout-driven reservation/release, every shipment-driven decrement. Default page is the most recent 100 movements.

```python
result = fulkruma.stock.movements(variant_id="var_01HX...")
for m in result["movements"]:
    print(m["createdAt"], m["reason"], m["delta"])
```

Reasons: `purchase`, `sale`, `return`, `damage`, `audit`, `transfer_in`, `transfer_out`, `manual_adjust`.

### `reservations`

```python
fulkruma.stock.reservations(*, on_behalf_of: str | None = None) -> dict
```

Returns currently-live reservations across the workspace. Reservations expire automatically after `expiresAt` &mdash; the cleanup job releases them back to `available`. You normally read this for debugging "why is X showing 0 available when nothing's been sold?".

```python
result = fulkruma.stock.reservations()
print(len(result["reservations"]), "live holds")
```

### `adjust`

```python
fulkruma.stock.adjust(body: dict, *, on_behalf_of: str | None = None) -> dict
```

The one mutation. Atomically updates the `(variant, warehouse)` row by `delta` and writes a `StockMovement` audit entry in the same transaction. The SDK auto-mints an idempotency key &mdash; replay-safe under network retries.

```python
result = fulkruma.stock.adjust({
    "variantId": "var_01HX...",
    "warehouseId": "wh_01HX...",
    "delta": 50,                  # positive = receive, negative = take out
    "reason": "purchase",
    "note": "PO-2026-118 received",
})
print("on hand now:", result["stock"]["onHand"])
print("movement id:", result["movement"]["id"])
```

<blockquote class="callout-warn">

**Negative deltas can't take `available` below zero.** If you try to subtract more than is currently free, the API returns `409 insufficient_stock` and rolls back &mdash; neither the row nor the movement is written. Use `stock.levels` first if you need to clamp.

</blockquote>

## Types

Every method returns a dict matching the API envelope. Key shapes:

```python
# stock.levels[].stock[]
{
    "id": "...",
    "variantId": "var_...",
    "warehouseId": "wh_...",
    "onHand": int,
    "reserved": int,
    "available": int,         # onHand - reserved
    "lowStockThreshold": int | None,
    "updatedAt": "..."
}

# stock.movements[].movements[]
{
    "id": "...",
    "variantId": "var_...",
    "warehouseId": "wh_...",
    "delta": int,             # signed
    "reason": "purchase" | "sale" | "return" | "damage" |
              "audit" | "transfer_in" | "transfer_out" | "manual_adjust",
    "note": "..." | None,
    "referenceType": "shipment" | "checkout" | None,
    "referenceId": "..." | None,
    "createdAt": "..."
}
```

## Common patterns

**Stock a brand-new variant.** After `add_variant`, push the initial count:

```python
fulkruma.stock.adjust({
    "variantId": "var_01HX...",
    "warehouseId": "wh_01HX...",
    "delta": 100,
    "reason": "purchase",
    "note": "Initial stock",
})
```

**Transfer between warehouses.** Two adjusts &mdash; out first, in second:

```python
def transfer(fulkruma, variant_id: str, from_wh: str, to_wh: str, qty: int):
    fulkruma.stock.adjust({
        "variantId": variant_id, "warehouseId": from_wh,
        "delta": -qty, "reason": "transfer_out",
    })
    fulkruma.stock.adjust({
        "variantId": variant_id, "warehouseId": to_wh,
        "delta": qty, "reason": "transfer_in",
    })
```

If the first succeeds and the second fails, you have a real problem &mdash; wrap with your own job-runner retry, and keep the originating ref via `note` so you can reconcile manually.

**Audit count.** Daily reconciliation against your WMS:

```python
def reconcile(fulkruma, variant_id: str, warehouse_id: str, counted: int):
    levels = fulkruma.stock.levels(variant_id=variant_id)
    row = next(
        (s for s in levels["stock"] if s["warehouseId"] == warehouse_id),
        None,
    )
    if not row:
        return
    delta = counted - row["onHand"]
    if delta != 0:
        fulkruma.stock.adjust({
            "variantId": variant_id,
            "warehouseId": warehouse_id,
            "delta": delta,
            "reason": "audit",
        })
```

**Detect low-stock variants.**

```python
def low_stock(fulkruma):
    levels = fulkruma.stock.levels()
    return [
        s for s in levels["stock"]
        if s.get("lowStockThreshold") is not None
        and s["available"] <= s["lowStockThreshold"]
    ]
```

`lowStockThreshold` lives on the variant; the server copies it onto the `VariantStock` row so you don't have to join.

## Errors

| `err.status` | `err.code` | Cause |
|---|---|---|
| `400` | `validation_error` | Missing `variantId`/`warehouseId`, bad `reason`, non-integer `delta`. |
| `404` | `not_found` | Variant or warehouse ID missing or in another workspace. |
| `409` | `insufficient_stock` | Negative delta would take `available` below zero. |
| `403` | `insufficient_scope` | Key lacks `fulkruma:stock:write`. |

## Next

- [**Shipments**](/docs/sdk/python/resources/shipments) &mdash; outbound stock movements with carriers attached.
- [**Warehouses**](/docs/sdk/python/resources/warehouses) &mdash; where stock lives.
- [**API &rarr; Stock**](/docs/api/resources/stock) &mdash; HTTP-level reference.
