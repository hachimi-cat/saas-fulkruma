---
title: fulkruma.product.archived
---

# `fulkruma.product.archived.v1`

Fires when a product is archived (`DELETE /api/v1/products/:id` &mdash; Fulkruma archives, it never deletes). Stop selling it.

## When it fires

Inside the same transaction as the archive, once: archiving an already-archived product sends nothing.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.product.archived.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "productId": "clx6d5e4f0000aa1b2c3d4e5f",
    "name": "Ebook",
    "sku": "EB-1",
    "type": "digital",
    "archivedAt": "2026-05-20T03:00:00.000Z"
  },
  "metadata": {}
}
```

Its stock, shipments and deliveries are unchanged.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.product.archived.v1') {
  await sync(event.data.productId);
}
```

```python
# Python
if event["type"] == "fulkruma.product.archived.v1":
    sync(event["data"]["productId"])
```

## Related events

- [`fulkruma.product.updated.v1`](./fulkruma.product.updated)
- [`fulkruma.variant.archived.v1`](./fulkruma.variant.archived)

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
