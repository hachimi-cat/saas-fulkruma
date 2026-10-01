---
title: fulkruma.variant.created
---

# `fulkruma.variant.created.v1`

Fires when a variant is added to a product (`POST /api/v1/products/:id/variants`). A product's automatic `Default` variant comes with [`fulkruma.product.created.v1`](./fulkruma.product.created) instead.

## When it fires

Inside the same transaction as the create.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.variant.created.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "variantId": "clx6d5e4f0000aa1b2c3d4e5g",
    "productId": "clx6d5e4f0000aa1b2c3d4e5f",
    "name": "PDF",
    "sku": "EB-1-PDF",
    "priceCents": 50000,
    "lowStockThreshold": null,
    "isDefault": false
  },
  "metadata": {}
}
```

`lowStockThreshold` set here arms [`fulkruma.stock.low.v1`](./fulkruma.stock.low) for the variant.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.variant.created.v1') {
  await sync(event.data.variantId);
}
```

```python
# Python
if event["type"] == "fulkruma.variant.created.v1":
    sync(event["data"]["variantId"])
```

## Related events

- [`fulkruma.variant.archived.v1`](./fulkruma.variant.archived)
- [`fulkruma.product.created.v1`](./fulkruma.product.created)

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
