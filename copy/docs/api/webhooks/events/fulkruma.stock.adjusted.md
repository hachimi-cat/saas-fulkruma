---
title: fulkruma.stock.adjusted
---

# `fulkruma.stock.adjusted.v1`

Fires every time a stock level changes &mdash; via direct `POST /api/v1/stock/adjust`, as a side-effect of shipment fulfilment, or during refund-restock processing. This is the highest-volume event Fulkruma emits; back-pressure your handler accordingly.

The payload carries the signed `delta`, the `reason` code, and the post-mutation `quantityAfter` so consumers can sync state without a separate read.

## When it fires

Inside the same Prisma transaction as the underlying `StockMovement` insert. Exactly one emission per movement ID; retries reuse the same `evt_…`.

Reasons that fire this event:

- `manual_adjust` &mdash; merchant-initiated correction.
- `initial_stock` &mdash; onboarding seed.
- `transfer_in` / `transfer_out` &mdash; inter-warehouse movement.
- `damaged` / `returned_to_supplier` &mdash; write-offs.
- `refund_restock` &mdash; refund through Plugipay restored quantity.
- `import` &mdash; bulk import.

Shipment fulfilment fires an `adjusted` event with a synthetic reason internal to that flow.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.stock.adjusted.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "variantId": "var_01HX...",
    "warehouseId": "wh_01HX...",
    "delta": -3,
    "reason": "damaged",
    "quantityAfter": 39,
    "movementId": "mv_01HX..."
  }
}
```

`delta` is signed: negative for decrement, positive for increment. `quantityAfter` is the post-mutation on-hand level; treat it as authoritative.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.stock.adjusted.v1') {
  const { variantId, warehouseId, delta, reason, quantityAfter } = event.data;
  await inventory.upsertLevel(variantId, warehouseId, quantityAfter);
  if (reason === 'damaged' || reason === 'returned_to_supplier') {
    await analytics.track('stock_loss', { variantId, delta });
  }
}
```

```python
# Python
if event["type"] == "fulkruma.stock.adjusted.v1":
    d = event["data"]
    inventory.upsert_level(d["variantId"], d["warehouseId"], d["quantityAfter"])
    if d["reason"] in ("damaged", "returned_to_supplier"):
        analytics.track("stock_loss", variant=d["variantId"], delta=d["delta"])
```

```go
// Go
if event.Type == "fulkruma.stock.adjusted.v1" {
    var d struct {
        VariantID, WarehouseID, Reason, MovementID string
        Delta, QuantityAfter                       int
    }
    _ = json.Unmarshal(event.Data, &d)
    inventory.Upsert(ctx, d.VariantID, d.WarehouseID, d.QuantityAfter)
}
```

## What to do

- Mirror the level into your own inventory store, keyed by `(variantId, warehouseId)`.
- Surface low-stock alerts when `quantityAfter` falls below your threshold.
- Reconcile against Fulkruma's [movements log](/docs/api/resources/stock#list-stock-movements) at end-of-day &mdash; the `movementId` in the payload joins straight to that table.

## Common pitfalls

- **Recomputing the level from `delta`.** Use `quantityAfter` directly. Out-of-order delivery can make a `delta`-based replay drift.
- **Volume.** A merchant fulfilling 1000 orders a day can fire 2-3000 stock events. Queue your handler; don't process synchronously.
- **Treating `damaged` as fraud-positive.** It's just write-offs &mdash; routine inventory hygiene. Cross-reference with audit-log to see who triggered it.
- **Missing the movement ID.** `movementId` is the join key to the immutable [movements](/docs/api/resources/stock#list-stock-movements) audit table &mdash; capture it.

## Related events

`fulkruma.stock.low.v1` (when a level falls below a variant's `lowStockThreshold`) is reserved in the catalog but **not currently emitted**. Low-stock detection today happens client-side from this event's `quantityAfter`.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
- [**Stock resource**](/docs/api/resources/stock) &mdash; the levels, movements, and reservation APIs.
