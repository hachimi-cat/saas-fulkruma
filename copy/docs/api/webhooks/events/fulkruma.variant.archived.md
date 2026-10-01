---
title: fulkruma.variant.archived
---

# `fulkruma.variant.archived.v1`

Fires when a variant is archived (`DELETE /api/v1/products/:id/variants/:variantId`).

## When it fires

Inside the same transaction as the archive, once: archiving it again sends nothing.

## Payload

```json
{
  "id": "evt_01HXAB7K3M9N2P5QRS8TVWXY3Z",
  "type": "fulkruma.variant.archived.v1",
  "occurredAt": "2026-05-20T03:00:00.000Z",
  "accountId": "acc_01HX...",
  "data": {
    "variantId": "clx6d5e4f0000aa1b2c3d4e5g",
    "productId": "clx6d5e4f0000aa1b2c3d4e5f",
    "name": "PDF",
    "sku": "EB-1-PDF",
    "archivedAt": "2026-05-20T03:00:00.000Z"
  },
  "metadata": {}
}
```

Its stock levels are kept.

## Handler examples

```js
// Node
if (event.type === 'fulkruma.variant.archived.v1') {
  await sync(event.data.variantId);
}
```

```python
# Python
if event["type"] == "fulkruma.variant.archived.v1":
    sync(event["data"]["variantId"])
```

## Related events

- [`fulkruma.variant.created.v1`](./fulkruma.variant.created)
- [`fulkruma.product.archived.v1`](./fulkruma.product.archived)

## Next

- [**Webhooks reference**](/docs/api/resources/webhooks).
