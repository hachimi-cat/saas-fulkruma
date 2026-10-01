---
title: fulkruma.stock.low
---

# `fulkruma.stock.low.v1`

Fires when a stock level falls below its variant's `lowStockThreshold`: a variant/warehouse level that was at or above the threshold goes under it. Subscribe to reorder, alert a buyer, or hide a nearly sold-out variant before it runs out.

## When it fires

Inside the same Prisma transaction as the `POST /api/v1/stock/adjust` that lowered the level, right after that adjustment's `fulkruma.stock.adjusted.v1`. Exactly once per crossing; retries reuse the same `evt_…`.

- **Only on the crossing.** A level that is already below the threshold and drops further fires nothing more. One that recovers to the threshold or above and falls under it again fires again.
- **Below, not at.** With a threshold of `5`, going from `6` to `5` fires nothing; going from `5` to `4` fires.
- **Per warehouse.** Each `(variant, warehouse)` level crosses on its own.
- **Only with a threshold.** A variant whose `lowStockThreshold` is `null` never fires; a threshold of `0` never fires either, since a level cannot go below zero.
- The threshold is the variant's: set it with `POST /api/v1/products/{id}/variants` or `PATCH /api/v1/products/{id}/variants/{variantId}`, or let Storlaunch sync it. A level kept under a synced Storlaunch variant's id (its `externalRef`) uses that variant's threshold.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.stock.low.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "variantId": "var_01HX...",
    "productVariantId": "var_01HX...",
    "productId": "prod_01HX...",
    "warehouseId": "wh_01HX...",
    "sku": "TEE-RED-M",
    "name": "Red / M",
    "quantity": 4,
    "threshold": 5,
    "movementId": "mv_01HX..."
  }
}
```

| Field | Type | Description |
|---|---|---|
| `variantId` | string | The id the stock level is kept under (as sent to `POST /stock/adjust`). |
| `productVariantId` | string | Fulkruma's variant id. The same as `variantId`, unless the level is kept under a synced Storlaunch variant's id. |
| `productId` | string | The variant's product. |
| `warehouseId` | string | The warehouse whose level crossed. |
| `sku` | string \| null | The variant's SKU. |
| `name` | string | The variant's name. |
| `quantity` | integer | The level after the adjustment. |
| `threshold` | integer | The variant's `lowStockThreshold`. |
| `movementId` | string | The stock movement that crossed it; joins to [List stock movements](/docs/api/resources/stock#list-stock-movements). |

## Handler examples

```js
// Node
if (event.type === 'fulkruma.stock.low.v1') {
  const { sku, name, warehouseId, quantity, threshold } = event.data;
  await slack.post(`#ops`, `Low stock: ${name} (${sku}) — ${quantity} left in ${warehouseId}, reorder below ${threshold}`);
}
```

```python
# Python
if event["type"] == "fulkruma.stock.low.v1":
    d = event["data"]
    purchasing.open_reorder(sku=d["sku"], warehouse=d["warehouseId"], on_hand=d["quantity"])
```

```go
// Go
if event.Type == "fulkruma.stock.low.v1" {
    var d struct {
        SKU, Name, WarehouseID string
        Quantity, Threshold    int
    }
    _ = json.Unmarshal(event.Data, &d)
    purchasing.OpenReorder(ctx, d.SKU, d.WarehouseID, d.Quantity)
}
```

## What to do

- Open a reorder or purchase request for the warehouse that crossed.
- Alert whoever restocks, once per crossing &mdash; the event never repeats while the level stays low.
- Hide or badge the variant on a storefront when `quantity` reaches your own sell-out margin.

## Common pitfalls

- **Expecting a repeat while still low.** It fires on the crossing only. To list everything that is low now, read [stock levels](/docs/api/resources/stock#list-stock-levels) and compare with the variants' thresholds.
- **Expecting "back in stock".** There is no event for rising above the threshold; watch `fulkruma.stock.adjusted.v1`'s `quantityAfter` for that.
- **Treating `variantId` as Fulkruma's id every time.** For Storlaunch-synced stock it is Storlaunch's variant id; `productVariantId` is always Fulkruma's.

## Related events

- [`fulkruma.stock.adjusted.v1`](/docs/api/webhooks/events/fulkruma.stock.adjusted) &mdash; every change, with `quantityAfter`. A crossing fires both.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks) &mdash; signature verification, retries, ordering.
- [**Stock resource**](/docs/api/resources/stock) &mdash; levels, movements and the adjust call.
- [**Products resource**](/docs/api/resources/products) &mdash; where `lowStockThreshold` is set.
