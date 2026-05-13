---
title: fulkruma.product.created
---

# `fulkruma.product.created.v1`

Fires when a product is created in Fulkruma &mdash; either by a direct `POST /api/v1/products` call or by an inbound Storlaunch product-sync webhook mirroring a product into Fulkruma's fulfilment context. Subscribe if you back your own catalog with Fulkruma's product object or provision dependent resources (warehouses-to-seed, marketing automation, accounting SKUs) at product creation time.

## When it fires

Inside the same Prisma transaction as the `Product` insert. Exactly one emission per product ID; retries reuse the same `evt_…`. The auto-created `Default` variant is **not** broadcast as a separate event &mdash; it's implicit in the product creation.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.product.created.v1",
  "occurredAt": "2026-05-12T10:42:00.123Z",
  "accountId": "acc_01HX...",
  "data": {
    "productId": "prod_01HXAB7K3M9N2P5QRS8TVWXY3Z",
    "name": "Espresso Beans 250g",
    "type": "physical"
  }
}
```

The `data` field is the minimal product summary. Fetch the full object including variants via `GET /api/v1/products/:id` if you need SKUs, dimensions, or pricing.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.product.created.v1') {
  const { productId, name, type } = event.data;
  await catalog.mirror({ fulkrumaId: productId, name, fulfilmentType: type });
}
```

```python
# Python
if event["type"] == "fulkruma.product.created.v1":
    d = event["data"]
    catalog.mirror(fulkruma_id=d["productId"], name=d["name"], fulfilment_type=d["type"])
```

```go
// Go
if event.Type == "fulkruma.product.created.v1" {
    var d struct{ ProductID, Name, Type string }
    _ = json.Unmarshal(event.Data, &d)
    catalog.Mirror(ctx, d.ProductID, d.Name, d.Type)
}
```

## What to do

- Mirror the product into your own catalog if you use Fulkruma as the source of truth for fulfilment metadata.
- Provision dependent rows: a default stock level of 0 in each warehouse, low-stock alert thresholds, marketing automation triggers.
- Fan out to accounting (SKU registration) or analytics (new-product tracking).

## Common pitfalls

- **Treating the event as "available for sale".** A new product has no stock until you post `initial_stock` movements. Don't surface it on a storefront based on this event alone.
- **Double-mirror loops.** If your own catalog also creates Fulkruma products via API, guard against round-trips with a `metadata.source` marker.
- **Assuming the product carries variants here.** The payload is intentionally minimal &mdash; fetch the product if you need variant info.

## Related events

`fulkruma.product.updated.v1` and `fulkruma.product.archived.v1` are reserved in the catalog but **not currently emitted**. Variant-level events (`variant.created`, `variant.updated`, `variant.archived`) are also reserved &mdash; audit-log rows are written for those but no webhook fires. Subscribe defensively to handle them when they ship.

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks) &mdash; signature verification, retries, ordering.
- [**Products resource**](/docs/api/resources/products) &mdash; the full object shape and write API.
